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
    delete process.env.SHORTPULSE_FAL_RECONCILER_ENABLED;
    delete process.env.SHORTPULSE_FAL_RESERVATION_CLEANUP_ENABLED;
    delete process.env.SHORTPULSE_FAL_RESERVATION_CLEANUP_MIN_AGE_SECONDS;
    delete process.env.SHORTPULSE_FAL_RESERVATION_CLEANUP_BATCH_SIZE;
    delete process.env.SHORTPULSE_FAL_ADMISSION_ATOMIC_ENABLED;

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
    });
    expect(flags.reservationCleanupEnabled).toBe(false);
    expect(flags.reservationCleanupMinAgeSeconds).toBe(900);
    expect(flags.reservationCleanupBatchSize).toBe(200);
    expect(flags.admissionAtomicEnabled).toBe(false);
  });

  it("parses admission env overrides with per-tier fallback", () => {
    process.env.SHORTPULSE_FAL_ADMISSION_MODE = "enforce";
    process.env.SHORTPULSE_FAL_ADMISSION_GLOBAL_MAX = "6";
    process.env.SHORTPULSE_FAL_ADMISSION_TIER_LIMITS_JSON = '{"video_long":3,"image_heavy":2}';
    process.env.SHORTPULSE_FAL_ADMISSION_RETRY_AFTER_SECONDS = "15";
    process.env.SHORTPULSE_FAL_RECONCILER_ENABLED = "true";
    process.env.SHORTPULSE_FAL_RESERVATION_CLEANUP_ENABLED = "false";
    process.env.SHORTPULSE_FAL_RESERVATION_CLEANUP_MIN_AGE_SECONDS = "1200";
    process.env.SHORTPULSE_FAL_RESERVATION_CLEANUP_BATCH_SIZE = "350";
    process.env.SHORTPULSE_FAL_ADMISSION_ATOMIC_ENABLED = "true";

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
    });
    expect(flags.reservationCleanupEnabled).toBe(false);
    expect(flags.reservationCleanupMinAgeSeconds).toBe(1200);
    expect(flags.reservationCleanupBatchSize).toBe(350);
    expect(flags.admissionAtomicEnabled).toBe(true);
  });

  it("enables reservation cleanup by default when reconciler is enabled", () => {
    process.env.SHORTPULSE_FAL_RECONCILER_ENABLED = "true";
    delete process.env.SHORTPULSE_FAL_RESERVATION_CLEANUP_ENABLED;

    const flags = readFalRuntimeFlags();
    expect(flags.reconcilerEnabled).toBe(true);
    expect(flags.reservationCleanupEnabled).toBe(true);
  });
});
