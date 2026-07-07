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
  KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_MODEL_ID,
  KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID,
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
      resolveModelPricingForModel(
        materialized,
        KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_MODEL_ID,
        "default|res:1K|aspect:16:9"
      ).billedCreditsOverride
    ).toBe(2);

    expect(
      resolveModelPricingForModel(
        materialized,
        KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_MODEL_ID,
        "default|res:1K|aspect:4:5"
      ).billedCreditsOverride
    ).toBe(2);

    expect(
      resolveModelPricingForModel(
        materialized,
        KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID,
        "edit|res:1K|aspect:4:5"
      ).billedCreditsOverride
    ).toBe(2);

    expect(
      resolveModelPricingForModel(
        materialized,
        KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID,
        "edit|res:1K|aspect:5:4"
      ).billedCreditsOverride
    ).toBe(2);

    expect(
      resolveModelPricingForModel(
        materialized,
        "fal-ai/bytedance/seedream/v4.5/text-to-image",
        "default|res:auto_4K|aspect:1:1"
      ).billedCreditsOverride
    ).toBe(4);
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

  it("resolves canonical billed-credit rows for video variants without duration expansion", () => {
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

  it("resolves the exact Seedance 2 pricing-grid value for 720p 12s no-video-input runs", () => {
    const materialized = materializeImageBilledCreditPolicy(basePolicy);
    const params = {
      durationSeconds: 12,
      resolution: "720p",
      inputVideoCount: 0,
    };
    const strictVideoBreakdown = resolveVideoBilledCreditLookup({
      modelId: KIE_SEEDANCE_2_MODEL_ID,
      params,
      pricingPolicy: materialized,
    }).breakdown;

    expect(strictVideoBreakdown).toMatchObject({
      credits: 119,
      variantId: "default|res:720p|aspect:16:9|audio:on",
    });
    expect(materialized.perModel[KIE_SEEDANCE_2_MODEL_ID]?.variants).toBeUndefined();
  });
});
