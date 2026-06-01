import { getModelConfig } from "./modelRegistry";
import {
  resolvePricingGridCostBreakdown,
  type PricingGridCostBreakdown,
} from "./pricingGridBilledCredits";
import type { ModelPricingPolicyDocument } from "./pricingPolicy";
import type { PricingParams } from "./pricingTypes";

export type CreateImageBilledCreditLookup = {
  modelId: string;
  params: Omit<PricingParams, "modelId">;
  breakdown: PricingGridCostBreakdown | null;
};

const hasEditLikeCreateInputs = (params: Omit<PricingParams, "modelId">): boolean =>
  (params.inputImageCount ?? 0) > 0 || params.maskPresent === true;

export const normalizeCreateImageBilledPricingParams = (
  modelId: string,
  params: Omit<PricingParams, "modelId"> = {}
): Omit<PricingParams, "modelId"> => {
  const normalized: Omit<PricingParams, "modelId"> = { ...params };
  const config = getModelConfig(modelId);
  const editLike = hasEditLikeCreateInputs(normalized);

  if (config?.supportsTextToImage && config?.supportsImageToImage) {
    normalized.variantBaseId = editLike ? "edit" : "create";
  } else if (editLike) {
    normalized.variantBaseId = "edit";
  }

  if (editLike && normalized.maskPresent == null) {
    normalized.maskPresent = false;
  }

  return normalized;
};

export const resolveCreateImageBilledCreditLookup = ({
  modelId,
  params = {},
  pricingPolicy = null,
}: {
  modelId: string;
  params?: Omit<PricingParams, "modelId">;
  pricingPolicy?: ModelPricingPolicyDocument | null;
}): CreateImageBilledCreditLookup => {
  const normalizedParams = normalizeCreateImageBilledPricingParams(modelId, params);
  return {
    modelId,
    params: normalizedParams,
    breakdown: resolvePricingGridCostBreakdown({
      modelId,
      params: normalizedParams,
      pricingPolicy,
      requireExplicitBilledCreditsOverride: true,
    }),
  };
};

export const resolveCreateImageBilledCreditBreakdown = (input: {
  modelId: string;
  params?: Omit<PricingParams, "modelId">;
  pricingPolicy?: ModelPricingPolicyDocument | null;
}): PricingGridCostBreakdown | null => resolveCreateImageBilledCreditLookup(input).breakdown;

export const resolveCreateImageBilledCredits = (input: {
  modelId: string;
  params?: Omit<PricingParams, "modelId">;
  pricingPolicy?: ModelPricingPolicyDocument | null;
}): number | null => resolveCreateImageBilledCreditBreakdown(input)?.credits ?? null;
