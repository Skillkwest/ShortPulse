import crypto from "crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildFalWebhookSignedMessage,
  verifyFalWebhookSignature,
} from "../../lib/server/api/falWebhook";

describe("verifyFalWebhookSignature", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
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
    const message = buildFalWebhookSignedMessage({
      requestId,
      userId,
      timestamp,
      payloadHash: crypto.createHash("sha256").update(rawBody, "utf8").digest("hex"),
    });
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
      config: {
        jwksUrl: "https://example.test/jwks",
      },
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
      config: {
        jwksUrl: "https://example.test/jwks",
      },
    });

    expect(result.ok).toBe(false);
    expect(result.method).toBeNull();
  });

  it("rejects HMAC-style signatures when Fal verification fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 500,
        json: async () => ({}),
      }))
    );

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
    });

    expect(result.ok).toBe(false);
    expect(result.method).toBeNull();
    expect(result.reason).toBe("missing_required_fal_headers");
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
    const message = buildFalWebhookSignedMessage({
      requestId,
      userId,
      timestamp,
      payloadHash: crypto.createHash("sha256").update(rawBody, "utf8").digest("hex"),
    });
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
      config: {
        jwksUrl: "https://example.test/jwks",
        toleranceSeconds: 60,
      },
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("timestamp_out_of_window");
  });
});
