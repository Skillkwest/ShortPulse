import { describe, expect, it } from "vitest";

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

  it("returns distinct billed credits for pricing-grid GPT Image 2 quality tiers", () => {
    expect(
      resolvePricingGridCostBreakdown({
        modelId: "gpt-image-2",
        params: {
          aspect: "16:9",
          resolution: "medium",
        },
        pricingPolicy: pricingGridPolicy,
      })
    ).toMatchObject({
      credits: 4,
      variantId: "create|res:medium|aspect:16:9",
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
