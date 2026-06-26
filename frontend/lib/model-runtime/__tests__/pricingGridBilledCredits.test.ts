import { describe, expect, it } from "vitest";

import {
  FAL_FLUX_2_KLEIN_9B_MODEL_ID,
  FAL_FLUX_2_KLEIN_AUDIO_COMPANION_ART_VARIANT_BASE_ID,
  FAL_FLUX_2_KLEIN_STYLE_PREVIEW_VARIANT_BASE_ID,
} from "../falModelIds";
import { resolvePricingGridCostBreakdown } from "../pricingGridBilledCredits";
import { getDefaultModelPricingPolicyDocument } from "../pricingPolicy";
import { materializeImageBilledCreditPolicy } from "../materializeImageBilledCreditPolicy";

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
    expect(
      resolvePricingGridCostBreakdown({
        modelId: "fal-ai/nano-banana-2",
        params: {
          aspect: "16:9",
          resolution: "0.5K",
        },
        pricingPolicy: pricingGridPolicy,
        requireExplicitBilledCreditsOverride: true,
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
        requireExplicitBilledCreditsOverride: true,
      })
    ).toMatchObject({
      credits: 4,
      variantId: "default|res:0.5K|aspect:auto",
    });
  });
});
