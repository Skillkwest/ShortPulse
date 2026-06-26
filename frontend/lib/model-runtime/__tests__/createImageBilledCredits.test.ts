import { describe, expect, it } from "vitest";

import { resolveCreatePricingTarget } from "../../../features/ai-studio/logic/createPricingTarget";
import type { PricingParams } from "../pricingTypes";
import { resolveCreateImageBilledCreditLookup } from "../createImageBilledCredits";
import { getDefaultModelPricingPolicyDocument } from "../pricingPolicy";
import { materializeImageBilledCreditPolicy } from "../materializeImageBilledCreditPolicy";

const pricingPolicy = materializeImageBilledCreditPolicy({
  ...getDefaultModelPricingPolicyDocument(),
  global: {
    ...getDefaultModelPricingPolicyDocument().global,
    creditUsdScale: 30,
  },
});

const makeCostParamsForModel =
  (modelId: string) =>
  (
    targetModelIdOrOverrides?: string | Omit<PricingParams, "modelId">,
    maybeOverrides?: Omit<PricingParams, "modelId">
  ): PricingParams => {
    const resolvedModelId =
      typeof targetModelIdOrOverrides === "string" ? targetModelIdOrOverrides : modelId;
    const overrides =
      typeof targetModelIdOrOverrides === "string" ? maybeOverrides : targetModelIdOrOverrides;
    return {
      modelId: resolvedModelId,
      aspect: "16:9",
      resolution: "medium",
      ...overrides,
    };
  };

describe("createImageBilledCredits", () => {
  it("collapses Nano Banana 2 Character Mode multi-ref pricing onto the canonical edit row", () => {
    const clientTarget = resolveCreatePricingTarget({
      modelId: "fal-ai/nano-banana-2",
      aspect: "16:9",
      resolution: "2K",
      isCharacterModeEnabled: true,
      userReferenceImageUrls: [],
      characterModeInjectionBundle: {
        sheetReferenceStoragePaths: [
          "user/chars/look-1.png",
          "user/chars/look-2.png",
          "user/chars/look-3.png",
        ],
        sheetReferenceUrls: [
          "https://cdn.shortpulse.test/look-1.png",
          "https://cdn.shortpulse.test/look-2.png",
          "https://cdn.shortpulse.test/look-3.png",
        ],
      },
      costParamsForModel: makeCostParamsForModel("fal-ai/nano-banana-2"),
    });

    const lookup = resolveCreateImageBilledCreditLookup({
      modelId: clientTarget?.modelId ?? "fal-ai/nano-banana-2/edit",
      params: clientTarget?.params,
      pricingPolicy,
    });

    expect(clientTarget?.inputImageCount).toBe(3);
    expect(lookup.breakdown?.variantId).toBe("edit|res:2K|aspect:auto");
    expect(lookup.breakdown?.credits).toBe(7);
  });

  it("keeps ref-driven Nano Banana 2 standard Create on the canonical text row", () => {
    const lookup = resolveCreateImageBilledCreditLookup({
      modelId: "fal-ai/nano-banana-2",
      params: {
        aspect: "16:9",
        resolution: "1K",
        inputImageCount: 2,
      },
      pricingPolicy,
    });

    expect(lookup.breakdown?.variantId).toBe("default|res:1K|aspect:auto");
    expect(lookup.breakdown?.credits).toBe(5);
  });

  it("materializes edit-only image model rows under canonical edit variant ids", () => {
    const variantIds = Object.keys(
      pricingPolicy.perModel["fal-ai/nano-banana-2/edit"]?.variants ?? {}
    );

    expect(variantIds.some((variantId) => variantId.startsWith("edit|"))).toBe(true);
    expect(variantIds.some((variantId) => variantId.startsWith("default|"))).toBe(false);
  });
});
