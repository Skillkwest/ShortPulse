import { getModelConfig } from "./modelRegistry";
import {
  resolvePricingGridCostBreakdown,
  type PricingGridCostBreakdown,
} from "./pricingGridBilledCredits";
import type { ModelPricingPolicyDocument } from "./pricingPolicy";
import type { PricingParams } from "./pricingTypes";

export type EditImageBilledCreditLookup = {
  modelId: string;
  params: Omit<PricingParams, "modelId">;
  breakdown: PricingGridCostBreakdown | null;
};

export const supportsCanonicalEditImageBilledPricing = (
  modelId: string | null | undefined
): boolean => {
  if (!modelId) return false;
  const config = getModelConfig(modelId);
  return Boolean(
    config?.mediaType === "image" &&
    config.billable === true &&
    config.pricingStrategy &&
    config.surfaces.includes("pricing")
  );
};

export const normalizeEditImageBilledPricingParams = (
  _modelId: string,
  params: Omit<PricingParams, "modelId"> = {}
): Omit<PricingParams, "modelId"> => {
  const normalized: Omit<PricingParams, "modelId"> = {
    ...params,
    variantBaseId: "edit",
  };

  const inputImageCount =
    typeof normalized.inputImageCount === "number" && Number.isFinite(normalized.inputImageCount)
      ? Math.max(1, Math.trunc(normalized.inputImageCount))
      : 1;

  normalized.inputImageCount = inputImageCount;

  if (!normalized.inputFidelity) {
    normalized.inputFidelity = "high";
  }

  if (normalized.maskPresent == null) {
    normalized.maskPresent = false;
  }

  return normalized;
};

export const resolveEditImageBilledCreditLookup = ({
  modelId,
  params = {},
  pricingPolicy = null,
}: {
  modelId: string;
  params?: Omit<PricingParams, "modelId">;
  pricingPolicy?: ModelPricingPolicyDocument | null;
}): EditImageBilledCreditLookup => {
  const normalizedParams = normalizeEditImageBilledPricingParams(modelId, params);
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

export const resolveEditImageBilledCreditBreakdown = (input: {
  modelId: string;
  params?: Omit<PricingParams, "modelId">;
  pricingPolicy?: ModelPricingPolicyDocument | null;
}): PricingGridCostBreakdown | null => resolveEditImageBilledCreditLookup(input).breakdown;

export const resolveEditImageBilledCredits = (input: {
  modelId: string;
  params?: Omit<PricingParams, "modelId">;
  pricingPolicy?: ModelPricingPolicyDocument | null;
}): number | null => resolveEditImageBilledCreditBreakdown(input)?.credits ?? null;
