import { describe, expect, it } from "vitest";
import { normalizeDurationForModel } from "../modelDurationConstraints";
import { KIE_KLING_30_MODEL_ID, KIE_VEO_31_FAST_I2V_MODEL_ID } from "../providerModelIds";

describe("normalizeDurationForModel", () => {
  it("keeps supported Veo durations unchanged", () => {
    expect(normalizeDurationForModel(4, KIE_VEO_31_FAST_I2V_MODEL_ID)).toBe(4);
    expect(normalizeDurationForModel(6, KIE_VEO_31_FAST_I2V_MODEL_ID)).toBe(6);
    expect(normalizeDurationForModel(8, KIE_VEO_31_FAST_I2V_MODEL_ID)).toBe(8);
  });

  it("promotes stale Veo durations to the next supported duration", () => {
    expect(normalizeDurationForModel(5, KIE_VEO_31_FAST_I2V_MODEL_ID)).toBe(6);
    expect(normalizeDurationForModel(7, KIE_VEO_31_FAST_I2V_MODEL_ID)).toBe(8);
  });

  it("clamps lower Kling durations up to the first supported option", () => {
    expect(normalizeDurationForModel(2, KIE_KLING_30_MODEL_ID)).toBe(3);
  });
});
