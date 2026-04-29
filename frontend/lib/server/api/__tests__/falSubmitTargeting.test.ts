import { describe, expect, it } from "vitest";
import type { FalRuntimeFlags } from "../falRuntimeFlags";
import {
  readQueuedWebhookCallbackUrl,
  resolveWebhookCallbackUrl,
  withWebhookTargets,
} from "../falSubmitTargeting";

const createFlags = (overrides: Partial<FalRuntimeFlags> = {}): FalRuntimeFlags => ({
  modelAllowlist: new Set(["*"]),
  reconcilerEnabled: true,
  reconcilerCronSecret: "secret",
  reconcilerBatchSize: 10,
  reconcilerMaxAttempts: 5,
  reconcilerMinAgeSeconds: 0,
  reconcilerLeaseSeconds: 120,
  circuitBreakerEnabled: false,
  circuitBreakerThreshold15m: 20,
  publicApiBaseUrl: "https://shortpulse.test",
  admission: {
    mode: "off",
    globalMax: 4,
    tierLimits: {
      video_long: 2,
      image_heavy: 3,
      image_standard: 4,
    },
    retryAfterSeconds: 20,
    sharedProviderEnabled: false,
    sharedProviderGlobalMax: 4,
  },
  reservationCleanupEnabled: true,
  reservationCleanupMinAgeSeconds: 900,
  reservationCleanupBatchSize: 200,
  admissionAtomicEnabled: false,
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

describe("falSubmitTargeting webhook callback", () => {
  it("returns callback URL when integration is active and a public base URL exists", () => {
    const callback = resolveWebhookCallbackUrl(createFlags());
    expect(callback).toBe("https://shortpulse.test/api/fal/webhook");
  });

  it("uses the public API base URL when request host is unavailable", () => {
    const callback = resolveWebhookCallbackUrl(
      createFlags({
        publicApiBaseUrl: "https://shortpulse-preview.test",
      })
    );
    expect(callback).toBe("https://shortpulse-preview.test/api/fal/webhook");
  });

  it("prefers the active request host for public deployments", () => {
    const callback = resolveWebhookCallbackUrl(createFlags(), {
      requestHeaders: {
        host: "shortpulse-git-working-development-kirk-artmans-projects.vercel.app",
        "x-forwarded-proto": "https",
      },
    });

    expect(callback).toBe(
      "https://shortpulse-git-working-development-kirk-artmans-projects.vercel.app/api/fal/webhook"
    );
  });

  it("falls back to the configured callback base for localhost requests", () => {
    const callback = resolveWebhookCallbackUrl(
      createFlags({
        publicApiBaseUrl: "https://shortpulse-preview.test",
      }),
      {
        requestHeaders: {
          host: "localhost:3000",
        },
      }
    );

    expect(callback).toBe("https://shortpulse-preview.test/api/fal/webhook");
  });
});

describe("falSubmitTargeting queued callback metadata", () => {
  it("reads a valid persisted webhook callback URL", () => {
    expect(
      readQueuedWebhookCallbackUrl({
        fal_webhook_callback_url: "https://shortpulse.test/api/fal/webhook",
      })
    ).toBe("https://shortpulse.test/api/fal/webhook");
  });

  it("ignores invalid persisted webhook callback URLs", () => {
    expect(
      readQueuedWebhookCallbackUrl({
        fal_webhook_callback_url: "not-a-url",
      })
    ).toBeNull();
  });
});

describe("falSubmitTargeting webhook target rewriting", () => {
  it("adds Fal webhook params only to trusted Fal queue submit targets", () => {
    const rewritten = withWebhookTargets(
      [
        { submitUrl: "https://queue.fal.run/fal-ai/flux/dev" },
        { submitUrl: "https://example.invalid/submit" },
      ],
      "https://shortpulse.test/api/fal/webhook"
    );

    expect(rewritten[0]?.submitUrl).toContain("webhook_url=");
    expect(rewritten[0]?.submitUrl).toContain("fal_webhook=");
    expect(rewritten[1]?.submitUrl).toBe("https://example.invalid/submit");
  });
});
