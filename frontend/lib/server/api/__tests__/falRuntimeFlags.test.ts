import { afterEach, describe, expect, it } from "vitest";
import { readFalRuntimeFlags } from "../falRuntimeFlags";

const ORIGINAL_ENV = { ...process.env };

describe("readFalRuntimeFlags admission config", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("returns default admission values when env is unset", () => {
    delete process.env.SHORTPULSE_FAL_ADMISSION_MODE;
    delete process.env.SHORTPULSE_FAL_ADMISSION_GLOBAL_MAX;
    delete process.env.SHORTPULSE_FAL_ADMISSION_TIER_LIMITS_JSON;
    delete process.env.SHORTPULSE_FAL_ADMISSION_RETRY_AFTER_SECONDS;
    delete process.env.SHORTPULSE_FAL_ADMISSION_SHARED_PROVIDER_ENABLED;
    delete process.env.SHORTPULSE_FAL_ADMISSION_SHARED_PROVIDER_GLOBAL_MAX;
    delete process.env.SHORTPULSE_FAL_RECONCILER_ENABLED;
    delete process.env.SHORTPULSE_FAL_RESERVATION_CLEANUP_ENABLED;
    delete process.env.SHORTPULSE_FAL_RESERVATION_CLEANUP_MIN_AGE_SECONDS;
    delete process.env.SHORTPULSE_FAL_RESERVATION_CLEANUP_BATCH_SIZE;
    delete process.env.SHORTPULSE_FAL_PROVIDER_ATTACHED_RESERVATION_CLEANUP_ENABLED;
    delete process.env.SHORTPULSE_FAL_PROVIDER_ATTACHED_RESERVATION_CLEANUP_MIN_AGE_SECONDS;
    delete process.env.SHORTPULSE_FAL_PROVIDER_ATTACHED_RESERVATION_ORPHAN_MIN_AGE_SECONDS;
    delete process.env.SHORTPULSE_FAL_PROJECTION_REPAIR_INTERVAL_SECONDS;
    delete process.env.SHORTPULSE_FAL_QUEUE_BASE_BACKOFF_SECONDS;
    delete process.env.SHORTPULSE_FAL_QUEUE_MAX_WAIT_SECONDS;
    delete process.env.SHORTPULSE_FAL_RECOVERY_PROBE_TIMEOUT_MS;
    delete process.env.SHORTPULSE_FAL_STATUS_TRANSIENT_FAILURES_ENABLED;
    delete process.env.SHORTPULSE_FAL_NO_MEDIA_EXHAUST_MIN_AGE_SECONDS;
    delete process.env.SHORTPULSE_FAL_RUNNING_EXHAUST_MIN_AGE_SECONDS;
    delete process.env.SHORTPULSE_FAL_RUNNING_HARD_TIMEOUT_SECONDS;

    const flags = readFalRuntimeFlags();
    expect(flags.admission).toEqual({
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
    });
    expect(flags.reservationCleanupEnabled).toBe(false);
    expect(flags.reservationCleanupMinAgeSeconds).toBe(900);
    expect(flags.reservationCleanupBatchSize).toBe(200);
    expect(flags.providerAttachedReservationCleanupEnabled).toBe(false);
    expect(flags.providerAttachedReservationCleanupMinAgeSeconds).toBe(7200);
    expect(flags.providerAttachedReservationOrphanMinAgeSeconds).toBe(86400);
    expect(flags.projectionRepairIntervalSeconds).toBe(300);
    expect(flags.queueBaseBackoffSeconds).toBe(3);
    expect(flags.queueMaxWaitSeconds).toBe(1200);
    expect(flags.recoveryProbeTimeoutMs).toBe(15000);
    expect(flags.statusTransientFailuresEnabled).toBe(false);
    expect(flags.noMediaExhaustMinAgeSeconds).toBe(7200);
    expect(flags.runningExhaustMinAgeSeconds).toBe(7200);
    expect(flags.runningHardTimeoutSeconds).toBe(0);
  });

  it("parses admission env overrides with per-tier fallback", () => {
    process.env.SHORTPULSE_FAL_ADMISSION_MODE = "enforce";
    process.env.SHORTPULSE_FAL_ADMISSION_GLOBAL_MAX = "6";
    process.env.SHORTPULSE_FAL_ADMISSION_TIER_LIMITS_JSON = '{"video_long":3,"image_heavy":2}';
    process.env.SHORTPULSE_FAL_ADMISSION_RETRY_AFTER_SECONDS = "15";
    process.env.SHORTPULSE_FAL_ADMISSION_SHARED_PROVIDER_ENABLED = "true";
    process.env.SHORTPULSE_FAL_ADMISSION_SHARED_PROVIDER_GLOBAL_MAX = "10";
    process.env.SHORTPULSE_FAL_RECONCILER_ENABLED = "true";
    process.env.SHORTPULSE_FAL_RESERVATION_CLEANUP_ENABLED = "false";
    process.env.SHORTPULSE_FAL_RESERVATION_CLEANUP_MIN_AGE_SECONDS = "1200";
    process.env.SHORTPULSE_FAL_RESERVATION_CLEANUP_BATCH_SIZE = "350";
    process.env.SHORTPULSE_FAL_PROVIDER_ATTACHED_RESERVATION_CLEANUP_ENABLED = "true";
    process.env.SHORTPULSE_FAL_PROVIDER_ATTACHED_RESERVATION_CLEANUP_MIN_AGE_SECONDS = "5400";
    process.env.SHORTPULSE_FAL_PROVIDER_ATTACHED_RESERVATION_ORPHAN_MIN_AGE_SECONDS = "90000";
    process.env.SHORTPULSE_FAL_PROJECTION_REPAIR_INTERVAL_SECONDS = "900";
    process.env.SHORTPULSE_FAL_QUEUE_BASE_BACKOFF_SECONDS = "9";
    process.env.SHORTPULSE_FAL_QUEUE_MAX_WAIT_SECONDS = "1800";
    process.env.SHORTPULSE_FAL_RECOVERY_PROBE_TIMEOUT_MS = "22000";
    process.env.SHORTPULSE_FAL_STATUS_TRANSIENT_FAILURES_ENABLED = "true";
    process.env.SHORTPULSE_FAL_NO_MEDIA_EXHAUST_MIN_AGE_SECONDS = "10800";
    process.env.SHORTPULSE_FAL_RUNNING_EXHAUST_MIN_AGE_SECONDS = "14400";
    process.env.SHORTPULSE_FAL_RUNNING_HARD_TIMEOUT_SECONDS = "900";

    const flags = readFalRuntimeFlags();
    expect(flags.admission).toEqual({
      mode: "enforce",
      globalMax: 6,
      tierLimits: {
        video_long: 3,
        image_heavy: 2,
        image_standard: 4,
      },
      retryAfterSeconds: 15,
      sharedProviderEnabled: true,
      sharedProviderGlobalMax: 10,
    });
    expect(flags.reservationCleanupEnabled).toBe(false);
    expect(flags.reservationCleanupMinAgeSeconds).toBe(1200);
    expect(flags.reservationCleanupBatchSize).toBe(350);
    expect(flags.providerAttachedReservationCleanupEnabled).toBe(true);
    expect(flags.providerAttachedReservationCleanupMinAgeSeconds).toBe(5400);
    expect(flags.providerAttachedReservationOrphanMinAgeSeconds).toBe(90000);
    expect(flags.projectionRepairIntervalSeconds).toBe(900);
    expect(flags.queueBaseBackoffSeconds).toBe(9);
    expect(flags.queueMaxWaitSeconds).toBe(1800);
    expect(flags.recoveryProbeTimeoutMs).toBe(22000);
    expect(flags.statusTransientFailuresEnabled).toBe(true);
    expect(flags.noMediaExhaustMinAgeSeconds).toBe(10800);
    expect(flags.runningExhaustMinAgeSeconds).toBe(14400);
    expect(flags.runningHardTimeoutSeconds).toBe(900);
  });

  it("enables reservation cleanup by default when reconciler is enabled", () => {
    process.env.SHORTPULSE_FAL_RECONCILER_ENABLED = "true";
    delete process.env.SHORTPULSE_FAL_RESERVATION_CLEANUP_ENABLED;
    delete process.env.SHORTPULSE_FAL_PROVIDER_ATTACHED_RESERVATION_CLEANUP_ENABLED;

    const flags = readFalRuntimeFlags();
    expect(flags.reconcilerEnabled).toBe(true);
    expect(flags.reservationCleanupEnabled).toBe(true);
    expect(flags.providerAttachedReservationCleanupEnabled).toBe(true);
  });

  it("uses the public API base URL when configured", () => {
    process.env.SHORTPULSE_PUBLIC_API_BASE_URL = "https://shortpulse-preview.test";

    const flags = readFalRuntimeFlags();
    expect(flags.publicApiBaseUrl).toBe("https://shortpulse-preview.test");
  });

  it("rejects mismatched public origin env values", () => {
    process.env.APP_BASE_URL = "https://www.shortpulse.ai";
    process.env.SHORTPULSE_PUBLIC_API_BASE_URL = "https://preview.shortpulse.test";

    expect(() => readFalRuntimeFlags()).toThrow(
      "APP_BASE_URL and SHORTPULSE_PUBLIC_API_BASE_URL must match when both are configured."
    );
  });
});
