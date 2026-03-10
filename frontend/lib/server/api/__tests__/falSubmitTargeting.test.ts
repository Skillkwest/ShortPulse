import { describe, expect, it } from "vitest";
import type { FalRuntimeFlags } from "../falRuntimeFlags";
import {
  isWebhookCanaryEligible,
  resolveWebhookCallbackUrl,
  withWebhookTargets,
} from "../falSubmitTargeting";

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
  runningHardTimeoutSeconds: overrides.runningHardTimeoutSeconds ?? 0,
});

describe("falSubmitTargeting webhook canary", () => {
  it("returns callback URL when webhook enabled and no canary allowlists are configured", () => {
    const callback = resolveWebhookCallbackUrl(createFlags());
    expect(callback).toBe("https://shortpulse.test/api/fal/webhook");
  });

  it("returns null when caller is outside configured canary allowlists", () => {
    const callback = resolveWebhookCallbackUrl(
      createFlags({
        webhookCanaryUserAllowlist: new Set(["user-1"]),
        webhookCanaryModelAllowlist: new Set(["fal-ai/nano-banana-pro"]),
      }),
      {
        userId: "user-2",
        modelId: "fal-ai/nano-banana-pro",
      }
    );
    expect(callback).toBeNull();
  });

  it("accepts wildcard/prefix canary matches for user and model", () => {
    const flags = createFlags({
      webhookCanaryUserAllowlist: new Set(["user-*"]),
      webhookCanaryModelAllowlist: new Set(["fal-ai/*"]),
    });
    expect(
      isWebhookCanaryEligible({
        flags,
        userId: "user-42",
        modelId: "fal-ai/nano-banana-pro",
      })
    ).toBe(true);
    expect(
      resolveWebhookCallbackUrl(flags, {
        userId: "user-42",
        modelId: "fal-ai/nano-banana-pro",
      })
    ).toBe("https://shortpulse.test/api/fal/webhook");
  });
});

describe("falSubmitTargeting webhook target rewriting", () => {
  it("adds fal_webhook only to trusted Fal queue submit targets", () => {
    const rewritten = withWebhookTargets(
      [
        { submitUrl: "https://queue.fal.run/fal-ai/flux/dev" },
        { submitUrl: "https://example.invalid/submit" },
      ],
      "https://shortpulse.test/api/fal/webhook"
    );

    expect(rewritten[0]?.submitUrl).toContain("fal_webhook=");
    expect(rewritten[1]?.submitUrl).toBe("https://example.invalid/submit");
  });
});
