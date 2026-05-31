import { getModelConfig } from "./modelRegistry";
import { computeCostForModel } from "./pricing";
import { resolveModelPricingForModel, type ModelPricingPolicyDocument } from "./pricingPolicy";
import { resolveModelPricingVariantId } from "./modelPricingVariants";
import type { CostBreakdown, PricingParams } from "./pricingTypes";
import {
  getCreditsAtProviderCost,
  getEffectiveProviderCostUsd,
  getWorkbookBillableCredits,
  getWorkbookBillableUsd,
} from "../../features/admin/pricingWorkbookMath";
import type { AdminCreditPricingBreakdown } from "../../features/admin/types";

export type PricingGridCostBreakdown = CostBreakdown & {
  variantId: string;
};

const toAdminCreditPricingBreakdown = (breakdown: CostBreakdown): AdminCreditPricingBreakdown => ({
  usdRaw: breakdown.usdRaw ?? null,
  rawCredits: breakdown.rawCredits ?? null,
  billedCredits: breakdown.credits ?? null,
  billedUsd: breakdown.usd ?? null,
});

const resolveUsageRateMultiplier = (params: Omit<PricingParams, "modelId">): number | null => {
  if (typeof params.generationCount === "number" && Number.isFinite(params.generationCount)) {
    return Math.max(1, Math.round(params.generationCount));
  }
  return null;
};

export const resolvePricingGridCostBreakdown = ({
  modelId,
  params = {},
  pricingPolicy = null,
}: {
  modelId: string;
  params?: Omit<PricingParams, "modelId">;
  pricingPolicy?: ModelPricingPolicyDocument | null;
}): PricingGridCostBreakdown | null => {
  const breakdown = computeCostForModel(modelId, params, pricingPolicy);
  if (!breakdown) return null;

  const variantId = resolveModelPricingVariantId({
    modelId,
    ...params,
    pricingPolicy,
  });
  const config = getModelConfig(modelId);
  const resolvedPolicy = resolveModelPricingForModel(pricingPolicy, modelId, variantId);

  if (resolvedPolicy.billedCreditsOverride != null) {
    return {
      ...breakdown,
      credits: resolvedPolicy.billedCreditsOverride,
      usd: resolvedPolicy.billedCreditsOverride / resolvedPolicy.creditUsdScale,
      variantId,
    };
  }

  if (config?.pricingAuthority !== "shared_policy") {
    return {
      ...breakdown,
      variantId,
    };
  }

  const workbookBreakdown = toAdminCreditPricingBreakdown(breakdown);
  const providerCostUsd = getEffectiveProviderCostUsd({
    breakdown: workbookBreakdown,
    providerUsdOverride: resolvedPolicy.providerUsdOverride,
    providerUsdPerSecondOverride: resolvedPolicy.providerUsdPerSecondOverride,
    durationSeconds: params.durationSeconds ?? null,
    usageRateMultiplier: resolveUsageRateMultiplier(params),
  });
  const creditsAtCost = getCreditsAtProviderCost(workbookBreakdown, resolvedPolicy.creditUsdScale, {
    preferRuntimeCredits: false,
    providerCostUsd,
  });
  const billedCredits = getWorkbookBillableCredits({
    breakdown: workbookBreakdown,
    creditsAtCost,
    markupBps: resolvedPolicy.markupBps,
    roundingIncrement: resolvedPolicy.roundingIncrement,
    preferRuntimeBilledCredits: false,
  });
  const billedUsd = getWorkbookBillableUsd(
    billedCredits,
    resolvedPolicy.creditUsdScale,
    breakdown.usd,
    {
      preferRuntimeBilledUsd: false,
    }
  );
  if (billedCredits == null || billedUsd == null) {
    return {
      ...breakdown,
      variantId,
    };
  }

  return {
    ...breakdown,
    credits: billedCredits,
    usd: billedUsd,
    variantId,
  };
};

export const resolvePricingGridBilledCredits = (input: {
  modelId: string;
  params?: Omit<PricingParams, "modelId">;
  pricingPolicy?: ModelPricingPolicyDocument | null;
}): number | null => resolvePricingGridCostBreakdown(input)?.credits ?? null;
