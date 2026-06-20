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
  FAL_OMNIHUMAN_V15_MODEL_ID,
} from "../falModelIds";
import {
  KIE_KLING_30_MODEL_ID,
  KIE_SEEDANCE_2_MODEL_ID,
  KIE_SEEDANCE_2_FAST_MODEL_ID,
  KIE_VEO_31_FAST_I2V_MODEL_ID,
} from "../providerModelIds";
import { getModelConfig } from "../modelRegistry";
import { resolvePricingGridCostBreakdown } from "../pricingGridBilledCredits";
import { resolveVideoBilledCreditLookup } from "../videoBilledCredits";

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

  it("materializes canonical billed-credit rows for video variants", () => {
    const materialized = materializeImageBilledCreditPolicy(basePolicy);
    const videoModelIds = [
      KIE_VEO_31_FAST_I2V_MODEL_ID,
      KIE_KLING_30_MODEL_ID,
      KIE_SEEDANCE_2_MODEL_ID,
      KIE_SEEDANCE_2_FAST_MODEL_ID,
      FAL_OMNIHUMAN_V15_MODEL_ID,
    ];

    videoModelIds.forEach((modelId) => {
      const config = getModelConfig(modelId);
      expect(config).toBeTruthy();
      const resolutions = config?.allowedResolutions?.length
        ? config.allowedResolutions
        : [config?.defaultResolution].filter((value): value is string => Boolean(value));
      const audioOptions =
        config?.defaultAudio != null &&
        !["seedance-2-per-second", "seedance-2-fast-per-second"].includes(
          config.pricingStrategy ?? ""
        )
          ? [true, false]
          : [undefined];
      const videoInputOptions = [KIE_SEEDANCE_2_MODEL_ID, KIE_SEEDANCE_2_FAST_MODEL_ID].includes(
        modelId
      )
        ? [false, true]
        : [undefined];

      resolutions.forEach((resolution) => {
        audioOptions.forEach((audio) => {
          videoInputOptions.forEach((videoInput) => {
            const params = {
              resolution,
              ...(audio != null ? { audio } : {}),
              ...(videoInput != null ? { inputVideoCount: videoInput ? 1 : 0 } : {}),
            };
            const gridBreakdown = resolvePricingGridCostBreakdown({
              modelId,
              params,
              pricingPolicy: basePolicy,
            });
            const strictVideoBreakdown = resolveVideoBilledCreditLookup({
              modelId,
              params,
              pricingPolicy: materialized,
            }).breakdown;

            expect(strictVideoBreakdown).toMatchObject({
              variantId: gridBreakdown?.variantId,
            });
            expect(strictVideoBreakdown?.credits).toBeGreaterThan(0);
          });
        });
      });
    });
  });
});
