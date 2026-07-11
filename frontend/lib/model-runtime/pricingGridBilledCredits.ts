import { getModelConfig } from "./modelRegistry";
import { computeCostForModel } from "./pricing";
import { isKieKling30MotionControlPricingVariant } from "./klingMotionControlPricing";
import {
  resolveModelBillingVariantProfile,
  resolveModelPricingForModel,
  type ModelPricingPolicyDocument,
} from "./pricingPolicy";
import { resolveModelPricingVariantId } from "./modelPricingVariants";
import type { CostBreakdown, PricingParams } from "./pricingTypes";
import {
  shouldExpandAspectPricingVariants,
  shouldExpandCustomerVideoInputPricingVariants,
  shouldExpandResolutionPricingVariants,
} from "./pricingGridVariantRules";
import {
  getCreditsAtProviderCost,
  getEffectiveProviderCostUsd,
  getWorkbookBillableCredits,
  getWorkbookBillableUsd,
} from "../../features/admin/pricingWorkbookMath";
import type { AdminCreditPricingBreakdown } from "../../features/admin/types";

type PublishedPricingGridCostBreakdown = Pick<CostBreakdown, "credits" | "usd"> & {
  rawCredits: number | null;
  usdRaw: number | null;
  megapixels: number | null;
  width: number | null;
  height: number | null;
  variantId: string;
};

export type PricingGridCostBreakdown = (CostBreakdown | PublishedPricingGridCostBreakdown) & {
  variantId: string;
};

const SHARED_POLICY_PRICING_AUTHORITY = "shared_policy";

const toAdminCreditPricingBreakdown = (breakdown: CostBreakdown): AdminCreditPricingBreakdown => ({
  usdRaw: breakdown.usdRaw ?? null,
  rawCredits: breakdown.rawCredits ?? null,
  billedCredits: breakdown.credits ?? null,
  billedUsd: breakdown.usd ?? null,
});

const resolveUsageRateMultiplier = (
  modelId: string,
  params: Omit<PricingParams, "modelId">
): number | null => {
  const strategy = getModelConfig(modelId)?.pricingStrategy ?? null;
  if (
    strategy === "elevenlabs-text-to-speech-per-kchar" &&
    typeof params.textCharacters === "number" &&
    Number.isFinite(params.textCharacters)
  ) {
    return Math.max(0, params.textCharacters) / 1_000;
  }
  if (typeof params.generationCount === "number" && Number.isFinite(params.generationCount)) {
    return Math.max(1, Math.round(params.generationCount));
  }
  return null;
};

const roundPublishedCredits = (credits: number, increment: number): number =>
  Math.ceil(Number(credits.toFixed(12)) / Math.max(1, increment)) * Math.max(1, increment);

const resolveProviderObservabilityBreakdown = (
  modelId: string,
  params: Omit<PricingParams, "modelId">,
  pricingPolicy: ModelPricingPolicyDocument | null
): CostBreakdown | null => {
  try {
    return computeCostForModel(modelId, params, pricingPolicy);
  } catch {
    return null;
  }
};

const resolvePublishedQuantity = (
  basis: "per_second" | "per_output_second" | "per_1k_chars",
  params: Omit<PricingParams, "modelId">
): number | null => {
  if (basis === "per_1k_chars") {
    return typeof params.textCharacters === "number" && Number.isFinite(params.textCharacters)
      ? Math.max(0, params.textCharacters) / 1_000
      : null;
  }
  if (basis === "per_output_second") {
    return typeof params.durationSeconds === "number" && Number.isFinite(params.durationSeconds)
      ? Math.max(0, params.durationSeconds)
      : null;
  }
  if (typeof params.sourceDurationSeconds === "number") {
    return Math.max(0, params.sourceDurationSeconds);
  }
  if (typeof params.durationSeconds !== "number") return null;
  return (
    Math.max(0, params.durationSeconds) +
    (typeof params.inputVideoDurationSeconds === "number"
      ? Math.max(0, params.inputVideoDurationSeconds)
      : 0)
  );
};

const shouldKeepAudioInPricingGridParams = (config: ReturnType<typeof getModelConfig>): boolean => {
  if (!config) return false;
  if (config.defaultAudio == null) return false;
  if (!config.mediaType.toLowerCase().includes("video")) return false;
  return !["seedance-2-per-second", "seedance-2-fast-per-second"].includes(
    config.pricingStrategy ?? ""
  );
};

const normalizePricingGridParams = (
  modelId: string,
  params: Omit<PricingParams, "modelId">,
  pricingPolicy: ModelPricingPolicyDocument | null
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
    if (
      config.defaultAspect &&
      !isKieKling30MotionControlPricingVariant(normalizedParams.variantBaseId)
    ) {
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

  if (shouldKeepAudioInPricingGridParams(config)) {
    if (normalizedParams.audio == null && config.defaultAudio != null) {
      normalizedParams.audio = config.defaultAudio;
    }
  } else {
    delete normalizedParams.audio;
  }

  if (
    !shouldExpandCustomerVideoInputPricingVariants({
      modelId,
      pricingStrategy: config.pricingStrategy,
      pricingPolicy,
    })
  ) {
    delete normalizedParams.inputVideoCount;
    if (
      resolveModelBillingVariantProfile(pricingPolicy, modelId) ===
      "seedance_composition_neutral_v1"
    ) {
      delete normalizedParams.inputVideoDurationSeconds;
      delete normalizedParams.sourceDurationSeconds;
    }
  }

  if (
    config.pricingStrategy === "elevenlabs-music-per-minute" &&
    normalizedParams.durationSeconds == null &&
    config.defaultDurationSeconds != null
  ) {
    normalizedParams.durationSeconds = config.defaultDurationSeconds;
  }

  return normalizedParams;
};

export function resolvePricingGridCostBreakdown(input: {
  modelId: string;
  params?: Omit<PricingParams, "modelId">;
  pricingPolicy?: ModelPricingPolicyDocument | null;
  requirePublishedBillingRule: true;
}): PublishedPricingGridCostBreakdown | null;
export function resolvePricingGridCostBreakdown(input: {
  modelId: string;
  params?: Omit<PricingParams, "modelId">;
  pricingPolicy?: ModelPricingPolicyDocument | null;
  requirePublishedBillingRule?: false;
}): (CostBreakdown & { variantId: string }) | null;
export function resolvePricingGridCostBreakdown(input: {
  modelId: string;
  params?: Omit<PricingParams, "modelId">;
  pricingPolicy?: ModelPricingPolicyDocument | null;
  requirePublishedBillingRule?: boolean;
}): PricingGridCostBreakdown | null;
export function resolvePricingGridCostBreakdown({
  modelId,
  params = {},
  pricingPolicy = null,
  requirePublishedBillingRule = false,
}: {
  modelId: string;
  params?: Omit<PricingParams, "modelId">;
  pricingPolicy?: ModelPricingPolicyDocument | null;
  requirePublishedBillingRule?: boolean;
}): PricingGridCostBreakdown | null {
  const providerCostParams = { ...params };
  const normalizedParams = normalizePricingGridParams(modelId, params, pricingPolicy);
  const variantId = resolveModelPricingVariantId({
    modelId,
    ...normalizedParams,
    pricingPolicy,
  });
  const config = getModelConfig(modelId);
  const resolvedPolicy = resolveModelPricingForModel(pricingPolicy, modelId, variantId);
  const pricingAuthority = config?.pricingAuthority ?? SHARED_POLICY_PRICING_AUTHORITY;

  if (
    requirePublishedBillingRule &&
    resolvedPolicy.billedCreditsOverride == null &&
    resolvedPolicy.billedCreditsQuantityRule == null
  ) {
    return null;
  }

  if (resolvedPolicy.billedCreditsOverride != null) {
    const providerObservability = resolveProviderObservabilityBreakdown(
      modelId,
      providerCostParams,
      pricingPolicy
    );
    const outputCount =
      typeof normalizedParams.generationCount === "number" &&
      Number.isFinite(normalizedParams.generationCount)
        ? Math.max(1, Math.round(normalizedParams.generationCount))
        : 1;
    const billedCredits = resolvedPolicy.billedCreditsOverride * outputCount;
    return {
      credits: billedCredits,
      usd: billedCredits / resolvedPolicy.creditUsdScale,
      rawCredits: providerObservability?.rawCredits ?? null,
      usdRaw: providerObservability?.usdRaw ?? null,
      megapixels: providerObservability?.megapixels ?? null,
      width: providerObservability?.width ?? null,
      height: providerObservability?.height ?? null,
      variantId,
    };
  }

  if (resolvedPolicy.billedCreditsQuantityRule != null) {
    const quantityRule = resolvedPolicy.billedCreditsQuantityRule;
    const quantity = resolvePublishedQuantity(quantityRule.quantityBasis, normalizedParams);
    if (quantity == null || quantity <= 0) return null;
    const creditsAtCost = Math.ceil(
      Number((quantityRule.costCreditsPerUnit * quantity).toFixed(12))
    );
    const billedCredits = roundPublishedCredits(
      creditsAtCost * (1 + quantityRule.markupBps / 10_000),
      quantityRule.roundingIncrement
    );
    const providerObservability = resolveProviderObservabilityBreakdown(
      modelId,
      providerCostParams,
      pricingPolicy
    );
    return {
      credits: billedCredits,
      usd: billedCredits / resolvedPolicy.creditUsdScale,
      rawCredits: providerObservability?.rawCredits ?? creditsAtCost,
      usdRaw: providerObservability?.usdRaw ?? creditsAtCost / resolvedPolicy.creditUsdScale,
      megapixels: providerObservability?.megapixels ?? null,
      width: providerObservability?.width ?? null,
      height: providerObservability?.height ?? null,
      variantId,
    };
  }

  if (requirePublishedBillingRule) {
    return null;
  }

  const breakdown = computeCostForModel(modelId, normalizedParams, pricingPolicy);
  if (!breakdown) return null;

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
    usageRateMultiplier: resolveUsageRateMultiplier(modelId, normalizedParams),
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
}

export const resolvePricingGridBilledCredits = (input: {
  modelId: string;
  params?: Omit<PricingParams, "modelId">;
  pricingPolicy?: ModelPricingPolicyDocument | null;
  requirePublishedBillingRule?: boolean;
}): number | null => resolvePricingGridCostBreakdown(input)?.credits ?? null;
