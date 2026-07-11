import { resolvePricingGridCostBreakdown } from "../../../lib/model-runtime/pricingGridBilledCredits";
import type { PricingParams } from "./pricingTypes";

type ClientPricingEstimateInput = {
  modelId: string | null | undefined;
  params?: Omit<PricingParams, "modelId">;
  pricingPolicy?: PricingParams["pricingPolicy"];
  pricingPolicyReady?: boolean;
};

export const resolveClientPricingBreakdown = ({
  modelId,
  params = {},
  pricingPolicy = null,
  pricingPolicyReady = true,
}: ClientPricingEstimateInput) => {
  if (!pricingPolicyReady) return null;
  if (!modelId) return null;
  return resolvePricingGridCostBreakdown({
    modelId,
    params,
    pricingPolicy,
    requirePublishedBillingRule: true,
  });
};

export const resolveClientBilledCredits = (input: ClientPricingEstimateInput): number | null =>
  resolveClientPricingBreakdown(input)?.credits ?? null;
