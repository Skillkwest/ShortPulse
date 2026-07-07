import { describe, expect, it } from "vitest";

import { buildPricingParams } from "../../server/api/generationBilling/pricingParams";
import { FAL_OMNIHUMAN_V15_MODEL_ID } from "../falModelIds";
import { KIE_KLING_30_MOTION_CONTROL_VARIANT_ID } from "../klingMotionControlPricing";
import { KIE_KLING_30_MODEL_ID, KIE_SEEDANCE_2_FAST_MODEL_ID } from "../providerModelIds";
import { resolvePricingGridCostBreakdown } from "../pricingGridBilledCredits";
import {
  getDefaultModelPricingPolicyDocument,
  type ModelPricingPolicyDocument,
} from "../pricingPolicy";
import { resolveVideoBilledCreditLookup, resolveVideoBilledCredits } from "../videoBilledCredits";

const pricingPolicy = {
  ...getDefaultModelPricingPolicyDocument(),
  global: {
    ...getDefaultModelPricingPolicyDocument().global,
    creditUsdScale: 30,
  },
};

const withVideoBilledCreditsOverride = ({
  modelId,
  params,
  credits,
  policy = pricingPolicy,
}: {
  modelId: string;
  params: Record<string, unknown>;
  credits: number;
  policy?: ModelPricingPolicyDocument;
}): ModelPricingPolicyDocument => {
  const variantId = resolvePricingGridCostBreakdown({
    modelId,
    params,
    pricingPolicy: policy,
  })?.variantId;
  if (!variantId) return policy;
  const currentModelPolicy = policy.perModel[modelId] ?? {};
  return {
    ...policy,
    perModel: {
      ...policy.perModel,
      [modelId]: {
        ...currentModelPolicy,
        variants: {
          ...(currentModelPolicy.variants ?? {}),
          [variantId]: {
            ...(currentModelPolicy.variants?.[variantId] ?? {}),
            billedCreditsOverride: credits,
          },
        },
      },
    },
  };
};

describe("videoBilledCredits", () => {
  it("resolves video billed credits through pricing-grid math without duration variants", () => {
    expect(
      resolveVideoBilledCredits({
        modelId: KIE_KLING_30_MODEL_ID,
        params: {
          aspect: "16:9",
          durationSeconds: 6,
          resolution: "1080p",
          audio: false,
        },
        pricingPolicy,
      })
    ).toBeGreaterThan(0);
  });

  it("resolves explicit Kling video billed-credit rows", () => {
    const params = {
      aspect: "16:9",
      durationSeconds: 6,
      resolution: "1080p",
      audio: false,
    };
    const explicitPolicy = withVideoBilledCreditsOverride({
      modelId: KIE_KLING_30_MODEL_ID,
      params,
      credits: 42,
    });

    expect(
      resolveVideoBilledCreditLookup({
        modelId: KIE_KLING_30_MODEL_ID,
        params,
        pricingPolicy: explicitPolicy,
      }).breakdown
    ).toMatchObject({
      credits: 42,
      variantId: "default|res:1080p|aspect:16:9|audio:off",
    });
  });

  it("keeps Kling Motion Control client and server lookup on the dedicated billed row", () => {
    const clientParams = {
      variantBaseId: KIE_KLING_30_MOTION_CONTROL_VARIANT_ID,
      durationSeconds: 10,
      resolution: "720p",
      audio: true,
    };
    const explicitPolicy = withVideoBilledCreditsOverride({
      modelId: KIE_KLING_30_MODEL_ID,
      params: clientParams,
      credits: 31,
    });
    const clientLookup = resolveVideoBilledCreditLookup({
      modelId: KIE_KLING_30_MODEL_ID,
      params: clientParams,
      pricingPolicy: explicitPolicy,
    });
    const serverLookup = resolveVideoBilledCreditLookup({
      modelId: KIE_KLING_30_MODEL_ID,
      params: buildPricingParams(KIE_KLING_30_MODEL_ID, {
        model: "kling-3.0/motion-control",
        image_url: "https://example.com/character.png",
        mode: "720p",
        generate_audio: true,
      }),
      pricingPolicy: explicitPolicy,
    });

    expect(clientLookup.breakdown?.variantId).toBe(serverLookup.breakdown?.variantId);
    expect(serverLookup.breakdown?.variantId).toBe("motion_control|res:720p|audio:on");
    expect(clientLookup.breakdown?.credits).toBe(31);
    expect(serverLookup.breakdown?.credits).toBe(31);
  });

  it("keeps Seedance video-input lookup on the customer-billed resolution row", () => {
    const params = {
      aspect: "1:1",
      durationSeconds: 10,
      resolution: "720p",
      inputVideoCount: 1,
    };
    const explicitPolicy = withVideoBilledCreditsOverride({
      modelId: KIE_SEEDANCE_2_FAST_MODEL_ID,
      params,
      credits: 44,
    });

    expect(
      resolveVideoBilledCreditLookup({
        modelId: KIE_SEEDANCE_2_FAST_MODEL_ID,
        params,
        pricingPolicy: explicitPolicy,
      }).breakdown
    ).toMatchObject({
      credits: 44,
      variantId: "default|res:720p|aspect:16:9|audio:on",
    });
  });

  it("keeps client Lip Sync lookup and server debit lookup on the same OmniHuman row", () => {
    const clientParams = {
      durationSeconds: 12,
      resolution: "720p",
      audio: true,
    };
    const explicitPolicy = withVideoBilledCreditsOverride({
      modelId: FAL_OMNIHUMAN_V15_MODEL_ID,
      params: clientParams,
      credits: 45,
    });
    const clientLookup = resolveVideoBilledCreditLookup({
      modelId: FAL_OMNIHUMAN_V15_MODEL_ID,
      params: clientParams,
      pricingPolicy: explicitPolicy,
    });
    const serverLookup = resolveVideoBilledCreditLookup({
      modelId: FAL_OMNIHUMAN_V15_MODEL_ID,
      params: buildPricingParams(FAL_OMNIHUMAN_V15_MODEL_ID, {
        resolution: "720p",
        shortpulse_context: {
          duration_seconds: 12,
        },
      }),
      pricingPolicy: explicitPolicy,
    });

    expect(clientLookup.breakdown?.variantId).toBe(serverLookup.breakdown?.variantId);
    expect(clientLookup.breakdown?.variantId).toBe("default|res:720p|aspect:video");
    expect(clientLookup.breakdown?.credits).toBe(serverLookup.breakdown?.credits);
    expect(clientLookup.breakdown?.credits).toBe(45);
  });
});
