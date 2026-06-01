import { describe, expect, it } from "vitest";

import { resolveCreatePricingTarget } from "../../../features/ai-studio/logic/createPricingTarget";
import { buildPricingParams } from "../../server/api/generationBilling/pricingParams";
import type { PricingParams } from "../pricingTypes";
import {
  resolveCreateImageBilledCreditLookup,
  resolveCreateImageBilledCredits,
} from "../createImageBilledCredits";
import { getDefaultModelPricingPolicyDocument } from "../pricingPolicy";
import { materializeImageBilledCreditPolicy } from "../materializeImageBilledCreditPolicy";
import { OPENAI_GPT_IMAGE_2_MODEL_ID } from "../openAiImage2";

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
  it("keeps client Create lookup and server debit lookup on the same canonical GPT Image 2 row", () => {
    const clientTarget = resolveCreatePricingTarget({
      modelId: OPENAI_GPT_IMAGE_2_MODEL_ID,
      aspect: "16:9",
      resolution: "medium",
      isCharacterModeEnabled: true,
      userReferenceImageUrls: [],
      characterModeInjectionBundle: {
        sheetReferenceStoragePaths: ["user/chars/look-1.png"],
        sheetReferenceUrls: ["https://cdn.shortpulse.test/look-1.png"],
      },
      costParamsForModel: makeCostParamsForModel(OPENAI_GPT_IMAGE_2_MODEL_ID),
    });

    expect(clientTarget).not.toBeNull();

    const clientLookup = resolveCreateImageBilledCreditLookup({
      modelId: clientTarget?.modelId ?? OPENAI_GPT_IMAGE_2_MODEL_ID,
      params: clientTarget?.params,
      pricingPolicy,
    });
    const serverLookup = resolveCreateImageBilledCreditLookup({
      modelId: OPENAI_GPT_IMAGE_2_MODEL_ID,
      params: buildPricingParams(OPENAI_GPT_IMAGE_2_MODEL_ID, {
        size: "1536x1024",
        quality: "MEDIUM",
        input_fidelity: "high",
        images: [{ image_url: "https://cdn.shortpulse.test/look-1.png" }],
      }),
      pricingPolicy,
    });

    expect(clientLookup.breakdown?.variantId).toBe(serverLookup.breakdown?.variantId);
    expect(clientLookup.breakdown?.variantId).toBe(
      "edit|res:medium|aspect:16:9|input_images:1|input_fidelity:high|mask:no"
    );
    expect(clientLookup.breakdown?.credits).toBe(serverLookup.breakdown?.credits);
    expect(clientLookup.breakdown?.credits).not.toBeNull();
  });

  it("keeps GPT Image 2 multi-ref Create gaps fail-closed after canonical normalization", () => {
    const clientTarget = resolveCreatePricingTarget({
      modelId: OPENAI_GPT_IMAGE_2_MODEL_ID,
      aspect: "16:9",
      resolution: "medium",
      isCharacterModeEnabled: true,
      userReferenceImageUrls: ["https://example.com/user-reference.png"],
      characterModeInjectionBundle: {
        sheetReferenceStoragePaths: ["user/chars/look-1.png", "user/chars/look-2.png"],
        sheetReferenceUrls: [
          "https://cdn.shortpulse.test/look-1.png",
          "https://cdn.shortpulse.test/look-2.png",
        ],
      },
      costParamsForModel: makeCostParamsForModel(OPENAI_GPT_IMAGE_2_MODEL_ID),
    });

    expect(clientTarget).not.toBeNull();
    expect(
      resolveCreateImageBilledCredits({
        modelId: clientTarget?.modelId ?? OPENAI_GPT_IMAGE_2_MODEL_ID,
        params: clientTarget?.params,
        pricingPolicy,
      })
    ).toBeNull();
  });

  it("materializes edit-only image model rows under canonical edit variant ids", () => {
    const variantIds = Object.keys(
      pricingPolicy.perModel["fal-ai/nano-banana-2/edit"]?.variants ?? {}
    );

    expect(variantIds.some((variantId) => variantId.startsWith("edit|"))).toBe(true);
    expect(variantIds.some((variantId) => variantId.startsWith("default|"))).toBe(false);
  });
});
