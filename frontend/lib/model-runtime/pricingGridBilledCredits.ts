import { getModelConfig } from "./modelRegistry";
import { computeCostForModel } from "./pricing";
import { resolveModelPricingForModel, type ModelPricingPolicyDocument } from "./pricingPolicy";
import { resolveModelPricingVariantId } from "./modelPricingVariants";
import type { CostBreakdown, PricingParams } from "./pricingTypes";
import {
  shouldExpandAspectPricingVariants,
  shouldExpandResolutionPricingVariants,
  shouldExpandVideoInputPricingVariants,
} from "./pricingGridVariantRules";
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

const SHARED_POLICY_PRICING_AUTHORITY = "shared_policy";

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

const normalizePricingGridParams = (
  modelId: string,
  params: Omit<PricingParams, "modelId">
): Omit<PricingParams, "modelId"> => {
  const config = getModelConfig(modelId);
  if (!config) return params;

  const normalizedParams: Omit<PricingParams, "modelId"> = { ...params };

  if (shouldExpandAspectPricingVariants(config.pricingStrategy)) {
    if (!normalizedParams.aspect && config.defaultAspect) {
      normalizedParams.aspect = config.defaultAspect;
    }
  } else {
    delete normalizedParams.aspect;
    if (config.defaultAspect) {
      normalizedParams.aspect = config.defaultAspect;
    }
  }

  if (shouldExpandResolutionPricingVariants(config.pricingStrategy)) {
    if (normalizedParams.resolution === undefined && config.defaultResolution !== undefined) {
      normalizedParams.resolution = config.defaultResolution ?? undefined;
    }
  } else {
    delete normalizedParams.resolution;
    if (config.defaultResolution !== undefined) {
      normalizedParams.resolution = config.defaultResolution ?? undefined;
    }
  }

  if (!shouldExpandVideoInputPricingVariants(config.pricingStrategy)) {
    delete normalizedParams.inputVideoCount;
  }

  return normalizedParams;
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
  const normalizedParams = normalizePricingGridParams(modelId, params);
  const breakdown = computeCostForModel(modelId, normalizedParams, pricingPolicy);
  if (!breakdown) return null;

  const variantId = resolveModelPricingVariantId({
    modelId,
    ...normalizedParams,
    pricingPolicy,
  });
  const config = getModelConfig(modelId);
  const resolvedPolicy = resolveModelPricingForModel(pricingPolicy, modelId, variantId);
  const pricingAuthority = config?.pricingAuthority ?? SHARED_POLICY_PRICING_AUTHORITY;

  if (resolvedPolicy.billedCreditsOverride != null) {
    return {
      ...breakdown,
      credits: resolvedPolicy.billedCreditsOverride,
      usd: resolvedPolicy.billedCreditsOverride / resolvedPolicy.creditUsdScale,
      variantId,
    };
  }

  if (pricingAuthority !== SHARED_POLICY_PRICING_AUTHORITY) {
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
    durationSeconds: normalizedParams.durationSeconds ?? null,
    usageRateMultiplier: resolveUsageRateMultiplier(normalizedParams),
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
  if (billedCredits == null || billedUsd == null) return null;

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
