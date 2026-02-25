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
  });

  it("parses admission env overrides with per-tier fallback", () => {
    process.env.SHORTPULSE_FAL_ADMISSION_MODE = "enforce";
    process.env.SHORTPULSE_FAL_ADMISSION_GLOBAL_MAX = "6";
    process.env.SHORTPULSE_FAL_ADMISSION_TIER_LIMITS_JSON = '{"video_long":3,"image_heavy":2}';
    process.env.SHORTPULSE_FAL_ADMISSION_RETRY_AFTER_SECONDS = "15";

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
  });
});
