import { describe, expect, it } from "vitest";
import { KIE_KLING_30_MODEL_ID, KIE_VEO_31_FAST_I2V_MODEL_ID } from "../providerModelIds";
import { resolveGenerationAdmissionTier } from "../generationAdmissionTiers";

describe("generationAdmissionTiers", () => {
  it("resolves video models to video_long tier", () => {
    expect(resolveGenerationAdmissionTier(KIE_VEO_31_FAST_I2V_MODEL_ID)).toBe("video_long");
    expect(resolveGenerationAdmissionTier(KIE_KLING_30_MODEL_ID)).toBe("video_long");
  });

  it("resolves heavy image models to image_heavy tier", () => {
    expect(resolveGenerationAdmissionTier("fal-ai/nano-banana-pro")).toBe("image_heavy");
    expect(resolveGenerationAdmissionTier("fal-ai/bytedance/seedream/v4.5/edit")).toBe(
      "image_heavy"
    );
  });

  it("falls back to image_standard for standard image models", () => {
    expect(resolveGenerationAdmissionTier("fal-ai/nano-banana")).toBe("image_standard");
    expect(resolveGenerationAdmissionTier("fal-ai/flux-2/klein/9b")).toBe("image_standard");
  });
});
