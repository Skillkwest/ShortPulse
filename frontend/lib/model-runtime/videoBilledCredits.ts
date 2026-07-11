/**
 * Canonical billed-credit lookup for billable video generation.
 * Resolves explicit admin-pricing billed-credit rows and fails closed when a
 * priced video configuration has not been authored.
 */
import { getModelConfig } from "./modelRegistry";
import {
  resolvePricingGridCostBreakdown,
  type PricingGridCostBreakdown,
} from "./pricingGridBilledCredits";
import {
  resolveModelBillingVariantProfile,
  type ModelPricingPolicyDocument,
} from "./pricingPolicy";
import type { PricingParams } from "./pricingTypes";
import {
  shouldExpandVideoInputPricingVariants,
  shouldUseOutputDurationForCustomerQuantity,
} from "./pricingGridVariantRules";

export type VideoBilledCreditLookup = {
  modelId: string;
  params: Omit<PricingParams, "modelId">;
  customerPricingParams: Omit<PricingParams, "modelId">;
  providerCostParams: Omit<PricingParams, "modelId">;
  breakdown: PricingGridCostBreakdown | null;
};

/**
 * Returns whether a model belongs to the canonical billable video pricing lane.
 */
export const supportsCanonicalVideoBilledPricing = (
  modelId: string | null | undefined
): boolean => {
  if (!modelId) return false;
  const config = getModelConfig(modelId);
  return Boolean(
    config?.mediaType.toLowerCase().includes("video") &&
    config.billable === true &&
    config.pricingStrategy &&
    config.surfaces.includes("pricing")
  );
};

/**
 * Normalizes video pricing params before both display and debit lookup.
 */
export const normalizeVideoBilledPricingParams = (
  modelId: string,
  params: Omit<PricingParams, "modelId"> = {},
  pricingPolicy: ModelPricingPolicyDocument | null = null
): Omit<PricingParams, "modelId"> => {
  const config = getModelConfig(modelId);
  const normalized: Omit<PricingParams, "modelId"> = {
    ...params,
    variantBaseId: params.variantBaseId ?? "default",
  };

  if (
    typeof normalized.inputVideoCount === "number" &&
    Number.isFinite(normalized.inputVideoCount)
  ) {
    normalized.inputVideoCount = Math.max(0, Math.trunc(normalized.inputVideoCount));
  } else if (shouldExpandVideoInputPricingVariants(config?.pricingStrategy)) {
    normalized.inputVideoCount = 0;
  }
  if (
    typeof normalized.inputVideoDurationSeconds === "number" &&
    Number.isFinite(normalized.inputVideoDurationSeconds)
  ) {
    normalized.inputVideoDurationSeconds = Math.max(0, normalized.inputVideoDurationSeconds);
  }

  if (
    resolveModelBillingVariantProfile(pricingPolicy, modelId) === "seedance_composition_neutral_v1"
  ) {
    delete normalized.inputVideoCount;
    delete normalized.inputVideoDurationSeconds;
    delete normalized.sourceDurationSeconds;
  } else if (shouldUseOutputDurationForCustomerQuantity(config?.pricingStrategy) && pricingPolicy) {
    delete normalized.sourceDurationSeconds;
  }

  return normalized;
};

/**
 * Resolves the explicit admin-priced billed-credit row for a video configuration.
 */
export const resolveVideoBilledCreditLookup = ({
  modelId,
  params = {},
  pricingPolicy = null,
}: {
  modelId: string;
  params?: Omit<PricingParams, "modelId">;
  pricingPolicy?: ModelPricingPolicyDocument | null;
}): VideoBilledCreditLookup => {
  const providerCostParams = normalizeVideoBilledPricingParams(modelId, params, null);
  const customerPricingParams = normalizeVideoBilledPricingParams(modelId, params, pricingPolicy);
  return {
    modelId,
    params: customerPricingParams,
    customerPricingParams,
    providerCostParams,
    breakdown: supportsCanonicalVideoBilledPricing(modelId)
      ? resolvePricingGridCostBreakdown({
          modelId,
          params: providerCostParams,
          pricingPolicy,
          requirePublishedBillingRule: true,
        })
      : null,
  };
};

/**
 * Resolves only the billed-credit number for a video configuration.
 */
export const resolveVideoBilledCredits = (input: {
  modelId: string;
  params?: Omit<PricingParams, "modelId">;
  pricingPolicy?: ModelPricingPolicyDocument | null;
}): number | null => resolveVideoBilledCreditLookup(input).breakdown?.credits ?? null;
