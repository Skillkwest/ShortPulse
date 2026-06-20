import { describe, expect, it } from "vitest";

import {
  resolveModelPricingForModel,
  getDefaultModelPricingPolicyDocument,
} from "../pricingPolicy";
import { materializeImageBilledCreditPolicy } from "../materializeImageBilledCreditPolicy";
import {
  FAL_FLUX_2_KLEIN_9B_MODEL_ID,
  FAL_FLUX_2_KLEIN_AUDIO_COMPANION_ART_VARIANT_BASE_ID,
  FAL_FLUX_2_KLEIN_STYLE_PREVIEW_VARIANT_BASE_ID,
} from "../falModelIds";

const basePolicy = {
  ...getDefaultModelPricingPolicyDocument(),
  global: {
    ...getDefaultModelPricingPolicyDocument().global,
    creditUsdScale: 30,
  },
};

describe("materializeImageBilledCreditPolicy", () => {
  it("materializes canonical billed-credit rows for create and edit image variants", () => {
    const materialized = materializeImageBilledCreditPolicy(basePolicy);

    expect(
      resolveModelPricingForModel(materialized, "gpt-image-2", "create|res:medium|aspect:16:9")
        .billedCreditsOverride
    ).toBe(4);

    expect(
      resolveModelPricingForModel(
        materialized,
        "gpt-image-2",
        "edit|res:high|aspect:16:9|input_images:1|input_fidelity:high|mask:no"
      ).billedCreditsOverride
    ).toBe(12);

    expect(
      resolveModelPricingForModel(
        materialized,
        "fal-ai/bytedance/seedream/v4.5/text-to-image",
        "default|res:auto_4K|aspect:1:1"
      ).billedCreditsOverride
    ).toBe(4);

    expect(materialized.perModel["gpt-image-2"]?.runtimeAuthorities?.create_image).toEqual({
      mode: "runtime_quantity_derived",
      workflow: "create_image",
      unitBasis: "per_image",
      quantityDrivers: ["generation_count", "input_image_count"],
    });
  });

  it("materializes built-in Flux2 Klein semantic rows for runtime billing", () => {
    const materialized = materializeImageBilledCreditPolicy(basePolicy);

    expect(
      resolveModelPricingForModel(
        materialized,
        FAL_FLUX_2_KLEIN_9B_MODEL_ID,
        `${FAL_FLUX_2_KLEIN_AUDIO_COMPANION_ART_VARIANT_BASE_ID}|res:model_default|aspect:1:1`
      ).billedCreditsOverride
    ).toBe(2);

    expect(
      resolveModelPricingForModel(
        materialized,
        FAL_FLUX_2_KLEIN_9B_MODEL_ID,
        `${FAL_FLUX_2_KLEIN_STYLE_PREVIEW_VARIANT_BASE_ID}|res:model_default|aspect:1:1`
      ).billedCreditsOverride
    ).toBe(2);
  });
});
