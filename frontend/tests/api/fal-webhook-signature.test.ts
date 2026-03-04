import crypto from "crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type FalRuntimeFlags } from "../../lib/server/api/falRuntimeFlags";
import { verifyFalWebhookSignature } from "../../lib/server/api/falWebhook";

const createFlags = (overrides: Partial<FalRuntimeFlags> = {}): FalRuntimeFlags => ({
  integrationMode: "on",
  modelAllowlist: new Set(["*"]),
  reconcilerEnabled: true,
  reconcilerCronSecret: "secret",
  reconcilerBatchSize: 10,
  reconcilerMaxAttempts: 5,
  reconcilerMinAgeSeconds: 0,
  reconcilerLeaseSeconds: 120,
  circuitBreakerEnabled: false,
  circuitBreakerThreshold15m: 20,
  webhookEnabled: true,
  webhookVerifyMode: "fal_only",
  webhookJwksUrl: "https://example.test/jwks",
  webhookToleranceSeconds: 300,
  webhookCanaryUserAllowlist: new Set<string>(),
  webhookCanaryModelAllowlist: new Set<string>(),
  publicApiBaseUrl: "https://shortpulse.test",
  directDebitFallbackEnabled: false,
  admission: {
    mode: "off",
    globalMax: 4,
    tierLimits: {
      video_long: 2,
      image_heavy: 3,
      image_standard: 4,
    },
    retryAfterSeconds: 20,
  },
  reservationCleanupEnabled: true,
  reservationCleanupMinAgeSeconds: 900,
  reservationCleanupBatchSize: 200,
  admissionAtomicEnabled: false,
  queueEnabled: false,
  queueStatusDispatchKickEnabled: true,
  queueMaxPerUser: 20,
  queueDispatchBatchSize: 25,
  queueLeaseSeconds: 30,
  queueMaxAttempts: 5,
  queueBaseBackoffSeconds: 5,
  ...overrides,
  statusTransientFailuresEnabled: overrides.statusTransientFailuresEnabled ?? false,
  providerAttachedReservationCleanupEnabled:
    overrides.providerAttachedReservationCleanupEnabled ?? true,
  providerAttachedReservationCleanupMinAgeSeconds:
    overrides.providerAttachedReservationCleanupMinAgeSeconds ?? 7200,
  providerAttachedReservationOrphanMinAgeSeconds:
    overrides.providerAttachedReservationOrphanMinAgeSeconds ?? 86400,
  queueMaxWaitSeconds: overrides.queueMaxWaitSeconds ?? 1200,
  recoveryProbeTimeoutMs: overrides.recoveryProbeTimeoutMs ?? 15000,
  noMediaExhaustMinAgeSeconds: overrides.noMediaExhaustMinAgeSeconds ?? 7200,
  runningExhaustMinAgeSeconds: overrides.runningExhaustMinAgeSeconds ?? 7200,
});

const buildFalSignedMessage = ({
  requestId,
  userId,
  timestamp,
  rawBody,
}: {
  requestId: string;
  userId: string;
  timestamp: string;
  rawBody: string;
}) => {
  const payloadHash = crypto.createHash("sha256").update(rawBody, "utf8").digest("hex");
  return `${requestId}${userId}${timestamp}${payloadHash}`;
};

describe("verifyFalWebhookSignature", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.SHORTPULSE_FAL_WEBHOOK_SECRET;
    delete process.env.FAL_WEBHOOK_SECRET;
  });

  it("accepts valid Fal Ed25519 signatures via JWKS", async () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
    const publicJwk = publicKey.export({ format: "jwk" }) as JsonWebKey;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          keys: [
            {
              ...publicJwk,
              kid: "key-1",
              kty: "OKP",
              crv: "Ed25519",
              alg: "EdDSA",
            },
          ],
        }),
      }))
    );

    const rawBody = JSON.stringify({ status: "OK" });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const requestId = "req-1";
    const userId = "user-1";
    const message = buildFalSignedMessage({ requestId, userId, timestamp, rawBody });
    const signature = crypto
      .sign(null, Buffer.from(message, "utf8"), privateKey)
      .toString("base64url");

    const result = await verifyFalWebhookSignature({
      rawBody,
      headers: {
        requestId,
        userId,
        eventId: "event-1",
        timestamp,
        signature,
      },
      flags: createFlags({ webhookVerifyMode: "fal_only" }),
    });

    expect(result.ok).toBe(true);
    expect(result.method).toBe("fal");
  });

  it("rejects invalid Fal signatures", async () => {
    const { publicKey } = crypto.generateKeyPairSync("ed25519");
    const publicJwk = publicKey.export({ format: "jwk" }) as JsonWebKey;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          keys: [{ ...publicJwk, kty: "OKP", crv: "Ed25519", alg: "EdDSA" }],
        }),
      }))
    );

    const rawBody = JSON.stringify({ status: "OK" });
    const timestamp = String(Math.floor(Date.now() / 1000));

    const result = await verifyFalWebhookSignature({
      rawBody,
      headers: {
        requestId: "req-1",
        userId: "user-1",
        eventId: "event-1",
        timestamp,
        signature: "bad-signature",
      },
      flags: createFlags({ webhookVerifyMode: "fal_only" }),
    });

    expect(result.ok).toBe(false);
    expect(result.method).toBeNull();
  });

  it("accepts legacy HMAC signatures in dual mode when Fal verification fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 500,
        json: async () => ({}),
      }))
    );
    process.env.SHORTPULSE_FAL_WEBHOOK_SECRET = "legacy-secret";

    const rawBody = JSON.stringify({ status: "OK" });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const expected = crypto
      .createHmac("sha256", "legacy-secret")
      .update(`${timestamp}.${rawBody}`, "utf8")
      .digest("hex");

    const result = await verifyFalWebhookSignature({
      rawBody,
      headers: {
        requestId: null,
        userId: null,
        eventId: "event-1",
        timestamp,
        signature: `t=${timestamp},v1=${expected}`,
      },
      flags: createFlags({ webhookVerifyMode: "dual" }),
    });

    expect(result.ok).toBe(true);
    expect(result.method).toBe("hmac");
  });

  it("rejects signatures outside timestamp tolerance", async () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
    const publicJwk = publicKey.export({ format: "jwk" }) as JsonWebKey;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          keys: [{ ...publicJwk, kty: "OKP", crv: "Ed25519", alg: "EdDSA" }],
        }),
      }))
    );

    const rawBody = JSON.stringify({ status: "OK" });
    const timestamp = String(Math.floor(Date.now() / 1000) - 10_000);
    const requestId = "req-1";
    const userId = "user-1";
    const message = buildFalSignedMessage({ requestId, userId, timestamp, rawBody });
    const signature = crypto
      .sign(null, Buffer.from(message, "utf8"), privateKey)
      .toString("base64url");

    const result = await verifyFalWebhookSignature({
      rawBody,
      headers: {
        requestId,
        userId,
        eventId: "event-1",
        timestamp,
        signature,
      },
      flags: createFlags({ webhookVerifyMode: "fal_only", webhookToleranceSeconds: 60 }),
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("timestamp_out_of_window");
  });
});
