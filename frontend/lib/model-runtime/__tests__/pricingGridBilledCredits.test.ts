import { describe, expect, it } from "vitest";

import {
  FAL_FLUX_2_KLEIN_9B_MODEL_ID,
  FAL_FLUX_2_KLEIN_AUDIO_COMPANION_ART_VARIANT_BASE_ID,
  FAL_FLUX_2_KLEIN_STYLE_PREVIEW_VARIANT_BASE_ID,
} from "../falModelIds";
import { resolvePricingGridCostBreakdown } from "../pricingGridBilledCredits";
import { getDefaultModelPricingPolicyDocument } from "../pricingPolicy";
import { materializeImageBilledCreditPolicy } from "../materializeImageBilledCreditPolicy";
import {
  ELEVENLABS_MUSIC_MODEL_ID,
  ELEVENLABS_SOUND_EFFECTS_EXPLICIT_DURATION_VARIANT_ID,
  ELEVENLABS_SOUND_EFFECTS_MODEL_ID,
  ELEVENLABS_VOICE_CHANGER_MODEL_ID,
  ELEVENLABS_VOICEOVER_MODEL_ID,
} from "../elevenLabsModels";
import { KIE_SEEDANCE_2_MODEL_ID } from "../providerModelIds";

const pricingGridPolicy = {
  ...getDefaultModelPricingPolicyDocument(),
  global: {
    ...getDefaultModelPricingPolicyDocument().global,
    creditUsdScale: 30,
  },
};

const materializedImagePolicy = materializeImageBilledCreditPolicy(pricingGridPolicy);

describe("pricingGridBilledCredits", () => {
  it("matches the pricing-grid billed credits for standard Nano Banana 2 Create variants", () => {
    expect(
      resolvePricingGridCostBreakdown({
        modelId: "fal-ai/nano-banana-2",
        params: {
          aspect: "16:9",
          resolution: "0.5K",
        },
        pricingPolicy: pricingGridPolicy,
      })
    ).toMatchObject({
      credits: 4,
      variantId: "default|res:0.5K|aspect:auto",
    });

    expect(
      resolvePricingGridCostBreakdown({
        modelId: "fal-ai/nano-banana-2",
        params: {
          aspect: "auto",
          resolution: "1K",
        },
        pricingPolicy: pricingGridPolicy,
      })
    ).toMatchObject({
      credits: 5,
      variantId: "default|res:1K|aspect:auto",
    });

    expect(
      resolvePricingGridCostBreakdown({
        modelId: "fal-ai/nano-banana-2",
        params: {
          aspect: "auto",
          resolution: "2K",
        },
        pricingPolicy: pricingGridPolicy,
      })
    ).toMatchObject({
      credits: 7,
      variantId: "default|res:2K|aspect:auto",
    });
  });

  it("resolves Flux2 Klein semantic admin rows for audio background and style placeholder image variants", () => {
    expect(
      resolvePricingGridCostBreakdown({
        modelId: FAL_FLUX_2_KLEIN_9B_MODEL_ID,
        params: {
          variantBaseId: FAL_FLUX_2_KLEIN_AUDIO_COMPANION_ART_VARIANT_BASE_ID,
          aspect: "1:1",
          resolution: "model_default",
        },
        pricingPolicy: pricingGridPolicy,
      })
    ).toMatchObject({
      credits: 2,
      variantId: `${FAL_FLUX_2_KLEIN_AUDIO_COMPANION_ART_VARIANT_BASE_ID}|res:model_default|aspect:1:1`,
    });

    expect(
      resolvePricingGridCostBreakdown({
        modelId: FAL_FLUX_2_KLEIN_9B_MODEL_ID,
        params: {
          variantBaseId: FAL_FLUX_2_KLEIN_STYLE_PREVIEW_VARIANT_BASE_ID,
          aspect: "1:1",
          resolution: "model_default",
        },
        pricingPolicy: pricingGridPolicy,
      })
    ).toMatchObject({
      credits: 2,
      variantId: `${FAL_FLUX_2_KLEIN_STYLE_PREVIEW_VARIANT_BASE_ID}|res:model_default|aspect:1:1`,
    });
  });

  it("fails closed for strict billed-credit requests until explicit runtime overrides exist", () => {
    const calculatorInputsOnlyPolicy = {
      ...pricingGridPolicy,
      perModel: {
        ...pricingGridPolicy.perModel,
        "fal-ai/nano-banana-2": {
          variants: {
            "default|res:0.5K|aspect:auto": {
              providerUsdOverride: 0.1,
              markupBps: 6_000,
            },
          },
        },
      },
    };

    expect(
      resolvePricingGridCostBreakdown({
        modelId: "fal-ai/nano-banana-2",
        params: {
          aspect: "16:9",
          resolution: "0.5K",
        },
        pricingPolicy: pricingGridPolicy,
        requirePublishedBillingRule: true,
      })
    ).toBeNull();
    expect(
      resolvePricingGridCostBreakdown({
        modelId: "fal-ai/nano-banana-2",
        params: { aspect: "16:9", resolution: "0.5K" },
        pricingPolicy: calculatorInputsOnlyPolicy,
        requirePublishedBillingRule: true,
      })
    ).toBeNull();

    expect(
      resolvePricingGridCostBreakdown({
        modelId: "fal-ai/nano-banana-2",
        params: {
          aspect: "16:9",
          resolution: "0.5K",
        },
        pricingPolicy: materializedImagePolicy,
        requirePublishedBillingRule: true,
      })
    ).toMatchObject({
      credits: 4,
      variantId: "default|res:0.5K|aspect:auto",
    });
  });

  it("scales the published per-output Billed Credits row by requested output count", () => {
    const single = resolvePricingGridCostBreakdown({
      modelId: "fal-ai/nano-banana-2",
      params: { aspect: "auto", resolution: "1K", generationCount: 1 },
      pricingPolicy: materializedImagePolicy,
      requirePublishedBillingRule: true,
    });
    const batch = resolvePricingGridCostBreakdown({
      modelId: "fal-ai/nano-banana-2",
      params: { aspect: "auto", resolution: "1K", generationCount: 3 },
      pricingPolicy: materializedImagePolicy,
      requirePublishedBillingRule: true,
    });

    expect(single?.credits).toBe(5);
    expect(batch?.credits).toBe(15);
    expect(batch?.variantId).toBe(single?.variantId);
  });

  it("preserves workbook billing across published duration and character quantity rules", () => {
    const cases = [
      ...[1, 5, 30, 60].map((durationSeconds) => ({
        modelId: ELEVENLABS_MUSIC_MODEL_ID,
        params: { durationSeconds },
      })),
      ...[1, 30, 60].map((sourceDurationSeconds) => ({
        modelId: ELEVENLABS_VOICE_CHANGER_MODEL_ID,
        params: { sourceDurationSeconds },
      })),
      ...[1, 100, 1_000, 1_500].map((textCharacters) => ({
        modelId: ELEVENLABS_VOICEOVER_MODEL_ID,
        params: { textCharacters },
      })),
      {
        modelId: ELEVENLABS_SOUND_EFFECTS_MODEL_ID,
        params: {
          variantBaseId: ELEVENLABS_SOUND_EFFECTS_EXPLICIT_DURATION_VARIANT_ID,
          durationSeconds: 5,
        },
      },
      ...[5, 12].map((durationSeconds) => ({
        modelId: KIE_SEEDANCE_2_MODEL_ID,
        params: { durationSeconds, resolution: "720p", inputVideoCount: 0 },
      })),
    ];

    cases.forEach(({ modelId, params }) => {
      const workbook = resolvePricingGridCostBreakdown({
        modelId,
        params,
        pricingPolicy: pricingGridPolicy,
      });
      const published = resolvePricingGridCostBreakdown({
        modelId,
        params,
        pricingPolicy: materializedImagePolicy,
        requirePublishedBillingRule: true,
      });

      expect(published?.variantId).toBe(workbook?.variantId);
      expect(published?.credits).toBe(workbook?.credits);
    });
  });
});
