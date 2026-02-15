import { describe, expect, it } from "vitest";
import { buildPricingParams } from "../../lib/server/api/generationBilling/pricingParams";

describe("generationBilling pricing params normalization", () => {
  it("preserves explicit image dimensions for per-MP pricing models", () => {
    const params = buildPricingParams("fal/flux-2/edit", {
      image_size: { width: 4096, height: 4096 },
    });

    expect(params.imageWidth).toBe(4096);
    expect(params.imageHeight).toBe(4096);
    expect(params.aspect).toBe("1:1");
  });

  it("normalizes invalid seedance text duration/resolution to safe billable values", () => {
    const params = buildPricingParams("fal-ai/bytedance/seedance/v1.5/pro/text-to-video", {
      duration: 3,
      resolution: "ultra",
    });

    expect(params.durationSeconds).toBe(4);
    expect(params.resolution).toBe("1080p");
  });

  it("rounds non-enum duration to the next allowed duration bucket", () => {
    const params = buildPricingParams("fal-ai/sora-2/text-to-video/pro", {
      duration: 11,
      resolution: "720p",
    });

    expect(params.durationSeconds).toBe(12);
    expect(params.resolution).toBe("720p");
  });
});
