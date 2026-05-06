import type {
  AdminCreditPricingBreakdown,
  AdminPricingModelRow,
  AdminPricingPreviewVariant,
} from "./types";
import {
  compactModelPricingPolicyDocument,
  type ModelPricingPolicyDocument,
  type ModelPricingPerModelOverride,
} from "../../lib/model-runtime/pricingPolicy";
import { buildDraftPricingPreviewVariants } from "./pricingCostDocs";
import { getModelTypeLabel } from "./pricingFormatting";
import {
  getModelUsageControl,
  getModelUsageValue,
  type ModelUsageKind,
  type AudioDraftByModelId,
  type AspectDraftByModelId,
  type DurationDraftByModelId,
  type ModelPricingSortOption,
  type ResolutionDraftByModelId,
} from "./pricingDrafts";

export const getCreditsAtProviderCost = (
  breakdown: AdminCreditPricingBreakdown | null | undefined,
  creditUsdScale: number,
  options: {
    preferRuntimeCredits?: boolean;
    providerCostUsd?: number | null;
  } = {}
): number | null => {
  if (options.providerCostUsd != null && Number.isFinite(options.providerCostUsd)) {
    return Math.max(
      0,
      Math.ceil(Number((Math.max(0, options.providerCostUsd) * creditUsdScale).toFixed(12)))
    );
  }
  const preferRuntimeCredits = options.preferRuntimeCredits ?? true;
  if (
    preferRuntimeCredits &&
    breakdown?.rawCredits != null &&
    Number.isFinite(breakdown.rawCredits)
  ) {
    return Math.max(0, breakdown.rawCredits);
  }
  if (breakdown?.usdRaw == null || !Number.isFinite(breakdown.usdRaw)) return null;
  return Math.max(
    0,
    Math.ceil(Number((Math.max(0, breakdown.usdRaw) * creditUsdScale).toFixed(12)))
  );
};

export const getWorkbookBillableCredits = ({
  breakdown,
  creditsAtCost,
  markupBps,
  roundingIncrement,
  preferRuntimeBilledCredits = true,
}: {
  breakdown?: AdminCreditPricingBreakdown | null;
  creditsAtCost: number | null;
  markupBps: number | null | undefined;
  roundingIncrement: number | null | undefined;
  preferRuntimeBilledCredits?: boolean;
}): number | null => {
  if (
    preferRuntimeBilledCredits &&
    breakdown?.billedCredits != null &&
    Number.isFinite(breakdown.billedCredits)
  ) {
    return Math.max(0, breakdown.billedCredits);
  }
  if (creditsAtCost == null || !Number.isFinite(creditsAtCost)) return null;
  const markedCredits = creditsAtCost * (1 + Math.max(0, markupBps ?? 0) / 10_000);
  if (roundingIncrement == null || !Number.isFinite(roundingIncrement) || roundingIncrement <= 0) {
    return Math.ceil(markedCredits);
  }
  return Math.ceil(markedCredits / roundingIncrement) * roundingIncrement;
};

export const getWorkbookBillableUsd = (
  billableCredits: number | null,
  creditUsdScale: number,
  billedUsdOverride?: number | null,
  options: {
    preferRuntimeBilledUsd?: boolean;
  } = {}
): number | null => {
  if (
    (options.preferRuntimeBilledUsd ?? true) &&
    billedUsdOverride != null &&
    Number.isFinite(billedUsdOverride)
  ) {
    return Math.max(0, billedUsdOverride);
  }
  if (
    billableCredits == null ||
    !Number.isFinite(billableCredits) ||
    !Number.isFinite(creditUsdScale) ||
    creditUsdScale <= 0
  ) {
    return null;
  }
  return billableCredits / creditUsdScale;
};

export const getProviderCostUsdPerSecond = (
  providerCostUsd: number | null | undefined,
  durationSeconds: number | null | undefined
): number | null => {
  if (
    providerCostUsd == null ||
    !Number.isFinite(providerCostUsd) ||
    durationSeconds == null ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0
  ) {
    return null;
  }
  return providerCostUsd / durationSeconds;
};

export const getEffectiveProviderCostUsdPerSecond = ({
  providerCostUsd,
  providerUsdPerSecondOverride,
  durationSeconds,
}: {
  providerCostUsd: number | null | undefined;
  providerUsdPerSecondOverride?: number | null;
  durationSeconds?: number | null;
}): number | null => {
  if (
    providerUsdPerSecondOverride != null &&
    Number.isFinite(providerUsdPerSecondOverride) &&
    providerUsdPerSecondOverride > 0
  ) {
    return providerUsdPerSecondOverride;
  }
  return getProviderCostUsdPerSecond(providerCostUsd, durationSeconds);
};

export const getEffectiveProviderCostUsd = ({
  breakdown,
  providerUsdOverride,
  providerUsdPerSecondOverride,
  durationSeconds,
  usageRateMultiplier,
}: {
  breakdown: AdminCreditPricingBreakdown | null | undefined;
  providerUsdOverride?: number | null;
  providerUsdPerSecondOverride?: number | null;
  durationSeconds?: number | null;
  usageRateMultiplier?: number | null;
}): number | null => {
  if (
    providerUsdPerSecondOverride != null &&
    Number.isFinite(providerUsdPerSecondOverride) &&
    providerUsdPerSecondOverride > 0 &&
    durationSeconds != null &&
    Number.isFinite(durationSeconds) &&
    durationSeconds > 0
  ) {
    return providerUsdPerSecondOverride * durationSeconds;
  }
  if (
    providerUsdOverride != null &&
    Number.isFinite(providerUsdOverride) &&
    providerUsdOverride > 0
  ) {
    if (
      usageRateMultiplier != null &&
      Number.isFinite(usageRateMultiplier) &&
      usageRateMultiplier > 0
    ) {
      return providerUsdOverride * usageRateMultiplier;
    }
    return providerUsdOverride;
  }
  return breakdown?.usdRaw ?? null;
};

export type RateSourceInputMode =
  | "per_second"
  | "per_minute"
  | "per_generation"
  | "per_1k_chars"
  | "per_1m_tokens"
  | "flat";

const isPerSecondRateSource = (pricingStrategyLabel: string): boolean => {
  const normalized = pricingStrategyLabel.toLowerCase();
  return normalized.includes("per output second") || normalized.includes("per second");
};

const isPerMinuteRateSource = (pricingStrategyLabel: string): boolean =>
  pricingStrategyLabel.toLowerCase().includes("per minute");

export const getRateSourceInputMode = ({
  pricingStrategyLabel,
  usageKind,
}: {
  pricingStrategyLabel: string;
  usageKind: ModelUsageKind;
}): RateSourceInputMode => {
  if (isPerSecondRateSource(pricingStrategyLabel)) return "per_second";
  if (isPerMinuteRateSource(pricingStrategyLabel)) return "per_minute";
  if (usageKind === "generation_count") return "per_generation";
  if (usageKind === "text_characters") return "per_1k_chars";
  if (usageKind === "input_tokens") return "per_1m_tokens";
  return "flat";
};

export const getModelRateSourceInputMode = (model: AdminPricingModelRow): RateSourceInputMode =>
  getRateSourceInputMode({
    pricingStrategyLabel: model.pricingStrategyLabel,
    usageKind: getModelUsageControl(model).kind,
  });

export const getRateSourceCostUsd = ({
  rateSourceInputMode,
  providerCostUsd,
  providerCostUsdPerSecond,
  durationSeconds,
  usageRateMultiplier,
}: {
  rateSourceInputMode: RateSourceInputMode;
  providerCostUsd: number | null | undefined;
  providerCostUsdPerSecond: number | null | undefined;
  durationSeconds: number | null | undefined;
  usageRateMultiplier?: number | null;
}): number | null => {
  if (rateSourceInputMode === "per_second") {
    return providerCostUsdPerSecond ?? null;
  }
  if (rateSourceInputMode === "per_minute") {
    if (
      providerCostUsd != null &&
      Number.isFinite(providerCostUsd) &&
      durationSeconds != null &&
      Number.isFinite(durationSeconds) &&
      durationSeconds > 0
    ) {
      return providerCostUsd / (durationSeconds / 60);
    }
    return providerCostUsdPerSecond != null ? providerCostUsdPerSecond * 60 : null;
  }
  if (
    (rateSourceInputMode === "per_generation" ||
      rateSourceInputMode === "per_1k_chars" ||
      rateSourceInputMode === "per_1m_tokens") &&
    providerCostUsd != null &&
    Number.isFinite(providerCostUsd) &&
    usageRateMultiplier != null &&
    Number.isFinite(usageRateMultiplier) &&
    usageRateMultiplier > 0
  ) {
    return providerCostUsd / usageRateMultiplier;
  }
  return providerCostUsd ?? null;
};

export const getPricingMargin = (
  breakdown: AdminCreditPricingBreakdown | null | undefined,
  billedUsdOverride?: number | null,
  providerCostUsdOverride?: number | null
): { usd: number; percent: number | null } | null => {
  const billedUsd = billedUsdOverride ?? breakdown?.billedUsd;
  const providerCostUsd = providerCostUsdOverride ?? breakdown?.usdRaw;
  if (
    providerCostUsd == null ||
    billedUsd == null ||
    !Number.isFinite(providerCostUsd) ||
    !Number.isFinite(billedUsd)
  ) {
    return null;
  }
  const marginUsd = billedUsd - providerCostUsd;
  return {
    usd: marginUsd,
    percent: billedUsd > 0 ? (marginUsd / billedUsd) * 100 : null,
  };
};

const compareText = (left: string, right: string, direction: "asc" | "desc"): number => {
  const comparison = left.localeCompare(right, undefined, {
    numeric: true,
    sensitivity: "base",
  });
  return direction === "asc" ? comparison : -comparison;
};

const MODEL_TYPE_FAMILY_SORT_ORDER: Record<string, number> = {
  "text → text": 10,
  "text → image": 20,
  "text/image → image": 25,
  "image → image": 30,
  image: 35,
  "text → video": 40,
  "image → video": 50,
  "video → video": 60,
  video: 65,
  "text → sound": 70,
  "sound → sound": 80,
  text: 90,
};

const compareModelTypeFamily = (leftLabel: string, rightLabel: string): number =>
  (MODEL_TYPE_FAMILY_SORT_ORDER[leftLabel] ?? 100) -
    (MODEL_TYPE_FAMILY_SORT_ORDER[rightLabel] ?? 100) || compareText(leftLabel, rightLabel, "asc");

const compareFiniteNumber = (
  left: number | null,
  right: number | null,
  direction: "asc" | "desc"
): number => {
  const leftIsFinite = left != null && Number.isFinite(left);
  const rightIsFinite = right != null && Number.isFinite(right);
  if (!leftIsFinite && !rightIsFinite) return 0;
  if (!leftIsFinite) return 1;
  if (!rightIsFinite) return -1;
  return direction === "asc" ? left - right : right - left;
};

const getModelRawCostSortValue = (
  model: AdminPricingModelRow,
  pricingPolicy: ModelPricingPolicyDocument,
  durationDrafts: DurationDraftByModelId,
  aspectDrafts: AspectDraftByModelId,
  resolutionDrafts: ResolutionDraftByModelId,
  audioDrafts: AudioDraftByModelId,
  direction: "asc" | "desc"
): number | null => {
  const durationDraftValue = durationDrafts[model.id];
  const draftUsageAmount =
    durationDraftValue !== undefined ? getModelUsageValue(model, durationDraftValue) : null;
  const costs = buildDraftPricingPreviewVariants(model, pricingPolicy, {
    usageAmount: draftUsageAmount,
  })
    .map((variant) => variant.breakdown?.usdRaw ?? null)
    .filter((value): value is number => value != null && Number.isFinite(value));
  if (!costs.length) return null;
  return direction === "asc" ? Math.min(...costs) : Math.max(...costs);
};

export const sortAdminPricingModels = ({
  models,
  sortOption,
  pricingPolicy,
  durationDrafts,
  aspectDrafts = {},
  resolutionDrafts = {},
  audioDrafts = {},
}: {
  models: AdminPricingModelRow[];
  sortOption: ModelPricingSortOption;
  pricingPolicy: ModelPricingPolicyDocument;
  durationDrafts: DurationDraftByModelId;
  aspectDrafts?: AspectDraftByModelId;
  resolutionDrafts?: ResolutionDraftByModelId;
  audioDrafts?: AudioDraftByModelId;
}): AdminPricingModelRow[] => {
  const sorted = [...models];
  sorted.sort((left, right) => {
    if (sortOption === "model_asc" || sortOption === "model_desc") {
      return (
        compareText(left.label, right.label, sortOption === "model_asc" ? "asc" : "desc") ||
        compareText(left.id, right.id, "asc")
      );
    }
    if (sortOption === "type") {
      return (
        compareModelTypeFamily(getModelTypeLabel(left), getModelTypeLabel(right)) ||
        compareText(left.label, right.label, "asc")
      );
    }
    const direction = sortOption === "cost_asc" ? "asc" : "desc";
    return (
      compareFiniteNumber(
        getModelRawCostSortValue(
          left,
          pricingPolicy,
          durationDrafts,
          aspectDrafts,
          resolutionDrafts,
          audioDrafts,
          direction
        ),
        getModelRawCostSortValue(
          right,
          pricingPolicy,
          durationDrafts,
          aspectDrafts,
          resolutionDrafts,
          audioDrafts,
          direction
        ),
        direction
      ) || compareText(left.label, right.label, "asc")
    );
  });
  return sorted;
};

export const sortAdminPricingPreviewVariants = ({
  model,
  variants,
  sortOption,
}: {
  model: AdminPricingModelRow;
  variants: Array<AdminPricingPreviewVariant | null>;
  sortOption: ModelPricingSortOption;
}): Array<AdminPricingPreviewVariant | null> => {
  if (sortOption === "model_asc" || sortOption === "model_desc") return variants;
  const sorted = [...variants];
  sorted.sort((left, right) => {
    if (sortOption === "type") {
      return compareModelTypeFamily(
        getModelTypeLabel(model, left),
        getModelTypeLabel(model, right)
      );
    }
    return compareFiniteNumber(
      left?.breakdown?.usdRaw ?? null,
      right?.breakdown?.usdRaw ?? null,
      sortOption === "cost_asc" ? "asc" : "desc"
    );
  });
  return sorted;
};

export const normalizeModelOverrideDraft = (
  policy: ModelPricingPolicyDocument,
  modelId: string,
  nextOverride: {
    creditUsdScale?: number | null;
    markupBps?: number | null;
    roundingIncrement?: number | null;
    providerUsdOverride?: number | null;
    providerUsdPerSecondOverride?: number | null;
  }
): ModelPricingPolicyDocument => {
  const currentOverride = policy.perModel[modelId] ?? {};
  const mergedOverride = {
    creditUsdScale:
      nextOverride.creditUsdScale !== undefined
        ? nextOverride.creditUsdScale
        : currentOverride.creditUsdScale,
    markupBps:
      nextOverride.markupBps !== undefined ? nextOverride.markupBps : currentOverride.markupBps,
    roundingIncrement:
      nextOverride.roundingIncrement !== undefined
        ? nextOverride.roundingIncrement
        : currentOverride.roundingIncrement,
    providerUsdOverride:
      nextOverride.providerUsdOverride !== undefined
        ? nextOverride.providerUsdOverride
        : currentOverride.providerUsdOverride,
    providerUsdPerSecondOverride:
      nextOverride.providerUsdPerSecondOverride !== undefined
        ? nextOverride.providerUsdPerSecondOverride
        : currentOverride.providerUsdPerSecondOverride,
  };

  const nextPerModel = { ...policy.perModel };
  const hasCustomCreditUsdScale =
    typeof mergedOverride.creditUsdScale === "number" &&
    mergedOverride.creditUsdScale > 0 &&
    mergedOverride.creditUsdScale !== policy.global.creditUsdScale;
  const hasCustomMarkup =
    typeof mergedOverride.markupBps === "number" && mergedOverride.markupBps >= 0;
  const hasCustomRoundingIncrement =
    typeof mergedOverride.roundingIncrement === "number" && mergedOverride.roundingIncrement > 0;
  const hasCustomProviderUsdOverride =
    typeof mergedOverride.providerUsdOverride === "number" &&
    mergedOverride.providerUsdOverride > 0;
  const hasCustomProviderUsdPerSecondOverride =
    typeof mergedOverride.providerUsdPerSecondOverride === "number" &&
    mergedOverride.providerUsdPerSecondOverride > 0;

  if (
    !hasCustomCreditUsdScale &&
    !hasCustomMarkup &&
    !hasCustomRoundingIncrement &&
    !hasCustomProviderUsdOverride &&
    !hasCustomProviderUsdPerSecondOverride
  ) {
    if (currentOverride.variants && Object.keys(currentOverride.variants).length > 0) {
      nextPerModel[modelId] = {
        variants: { ...currentOverride.variants },
      };
    } else {
      delete nextPerModel[modelId];
    }
  } else {
    const nextModelOverride = {
      ...(currentOverride.variants ? { variants: { ...currentOverride.variants } } : {}),
    } as NonNullable<(typeof nextPerModel)[string]>;
    if (hasCustomCreditUsdScale && typeof mergedOverride.creditUsdScale === "number") {
      nextModelOverride.creditUsdScale = mergedOverride.creditUsdScale;
    }
    if (hasCustomMarkup && typeof mergedOverride.markupBps === "number") {
      nextModelOverride.markupBps = mergedOverride.markupBps;
    }
    if (hasCustomRoundingIncrement && typeof mergedOverride.roundingIncrement === "number") {
      nextModelOverride.roundingIncrement = mergedOverride.roundingIncrement;
    }
    if (hasCustomProviderUsdOverride && typeof mergedOverride.providerUsdOverride === "number") {
      nextModelOverride.providerUsdOverride = mergedOverride.providerUsdOverride;
    }
    if (
      hasCustomProviderUsdPerSecondOverride &&
      typeof mergedOverride.providerUsdPerSecondOverride === "number"
    ) {
      nextModelOverride.providerUsdPerSecondOverride = mergedOverride.providerUsdPerSecondOverride;
    }
    nextPerModel[modelId] = nextModelOverride;
  }

  return compactModelPricingPolicyDocument({
    ...policy,
    perModel: nextPerModel,
  });
};

export const normalizeVariantOverrideDraft = (
  policy: ModelPricingPolicyDocument,
  modelId: string,
  variantId: string,
  nextOverride: {
    creditUsdScale?: number | null;
    markupBps?: number | null;
    roundingIncrement?: number | null;
    providerUsdOverride?: number | null;
    providerUsdPerSecondOverride?: number | null;
  }
): ModelPricingPolicyDocument => {
  const currentModelOverride = policy.perModel[modelId] ?? {};
  const currentVariantOverride = currentModelOverride.variants?.[variantId] ?? {};
  const mergedVariantOverride = {
    creditUsdScale:
      nextOverride.creditUsdScale !== undefined
        ? nextOverride.creditUsdScale
        : currentVariantOverride.creditUsdScale,
    markupBps:
      nextOverride.markupBps !== undefined
        ? nextOverride.markupBps
        : currentVariantOverride.markupBps,
    roundingIncrement:
      nextOverride.roundingIncrement !== undefined
        ? nextOverride.roundingIncrement
        : currentVariantOverride.roundingIncrement,
    providerUsdOverride:
      nextOverride.providerUsdOverride !== undefined
        ? nextOverride.providerUsdOverride
        : currentVariantOverride.providerUsdOverride,
    providerUsdPerSecondOverride:
      nextOverride.providerUsdPerSecondOverride !== undefined
        ? nextOverride.providerUsdPerSecondOverride
        : currentVariantOverride.providerUsdPerSecondOverride,
  };

  const modelCreditUsdScale = currentModelOverride.creditUsdScale ?? policy.global.creditUsdScale;
  const modelMarkupBps = currentModelOverride.markupBps ?? null;
  const modelRoundingIncrement = currentModelOverride.roundingIncrement ?? null;
  const modelProviderUsdOverride = currentModelOverride.providerUsdOverride ?? null;
  const modelProviderUsdPerSecondOverride =
    currentModelOverride.providerUsdPerSecondOverride ?? null;
  const hasCustomCreditUsdScale =
    typeof mergedVariantOverride.creditUsdScale === "number" &&
    mergedVariantOverride.creditUsdScale > 0 &&
    mergedVariantOverride.creditUsdScale !== modelCreditUsdScale;
  const hasCustomMarkup =
    typeof mergedVariantOverride.markupBps === "number" &&
    mergedVariantOverride.markupBps >= 0 &&
    mergedVariantOverride.markupBps !== modelMarkupBps;
  const hasCustomRoundingIncrement =
    typeof mergedVariantOverride.roundingIncrement === "number" &&
    mergedVariantOverride.roundingIncrement > 0 &&
    mergedVariantOverride.roundingIncrement !== modelRoundingIncrement;
  const hasCustomProviderUsdOverride =
    typeof mergedVariantOverride.providerUsdOverride === "number" &&
    mergedVariantOverride.providerUsdOverride > 0 &&
    mergedVariantOverride.providerUsdOverride !== modelProviderUsdOverride;
  const hasCustomProviderUsdPerSecondOverride =
    typeof mergedVariantOverride.providerUsdPerSecondOverride === "number" &&
    mergedVariantOverride.providerUsdPerSecondOverride > 0 &&
    mergedVariantOverride.providerUsdPerSecondOverride !== modelProviderUsdPerSecondOverride;

  const nextPerModel = { ...policy.perModel };
  const nextVariants = { ...(currentModelOverride.variants ?? {}) };
  const nextModelOverride: ModelPricingPerModelOverride = {
    ...currentModelOverride,
    variants: nextVariants,
  };

  if (
    !hasCustomCreditUsdScale &&
    !hasCustomMarkup &&
    !hasCustomRoundingIncrement &&
    !hasCustomProviderUsdOverride &&
    !hasCustomProviderUsdPerSecondOverride
  ) {
    delete nextVariants[variantId];
  } else {
    const nextVariantOverride = {} as NonNullable<(typeof nextVariants)[string]>;
    if (hasCustomCreditUsdScale && typeof mergedVariantOverride.creditUsdScale === "number") {
      nextVariantOverride.creditUsdScale = mergedVariantOverride.creditUsdScale;
    }
    if (hasCustomMarkup && typeof mergedVariantOverride.markupBps === "number") {
      nextVariantOverride.markupBps = mergedVariantOverride.markupBps;
    }
    if (hasCustomRoundingIncrement && typeof mergedVariantOverride.roundingIncrement === "number") {
      nextVariantOverride.roundingIncrement = mergedVariantOverride.roundingIncrement;
    }
    if (
      hasCustomProviderUsdOverride &&
      typeof mergedVariantOverride.providerUsdOverride === "number"
    ) {
      nextVariantOverride.providerUsdOverride = mergedVariantOverride.providerUsdOverride;
    }
    if (
      hasCustomProviderUsdPerSecondOverride &&
      typeof mergedVariantOverride.providerUsdPerSecondOverride === "number"
    ) {
      nextVariantOverride.providerUsdPerSecondOverride =
        mergedVariantOverride.providerUsdPerSecondOverride;
    }
    nextVariants[variantId] = nextVariantOverride;
  }

  if (!Object.keys(nextVariants).length) {
    delete nextModelOverride.variants;
  }

  if (
    nextModelOverride.creditUsdScale == null &&
    nextModelOverride.markupBps == null &&
    nextModelOverride.roundingIncrement == null &&
    nextModelOverride.providerUsdOverride == null &&
    nextModelOverride.providerUsdPerSecondOverride == null &&
    !nextModelOverride.variants
  ) {
    delete nextPerModel[modelId];
  } else {
    nextPerModel[modelId] = nextModelOverride;
  }

  return compactModelPricingPolicyDocument({
    ...policy,
    perModel: nextPerModel,
  });
};
