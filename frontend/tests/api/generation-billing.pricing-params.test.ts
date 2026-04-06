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

  it("maps enable_google_search to webSearch for nano-banana pricing", () => {
    const params = buildPricingParams("fal-ai/nano-banana-pro", {
      enable_google_search: true,
    });

    expect(params.webSearch).toBe(true);
  });

  it("maps enable_web_search alias for nano-banana-2 pricing", () => {
    const params = buildPricingParams("fal-ai/nano-banana-2", {
      enable_web_search: true,
    });

    expect(params.webSearch).toBe(true);
  });

  it("normalizes 0.5K resolution for nano-banana-2", () => {
    const params = buildPricingParams("fal-ai/nano-banana-2/edit", {
      resolution: "0.5k",
    });

    expect(params.resolution).toBe("0.5K");
  });

  it("preserves auto_3K resolution for seedream 5 lite", () => {
    const params = buildPricingParams("fal-ai/bytedance/seedream/v5/lite/edit", {
      image_size: "auto_3K",
    });

    expect(params.resolution).toBe("auto_3K");
  });
});
