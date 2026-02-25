import { describe, expect, it } from "vitest";
import { resolveGenerationAdmissionTier } from "../generationAdmissionTiers";

describe("generationAdmissionTiers", () => {
  it("resolves video models to video_long tier", () => {
    expect(resolveGenerationAdmissionTier("fal-ai/veo3.1")).toBe("video_long");
    expect(resolveGenerationAdmissionTier("fal-ai/kling-video/v3/pro/text-to-video")).toBe(
      "video_long"
    );
  });

  it("resolves heavy image models to image_heavy tier", () => {
    expect(resolveGenerationAdmissionTier("fal-ai/nano-banana-pro")).toBe("image_heavy");
    expect(resolveGenerationAdmissionTier("fal-ai/bytedance/seedream/v4.5/edit")).toBe(
      "image_heavy"
    );
  });

  it("falls back to image_standard for standard image models", () => {
    expect(resolveGenerationAdmissionTier("fal-ai/nano-banana")).toBe("image_standard");
    expect(resolveGenerationAdmissionTier("fal/flux-2")).toBe("image_standard");
  });
});
