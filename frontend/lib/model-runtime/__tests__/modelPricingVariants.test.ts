import { describe, expect, it } from "vitest";

import { buildModelPricingVariantId, resolveModelPricingVariantId } from "../modelPricingVariants";

describe("modelPricingVariants", () => {
  it("encodes Create edit-specific dimensions into variant ids", () => {
    expect(
      buildModelPricingVariantId({
        baseVariantId: "edit",
        aspect: "16:9",
        resolution: "medium",
        inputImageCount: 3,
        inputFidelity: "high",
        maskPresent: true,
      })
    ).toBe("edit|res:medium|aspect:16:9|input_images:3|input_fidelity:high|mask:yes");
  });

  it("resolves GPT Image 2 edit params into a distinct variant id", () => {
    expect(
      resolveModelPricingVariantId({
        modelId: "gpt-image-2",
        aspect: "16:9",
        resolution: "medium",
        inputImageCount: 3,
        inputFidelity: "high",
        maskPresent: false,
      })
    ).toBe("edit|res:medium|aspect:16:9|input_images:3|input_fidelity:high|mask:no");
  });
});
