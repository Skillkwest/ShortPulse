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
import { getDefaultAdminPricingCustomRowsDocument } from "../adminPricingCustomRows";
import { resolveModelPricingVariantId } from "../modelPricingVariants";
import {
  ELEVENLABS_MUSIC_MODEL_ID,
  ELEVENLABS_SOUND_EFFECTS_AUTO_DURATION_VARIANT_ID,
  ELEVENLABS_SOUND_EFFECTS_EXPLICIT_DURATION_VARIANT_ID,
  ELEVENLABS_SOUND_EFFECTS_MODEL_ID,
  ELEVENLABS_VOICEOVER_MODEL_ID,
  ELEVENLABS_VOICE_CHANGER_MODEL_ID,
} from "../elevenLabsModels";

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

  it("materializes the active custom-row calculator overrides into runtime billed credits", () => {
    const customRows = getDefaultAdminPricingCustomRowsDocument();
    const row = customRows.rowsByModel[FAL_FLUX_2_KLEIN_9B_MODEL_ID]?.[0];
    expect(row).toBeDefined();
    if (!row) return;
    row.overrides.providerUsdOverride = 0.1;
    row.overrides.markupBps = 0;

    const materialized = materializeImageBilledCreditPolicy(basePolicy, customRows);

    expect(
      resolveModelPricingForModel(materialized, FAL_FLUX_2_KLEIN_9B_MODEL_ID, row.variantId)
    ).toMatchObject({
      providerUsdOverride: 0.1,
      markupBps: 0,
      billedCreditsOverride: 3,
    });
  });

  it("recomputes a custom-row billed price when an already-published policy is republished", () => {
    const customRows = getDefaultAdminPricingCustomRowsDocument();
    const row = customRows.rowsByModel[FAL_FLUX_2_KLEIN_9B_MODEL_ID]?.[0];
    expect(row).toBeDefined();
    if (!row) return;
    row.overrides.providerUsdOverride = 0.1;
    row.overrides.markupBps = 0;

    const firstPublication = materializeImageBilledCreditPolicy(basePolicy, customRows);
    row.overrides.providerUsdOverride = 0.2;
    const secondPublication = materializeImageBilledCreditPolicy(firstPublication, customRows);

    expect(
      resolveModelPricingForModel(firstPublication, FAL_FLUX_2_KLEIN_9B_MODEL_ID, row.variantId)
        .billedCreditsOverride
    ).toBe(3);
    expect(
      resolveModelPricingForModel(secondPublication, FAL_FLUX_2_KLEIN_9B_MODEL_ID, row.variantId)
    ).toMatchObject({
      providerUsdOverride: 0.2,
      billedCreditsOverride: 6,
    });
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
              durationSeconds: config?.defaultDurationSeconds ?? 1,
              ...(audio != null ? { audio } : {}),
              ...(videoInput != null ? { inputVideoCount: videoInput ? 1 : 0 } : {}),
              ...(videoInput === true
                ? { inputVideoDurationSeconds: config?.defaultDurationSeconds ?? 5 }
                : {}),
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
      variantId: "default|res:720p|aspect:16:9|audio:on|video_input:none",
    });
    expect(
      materialized.perModel[KIE_SEEDANCE_2_MODEL_ID]?.variants?.[
        "default|res:720p|aspect:16:9|audio:on|video_input:none"
      ]
    ).toMatchObject({
      billedCreditsQuantityRule: {
        costCreditsPerUnit: 6.15,
        markupBps: 6_000,
        roundingIncrement: 1,
        quantityBasis: "per_second",
      },
    });
  });

  it("publishes active custom Seedance video-row rate overrides", () => {
    const customRows = getDefaultAdminPricingCustomRowsDocument();
    const variantId = resolveModelPricingVariantId({
      modelId: KIE_SEEDANCE_2_MODEL_ID,
      variantBaseId: "custom_reference_video",
      resolution: "720p",
      inputVideoCount: 1,
    });
    customRows.rowsByModel[KIE_SEEDANCE_2_MODEL_ID] = [
      {
        displayRowId: "custom:seedance-reference-video",
        label: "Reference video",
        variantId,
        spec: {
          baseVariantId: "custom_reference_video",
          aspect: null,
          resolution: "720p",
          audio: null,
          videoInput: true,
          inputImageCount: null,
          inputFidelity: null,
          maskPresent: null,
        },
        overrides: {
          markupBps: 0,
          providerUsdOverride: null,
          providerUsdPerSecondOverride: 0.2,
        },
      },
    ];

    const materialized = materializeImageBilledCreditPolicy(basePolicy, customRows);

    expect(
      resolveModelPricingForModel(materialized, KIE_SEEDANCE_2_MODEL_ID, variantId)
        .providerUsdPerSecondOverride
    ).toBe(0.2);
  });

  it("publishes explicit billed-credit rules for every billable ElevenLabs audio row", () => {
    const materialized = materializeImageBilledCreditPolicy(basePolicy);
    const variantsFor = (modelId: string) =>
      Object.entries(materialized.perModel[modelId]?.variants ?? {});

    expect(
      variantsFor(ELEVENLABS_MUSIC_MODEL_ID).some(
        ([, row]) =>
          row.billedCreditsQuantityRule?.costCreditsPerUnit === 0.075 &&
          row.billedCreditsQuantityRule.quantityBasis === "per_second"
      )
    ).toBe(true);
    expect(
      variantsFor(ELEVENLABS_VOICE_CHANGER_MODEL_ID).some(
        ([, row]) =>
          row.billedCreditsQuantityRule?.costCreditsPerUnit === 0.06 &&
          row.billedCreditsQuantityRule.quantityBasis === "per_second"
      )
    ).toBe(true);
    expect(
      variantsFor(ELEVENLABS_VOICEOVER_MODEL_ID).some(
        ([, row]) =>
          row.billedCreditsQuantityRule?.costCreditsPerUnit === 3 &&
          row.billedCreditsQuantityRule.quantityBasis === "per_1k_chars"
      )
    ).toBe(true);
    expect(
      variantsFor(ELEVENLABS_SOUND_EFFECTS_MODEL_ID).some(
        ([variantId, row]) =>
          variantId.startsWith(ELEVENLABS_SOUND_EFFECTS_AUTO_DURATION_VARIANT_ID) &&
          row.billedCreditsOverride === 7
      )
    ).toBe(true);
    expect(
      variantsFor(ELEVENLABS_SOUND_EFFECTS_MODEL_ID).some(
        ([variantId, row]) =>
          variantId.startsWith(ELEVENLABS_SOUND_EFFECTS_EXPLICIT_DURATION_VARIANT_ID) &&
          row.billedCreditsQuantityRule?.costCreditsPerUnit === 0.396 &&
          row.billedCreditsQuantityRule.quantityBasis === "per_second"
      )
    ).toBe(true);
  });

  it("recomputes published quantity rates when an active policy is republished", () => {
    const firstPublication = materializeImageBilledCreditPolicy(basePolicy);
    const changedPolicy = {
      ...firstPublication,
      global: {
        ...firstPublication.global,
        creditUsdScale: 60,
      },
    };
    const secondPublication = materializeImageBilledCreditPolicy(changedPolicy);
    const variantId = "default|res:720p|aspect:16:9|audio:on|video_input:none";

    expect(
      firstPublication.perModel[KIE_SEEDANCE_2_MODEL_ID]?.variants?.[variantId]
        ?.billedCreditsQuantityRule?.costCreditsPerUnit
    ).toBe(6.15);
    expect(
      secondPublication.perModel[KIE_SEEDANCE_2_MODEL_ID]?.variants?.[variantId]
        ?.billedCreditsQuantityRule?.costCreditsPerUnit
    ).toBe(12.3);
  });

  it("does not round an exact published quantity total up by one credit", () => {
    const publishedPolicy = materializeImageBilledCreditPolicy(
      getDefaultModelPricingPolicyDocument()
    );

    expect(
      resolveVideoBilledCreditLookup({
        modelId: KIE_SEEDANCE_2_MODEL_ID,
        params: {
          durationSeconds: 5,
          resolution: "1080p",
          inputVideoCount: 0,
        },
        pricingPolicy: publishedPolicy,
      }).breakdown?.credits
    ).toBe(408);
  });

  it("rejects policy publication when an active custom row cannot be materialized", () => {
    const customRows = getDefaultAdminPricingCustomRowsDocument();
    customRows.rowsByModel["unknown-model"] = [
      {
        displayRowId: "custom:unknown",
        label: "Unknown",
        variantId: "default",
        spec: {},
        overrides: {
          markupBps: null,
          providerUsdOverride: null,
          providerUsdPerSecondOverride: null,
        },
      },
    ];

    expect(() =>
      materializeImageBilledCreditPolicy(basePolicy, customRows, { requireComplete: true })
    ).toThrow("Missing published custom pricing rows for: unknown-model:custom:unknown.");
  });
});
