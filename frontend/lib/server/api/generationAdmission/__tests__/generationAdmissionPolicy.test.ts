import { describe, expect, it } from "vitest";
import {
  DEFAULT_GENERATION_ADMISSION_GLOBAL_MAX,
  DEFAULT_GENERATION_ADMISSION_MODE,
  DEFAULT_GENERATION_ADMISSION_RETRY_AFTER_SECONDS,
  DEFAULT_GENERATION_ADMISSION_TIER_LIMITS,
  evaluateGenerationAdmissionDecision,
  parseGenerationAdmissionGlobalMax,
  parseGenerationAdmissionMode,
  parseGenerationAdmissionRetryAfterSeconds,
  parseGenerationAdmissionTierLimits,
} from "../generationAdmissionPolicy";

describe("generationAdmissionPolicy", () => {
  it("parses admission mode with safe fallback", () => {
    expect(parseGenerationAdmissionMode(undefined)).toBe(DEFAULT_GENERATION_ADMISSION_MODE);
    expect(parseGenerationAdmissionMode("shadow")).toBe("shadow");
    expect(parseGenerationAdmissionMode("ENFORCE")).toBe("enforce");
    expect(parseGenerationAdmissionMode("invalid")).toBe(DEFAULT_GENERATION_ADMISSION_MODE);
  });

  it("parses global max and retry-after with minimum bounds", () => {
    expect(parseGenerationAdmissionGlobalMax(undefined)).toBe(
      DEFAULT_GENERATION_ADMISSION_GLOBAL_MAX
    );
    expect(parseGenerationAdmissionGlobalMax("6")).toBe(6);
    expect(parseGenerationAdmissionGlobalMax("0")).toBe(1);

    expect(parseGenerationAdmissionRetryAfterSeconds(undefined)).toBe(
      DEFAULT_GENERATION_ADMISSION_RETRY_AFTER_SECONDS
    );
    expect(parseGenerationAdmissionRetryAfterSeconds("25")).toBe(25);
    expect(parseGenerationAdmissionRetryAfterSeconds("-2")).toBe(1);
  });

  it("parses tier limits from JSON with per-tier fallback", () => {
    expect(parseGenerationAdmissionTierLimits(undefined)).toEqual(
      DEFAULT_GENERATION_ADMISSION_TIER_LIMITS
    );
    expect(parseGenerationAdmissionTierLimits('{"video_long":5}')).toEqual({
      video_long: 5,
      image_heavy: DEFAULT_GENERATION_ADMISSION_TIER_LIMITS.image_heavy,
      image_standard: DEFAULT_GENERATION_ADMISSION_TIER_LIMITS.image_standard,
    });
    expect(parseGenerationAdmissionTierLimits('{"image_heavy":"2","image_standard":0}')).toEqual({
      video_long: DEFAULT_GENERATION_ADMISSION_TIER_LIMITS.video_long,
      image_heavy: 2,
      image_standard: 1,
    });
    expect(parseGenerationAdmissionTierLimits("not-json")).toEqual(
      DEFAULT_GENERATION_ADMISSION_TIER_LIMITS
    );
  });

  it("evaluates allow/deny matrix with global+tier overages", () => {
    expect(
      evaluateGenerationAdmissionDecision({
        mode: "enforce",
        retryAfterSeconds: 20,
        snapshot: {
          globalActive: 4,
          globalMax: 4,
          tier: "image_standard",
          tierActive: 4,
          tierMax: 4,
        },
      })
    ).toEqual(
      expect.objectContaining({
        allowed: true,
        enforced: false,
        wouldLimit: false,
        reason: null,
      })
    );

    expect(
      evaluateGenerationAdmissionDecision({
        mode: "enforce",
        retryAfterSeconds: 20,
        snapshot: {
          globalActive: 5,
          globalMax: 4,
          tier: "image_standard",
          tierActive: 4,
          tierMax: 4,
        },
      })
    ).toEqual(
      expect.objectContaining({
        allowed: false,
        enforced: true,
        wouldLimit: true,
        reason: "global_limit",
      })
    );

    expect(
      evaluateGenerationAdmissionDecision({
        mode: "shadow",
        retryAfterSeconds: 20,
        snapshot: {
          globalActive: 6,
          globalMax: 4,
          tier: "video_long",
          tierActive: 3,
          tierMax: 2,
        },
      })
    ).toEqual(
      expect.objectContaining({
        allowed: true,
        enforced: false,
        wouldLimit: true,
        reason: "global_and_tier_limit",
      })
    );
  });
});
