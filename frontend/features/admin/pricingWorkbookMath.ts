import type {
  AdminCreditPricingBreakdown,
  AdminPricingModelRow,
  AdminPricingPreviewVariant,
} from "./types";
import {
  compactModelPricingPolicyDocument,
  type ModelPricingPolicyDocument,
} from "../../lib/model-runtime/pricingPolicy";
import { buildDraftPricingPreviewVariants } from "./pricingCostDocs";
import { getModelTypeLabel } from "./pricingFormatting";
import {
  parseDurationSecondsInput,
  type AudioDraftByModelId,
  type AspectDraftByModelId,
  type DurationDraftByModelId,
  type ModelPricingSortOption,
  type ResolutionDraftByModelId,
} from "./pricingDrafts";

export const getCreditsAtProviderCost = (
  breakdown: AdminCreditPricingBreakdown | null | undefined,
  creditUsdScale: number
): number | null => {
  if (breakdown?.rawCredits != null && Number.isFinite(breakdown.rawCredits)) {
    return Math.max(0, breakdown.rawCredits);
  }
  if (breakdown?.usdRaw == null || !Number.isFinite(breakdown.usdRaw)) return null;
  return Math.max(0, breakdown.usdRaw) * creditUsdScale;
};

export const getWorkbookBillableCredits = ({
  breakdown,
  creditsAtCost,
  markupBps,
  roundingIncrement,
}: {
  breakdown?: AdminCreditPricingBreakdown | null;
  creditsAtCost: number | null;
  markupBps: number | null | undefined;
  roundingIncrement: number | null | undefined;
}): number | null => {
  if (breakdown?.billedCredits != null && Number.isFinite(breakdown.billedCredits)) {
    return Math.max(0, breakdown.billedCredits);
  }
  if (creditsAtCost == null || !Number.isFinite(creditsAtCost)) return null;
  const markedCredits = creditsAtCost * (1 + Math.max(0, markupBps ?? 0) / 10_000);
  if (roundingIncrement == null || !Number.isFinite(roundingIncrement) || roundingIncrement <= 0) {
    return markedCredits;
  }
  return Math.ceil(markedCredits / roundingIncrement) * roundingIncrement;
};

export const getWorkbookBillableUsd = (
  billableCredits: number | null,
  creditUsdScale: number,
  billedUsdOverride?: number | null
): number | null => {
  if (billedUsdOverride != null && Number.isFinite(billedUsdOverride)) {
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

export const getPricingMargin = (
  breakdown: AdminCreditPricingBreakdown | null | undefined,
  billedUsdOverride?: number | null
): { usd: number; percent: number | null } | null => {
  const billedUsd = billedUsdOverride ?? breakdown?.billedUsd;
  if (
    breakdown?.usdRaw == null ||
    billedUsd == null ||
    !Number.isFinite(breakdown.usdRaw) ||
    !Number.isFinite(billedUsd)
  ) {
    return null;
  }
  const marginUsd = billedUsd - breakdown.usdRaw;
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
  const draftDurationSeconds =
    durationDraftValue !== undefined ? parseDurationSecondsInput(durationDraftValue) : null;
  const costs = buildDraftPricingPreviewVariants(model, pricingPolicy, {
    durationSeconds: draftDurationSeconds,
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

  if (!hasCustomCreditUsdScale && !hasCustomMarkup && !hasCustomRoundingIncrement) {
    delete nextPerModel[modelId];
  } else {
    const nextModelOverride = {} as NonNullable<(typeof nextPerModel)[string]>;
    if (hasCustomCreditUsdScale && typeof mergedOverride.creditUsdScale === "number") {
      nextModelOverride.creditUsdScale = mergedOverride.creditUsdScale;
    }
    if (hasCustomMarkup && typeof mergedOverride.markupBps === "number") {
      nextModelOverride.markupBps = mergedOverride.markupBps;
    }
    if (hasCustomRoundingIncrement && typeof mergedOverride.roundingIncrement === "number") {
      nextModelOverride.roundingIncrement = mergedOverride.roundingIncrement;
    }
    nextPerModel[modelId] = nextModelOverride;
  }

  return compactModelPricingPolicyDocument({
    ...policy,
    perModel: nextPerModel,
  });
};
