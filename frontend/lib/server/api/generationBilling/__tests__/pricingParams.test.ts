import { describe, expect, it } from "vitest";

import { KIE_KLING_30_MOTION_CONTROL_VARIANT_ID } from "../../../../model-runtime/klingMotionControlPricing";
import { KIE_KLING_30_MODEL_ID } from "../../../../model-runtime/providerModelIds";
import { buildPricingParams } from "../pricingParams";

describe("buildPricingParams", () => {
  it("counts provider URL-array image inputs for reference-aware billing", () => {
    expect(
      buildPricingParams("fal-ai/nano-banana-2/edit", {
        input_urls: Array.from(
          { length: 10 },
          (_, index) => `https://example.com/ref-${index}.png`
        ),
      })
    ).toEqual(
      expect.objectContaining({
        inputImageCount: 10,
      })
    );

    expect(
      buildPricingParams("fal-ai/nano-banana-2/edit", {
        image_urls: ["https://example.com/ref-1.png", null, "  ", "https://example.com/ref-2.png"],
      })
    ).toEqual(
      expect.objectContaining({
        inputImageCount: 2,
      })
    );
  });

  it("prefers explicit input image count when submission payload provides it", () => {
    expect(
      buildPricingParams("fal-ai/nano-banana-2/edit", {
        input_image_count: 10,
        input_urls: ["https://example.com/ref-1.png"],
      })
    ).toEqual(
      expect.objectContaining({
        inputImageCount: 10,
      })
    );
  });

  it("maps Kling Motion Control mode resolution onto the canonical billing resolution", () => {
    expect(
      buildPricingParams(KIE_KLING_30_MODEL_ID, {
        model: "kling-3.0/motion-control",
        mode: "720p",
        generate_audio: true,
      })
    ).toEqual(
      expect.objectContaining({
        variantBaseId: KIE_KLING_30_MOTION_CONTROL_VARIANT_ID,
        durationSeconds: 10,
        resolution: "720p",
        mode: "720p",
        audio: true,
      })
    );
  });
});
