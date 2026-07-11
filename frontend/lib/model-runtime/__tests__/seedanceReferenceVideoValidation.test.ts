/**
 * Verifies shared Seedance reference-video duration admission rules.
 */
import { describe, expect, it } from "vitest";

import { KIE_SEEDANCE_2_MODEL_ID } from "../providerModelIds";
import { validateSeedanceReferenceVideoDuration } from "../seedanceReferenceVideoValidation";

describe("seedanceReferenceVideoValidation", () => {
  it("does not require duration when no video reference is present", () => {
    expect(
      validateSeedanceReferenceVideoDuration({
        modelId: KIE_SEEDANCE_2_MODEL_ID,
        inputVideoCount: 0,
        inputVideoDurationSeconds: null,
      })
    ).toBeNull();
  });

  it("requires positive duration evidence for a video reference", () => {
    expect(
      validateSeedanceReferenceVideoDuration({
        modelId: KIE_SEEDANCE_2_MODEL_ID,
        inputVideoCount: 1,
        inputVideoDurationSeconds: null,
      })
    ).toMatchObject({ code: "SEEDANCE_REFERENCE_VIDEO_DURATION_REQUIRED" });
  });

  it("rejects aggregate duration above fifteen seconds", () => {
    expect(
      validateSeedanceReferenceVideoDuration({
        modelId: KIE_SEEDANCE_2_MODEL_ID,
        inputVideoCount: 2,
        inputVideoDurationSeconds: 15.01,
      })
    ).toMatchObject({ code: "SEEDANCE_REFERENCE_VIDEO_DURATION_EXCEEDED" });
  });

  it("accepts positive duration evidence at the limit", () => {
    expect(
      validateSeedanceReferenceVideoDuration({
        modelId: KIE_SEEDANCE_2_MODEL_ID,
        inputVideoCount: 1,
        inputVideoDurationSeconds: 15,
      })
    ).toBeNull();
  });
});
