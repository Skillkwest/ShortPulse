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
import type { ModelPricingPolicyDocument } from "./pricingPolicy";
import type { PricingParams } from "./pricingTypes";

export type VideoBilledCreditLookup = {
  modelId: string;
  params: Omit<PricingParams, "modelId">;
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
  _modelId: string,
  params: Omit<PricingParams, "modelId"> = {}
): Omit<PricingParams, "modelId"> => {
  const normalized: Omit<PricingParams, "modelId"> = {
    ...params,
    variantBaseId: "default",
  };

  if (
    typeof normalized.inputVideoCount === "number" &&
    Number.isFinite(normalized.inputVideoCount)
  ) {
    normalized.inputVideoCount = Math.max(0, Math.trunc(normalized.inputVideoCount));
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
  const normalizedParams = normalizeVideoBilledPricingParams(modelId, params);
  return {
    modelId,
    params: normalizedParams,
    breakdown: supportsCanonicalVideoBilledPricing(modelId)
      ? resolvePricingGridCostBreakdown({
          modelId,
          params: normalizedParams,
          pricingPolicy,
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
