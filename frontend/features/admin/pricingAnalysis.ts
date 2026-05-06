import {
  resolveModelPricingForModel,
  type ModelPricingPolicyDocument,
} from "../../lib/model-runtime/pricingPolicy";
import { buildDraftPricingPreviewVariants } from "./pricingCostDocs";
import {
  formatCredits,
  getModelUsageLabel,
  getModelTypeLabel,
  getVariantSpecSummary,
} from "./pricingFormatting";
import {
  getModelDurationSecondsForUsage,
  getModelUsageDisplayValue,
  getModelUsageRateMultiplier,
  getModelUsageValue,
  type AudioDraftByModelId,
  type AspectDraftByModelId,
  type ResolutionDraftByModelId,
} from "./pricingDrafts";
import {
  CALCULATOR_REFERENCE_INCLUDED_CREDITS,
  CALCULATOR_REFERENCE_PLAN_PRICE_USD,
} from "./pricingReferenceDefaults";
import {
  getEffectiveProviderCostUsd,
  getEffectiveProviderCostUsdPerSecond,
  getCreditsAtProviderCost,
  getPricingMargin,
  getWorkbookBillableCredits,
  getWorkbookBillableUsd,
} from "./pricingWorkbookMath";
import type { AdminPricingModelRow, AdminPricingPlanRow } from "./types";

const DEFAULT_PROCESSOR_PERCENT = 2.9;
const DEFAULT_PROCESSOR_FLAT_USD = 0.3;

const parseNumericInput = (value: string): number | null => {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const clampNonNegative = (value: number | null): number | null =>
  value == null || !Number.isFinite(value) ? null : Math.max(0, value);

export type PricingGridTab = "grid" | "model-economics" | "plan-economics" | "usage-mix";

export type ModelEconomicsRow = {
  key: string;
  modelId: string;
  variantId: string;
  modelLabel: string;
  provider: AdminPricingModelRow["provider"];
  typeLabel: string;
  specLabel: string;
  usageLabel: string;
  usageValueLabel: string;
  durationSeconds: number | null;
  providerCostUsd: number | null;
  costPerSecondUsd: number | null;
  creditsAtCost: number | null;
  billedCredits: number | null;
  billedUsd: number | null;
  marginUsd: number | null;
  marginPercent: number | null;
  creditUsdScale: number | null;
  markupBps: number | null;
  roundingIncrement: number | null;
  pricingAuthority: AdminPricingModelRow["pricingAuthority"];
};

export type PlanEconomicsDraft = {
  priceUsd: string;
  includedCredits: string;
  discountPct: string;
  affiliatePct: string;
  processorPct: string;
  processorFlatUsd: string;
};

export type PlanEconomicsSummary = {
  grossUsd: number | null;
  discountAmountUsd: number | null;
  afterDiscountUsd: number | null;
  processorFeeUsd: number | null;
  effectiveRevenueUsd: number | null;
  affiliateCostUsd: number | null;
  netRevenueUsd: number | null;
  dollarPerCredit: number | null;
  includedCredits: number | null;
};

export type UsageMixDraftRow = {
  id: string;
  modelId: string;
  variantId: string;
  durationSeconds: string;
  runsPerMonth: string;
};

export type UsageMixAnalysisRow = {
  id: string;
  modelKey: string;
  modelLabel: string;
  typeLabel: string;
  runsPerMonth: number | null;
  durationSeconds: number | null;
  billedCreditsPerRun: number | null;
  providerCostPerRunUsd: number | null;
  revenuePerRunUsd: number | null;
  profitPerRunUsd: number | null;
  providerCostPerMonthUsd: number | null;
  revenuePerMonthUsd: number | null;
  profitPerMonthUsd: number | null;
  runSharePercent: number | null;
};

const buildModelEconomicsRow = ({
  model,
  variant,
  pricingPolicy,
  durationSecondsOverride = null,
  variantCount = 1,
  aspectDrafts = {},
  resolutionDrafts = {},
  audioDrafts = {},
}: {
  model: AdminPricingModelRow;
  variant: NonNullable<ReturnType<typeof buildDraftPricingPreviewVariants>[number]>;
  pricingPolicy: ModelPricingPolicyDocument;
  durationSecondsOverride?: number | null;
  variantCount?: number;
  aspectDrafts?: AspectDraftByModelId;
  resolutionDrafts?: ResolutionDraftByModelId;
  audioDrafts?: AudioDraftByModelId;
}): ModelEconomicsRow => {
  const resolvedPolicy = resolveModelPricingForModel(pricingPolicy, model.id, variant.id);
  const isSharedPolicyModel = model.pricingAuthority === "shared_policy";
  const usageValue = durationSecondsOverride ?? getModelUsageValue(model, undefined);
  const durationSeconds = getModelDurationSecondsForUsage(model, usageValue);
  const usageRateMultiplier = getModelUsageRateMultiplier(model, usageValue);
  const providerCostUsd = isSharedPolicyModel
    ? getEffectiveProviderCostUsd({
        breakdown: variant.breakdown,
        providerUsdOverride: resolvedPolicy.providerUsdOverride,
        providerUsdPerSecondOverride: resolvedPolicy.providerUsdPerSecondOverride,
        durationSeconds,
        usageRateMultiplier,
      })
    : variant.breakdown.usdRaw;
  const costPerSecondUsd = isSharedPolicyModel
    ? getEffectiveProviderCostUsdPerSecond({
        providerCostUsd,
        providerUsdPerSecondOverride: resolvedPolicy.providerUsdPerSecondOverride,
        durationSeconds,
      })
    : durationSeconds != null && durationSeconds > 0 && providerCostUsd != null
      ? providerCostUsd / durationSeconds
      : null;
  const creditsAtCost = isSharedPolicyModel
    ? getCreditsAtProviderCost(variant.breakdown, resolvedPolicy.creditUsdScale, {
        preferRuntimeCredits: false,
        providerCostUsd,
      })
    : (variant.breakdown.rawCredits ?? null);
  const billedCredits =
    isSharedPolicyModel && creditsAtCost != null
      ? getWorkbookBillableCredits({
          breakdown: variant.breakdown,
          creditsAtCost,
          markupBps: resolvedPolicy.markupBps,
          roundingIncrement: resolvedPolicy.roundingIncrement,
          preferRuntimeBilledCredits: false,
        })
      : (variant.breakdown.billedCredits ?? null);
  const billedUsd =
    isSharedPolicyModel && billedCredits != null
      ? getWorkbookBillableUsd(
          billedCredits,
          resolvedPolicy.creditUsdScale,
          variant.breakdown.billedUsd,
          {
            preferRuntimeBilledUsd: false,
          }
        )
      : (variant.breakdown.billedUsd ?? null);
  const margin = getPricingMargin(variant.breakdown, billedUsd, providerCostUsd);

  return {
    key: `${model.id}:${variant.id}`,
    modelId: model.id,
    variantId: variant.id,
    modelLabel: model.label,
    provider: model.provider,
    typeLabel: getModelTypeLabel(model, variant),
    specLabel: getVariantSpecSummary(model, variant, variantCount, {
      aspectDrafts,
      resolutionDrafts,
      audioDrafts,
    }),
    usageLabel: getModelUsageLabel(model),
    usageValueLabel: getModelUsageDisplayValue(model, usageValue),
    durationSeconds,
    providerCostUsd,
    costPerSecondUsd,
    creditsAtCost,
    billedCredits,
    billedUsd,
    marginUsd: margin?.usd ?? null,
    marginPercent: margin?.percent ?? null,
    creditUsdScale: isSharedPolicyModel ? resolvedPolicy.creditUsdScale : null,
    markupBps: isSharedPolicyModel ? resolvedPolicy.markupBps : null,
    roundingIncrement: isSharedPolicyModel ? resolvedPolicy.roundingIncrement : null,
    pricingAuthority: model.pricingAuthority,
  };
};

export const buildModelEconomicsRows = ({
  models,
  pricingPolicy,
  durationDrafts = {},
  aspectDrafts = {},
  resolutionDrafts = {},
  audioDrafts = {},
}: {
  models: AdminPricingModelRow[];
  pricingPolicy: ModelPricingPolicyDocument;
  durationDrafts?: Record<string, string>;
  aspectDrafts?: AspectDraftByModelId;
  resolutionDrafts?: ResolutionDraftByModelId;
  audioDrafts?: AudioDraftByModelId;
}): ModelEconomicsRow[] =>
  models.flatMap((model) => {
    const parsedDuration = getModelUsageValue(model, durationDrafts[model.id]);
    const variants = buildDraftPricingPreviewVariants(model, pricingPolicy, {
      usageAmount: parsedDuration,
    });
    return variants.map((variant) =>
      buildModelEconomicsRow({
        model,
        variant,
        pricingPolicy,
        durationSecondsOverride: parsedDuration,
        variantCount: variants.length,
        aspectDrafts,
        resolutionDrafts,
        audioDrafts,
      })
    );
  });

export const buildSelectedModelEconomicsRow = ({
  models,
  pricingPolicy,
  modelId,
  variantId,
  durationSeconds,
  aspectDrafts = {},
  resolutionDrafts = {},
  audioDrafts = {},
}: {
  models: AdminPricingModelRow[];
  pricingPolicy: ModelPricingPolicyDocument;
  modelId: string;
  variantId: string;
  durationSeconds?: string | null;
  aspectDrafts?: AspectDraftByModelId;
  resolutionDrafts?: ResolutionDraftByModelId;
  audioDrafts?: AudioDraftByModelId;
}): ModelEconomicsRow | null => {
  const model = models.find((candidate) => candidate.id === modelId);
  if (!model) return null;
  const parsedDuration =
    durationSeconds == null ? null : getModelUsageValue(model, String(durationSeconds));
  const variants = buildDraftPricingPreviewVariants(model, pricingPolicy, {
    usageAmount: parsedDuration,
  });
  const selectedVariant =
    variants.find((candidate) => candidate.id === variantId) ?? variants[0] ?? null;
  if (!selectedVariant) return null;
  return buildModelEconomicsRow({
    model,
    variant: selectedVariant,
    pricingPolicy,
    durationSecondsOverride: parsedDuration,
    variantCount: variants.length,
    aspectDrafts,
    resolutionDrafts,
    audioDrafts,
  });
};

export const buildDefaultPlanEconomicsDraft = (
  plan: AdminPricingPlanRow | null | undefined
): PlanEconomicsDraft => {
  const livePriceCents =
    plan?.monthlyOffer?.recurringPriceCents ??
    plan?.recurringPriceCents ??
    Number(CALCULATOR_REFERENCE_PLAN_PRICE_USD) * 100;
  const liveCredits =
    plan?.monthlyOffer?.monthlyCreditsCents ??
    plan?.monthlyCreditsCents ??
    Number(CALCULATOR_REFERENCE_INCLUDED_CREDITS);

  return {
    priceUsd: (livePriceCents / 100).toFixed(2),
    includedCredits: String(liveCredits),
    discountPct: "0",
    affiliatePct: "0",
    processorPct: String(DEFAULT_PROCESSOR_PERCENT),
    processorFlatUsd: DEFAULT_PROCESSOR_FLAT_USD.toFixed(2),
  };
};

export const computePlanEconomicsSummary = (
  draft: PlanEconomicsDraft | null | undefined
): PlanEconomicsSummary => {
  const grossUsd = clampNonNegative(parseNumericInput(draft?.priceUsd ?? ""));
  const includedCredits = clampNonNegative(parseNumericInput(draft?.includedCredits ?? ""));
  const discountPct = clampNonNegative(parseNumericInput(draft?.discountPct ?? ""));
  const affiliatePct = clampNonNegative(parseNumericInput(draft?.affiliatePct ?? ""));
  const processorPct = clampNonNegative(parseNumericInput(draft?.processorPct ?? ""));
  const processorFlatUsd = clampNonNegative(parseNumericInput(draft?.processorFlatUsd ?? ""));

  if (
    grossUsd == null ||
    includedCredits == null ||
    discountPct == null ||
    affiliatePct == null ||
    processorPct == null ||
    processorFlatUsd == null
  ) {
    return {
      grossUsd: null,
      discountAmountUsd: null,
      afterDiscountUsd: null,
      processorFeeUsd: null,
      effectiveRevenueUsd: null,
      affiliateCostUsd: null,
      netRevenueUsd: null,
      dollarPerCredit: null,
      includedCredits: null,
    };
  }

  const discountAmountUsd = grossUsd * (discountPct / 100);
  const afterDiscountUsd = grossUsd - discountAmountUsd;
  const processorFeeUsd =
    afterDiscountUsd > 0 ? afterDiscountUsd * (processorPct / 100) + processorFlatUsd : 0;
  const effectiveRevenueUsd = Math.max(0, afterDiscountUsd - processorFeeUsd);
  const affiliateCostUsd = effectiveRevenueUsd * (affiliatePct / 100);
  const netRevenueUsd = Math.max(0, effectiveRevenueUsd - affiliateCostUsd);
  const dollarPerCredit = includedCredits > 0 ? netRevenueUsd / includedCredits : null;

  return {
    grossUsd,
    discountAmountUsd,
    afterDiscountUsd,
    processorFeeUsd,
    effectiveRevenueUsd,
    affiliateCostUsd,
    netRevenueUsd,
    dollarPerCredit,
    includedCredits,
  };
};

export const buildDefaultUsageMixDraftRow = (
  modelRow: ModelEconomicsRow | null | undefined
): UsageMixDraftRow => ({
  id: `${modelRow?.modelId ?? "model"}-${Date.now()}-${Math.round(Math.random() * 1000)}`,
  modelId: modelRow?.modelId ?? "",
  variantId: modelRow?.variantId ?? "default",
  durationSeconds:
    modelRow?.durationSeconds != null && Number.isFinite(modelRow.durationSeconds)
      ? String(modelRow.durationSeconds)
      : "",
  runsPerMonth: "10",
});

export const buildDefaultUsageMixDraftRows = (
  modelRow: ModelEconomicsRow | null | undefined
): UsageMixDraftRow[] => [buildDefaultUsageMixDraftRow(modelRow)];

export const buildUsageMixAnalysisRows = ({
  rows,
  models,
  pricingPolicy,
  planSummary,
  aspectDrafts = {},
  resolutionDrafts = {},
  audioDrafts = {},
}: {
  rows: UsageMixDraftRow[];
  models: AdminPricingModelRow[];
  pricingPolicy: ModelPricingPolicyDocument;
  planSummary: PlanEconomicsSummary;
  aspectDrafts?: AspectDraftByModelId;
  resolutionDrafts?: ResolutionDraftByModelId;
  audioDrafts?: AudioDraftByModelId;
}): UsageMixAnalysisRow[] => {
  const rawRows = rows.map((row) => {
    const selectedModelRow = buildSelectedModelEconomicsRow({
      models,
      pricingPolicy,
      modelId: row.modelId,
      variantId: row.variantId,
      durationSeconds: row.durationSeconds,
      aspectDrafts,
      resolutionDrafts,
      audioDrafts,
    });
    const runsPerMonth = clampNonNegative(parseNumericInput(row.runsPerMonth));

    return {
      id: row.id,
      modelKey:
        selectedModelRow != null
          ? `${selectedModelRow.modelId}:${selectedModelRow.variantId}`
          : row.modelId || "unselected",
      modelLabel: selectedModelRow?.modelLabel ?? "Select a model",
      typeLabel: selectedModelRow?.typeLabel ?? "—",
      runsPerMonth,
      durationSeconds: selectedModelRow?.durationSeconds ?? null,
      billedCreditsPerRun: selectedModelRow?.billedCredits ?? null,
      providerCostPerRunUsd: selectedModelRow?.providerCostUsd ?? null,
      revenuePerRunUsd: null,
      profitPerRunUsd: null,
      providerCostPerMonthUsd:
        runsPerMonth != null && selectedModelRow?.providerCostUsd != null
          ? selectedModelRow.providerCostUsd * runsPerMonth
          : null,
      revenuePerMonthUsd: null,
      profitPerMonthUsd: null,
      runSharePercent: null,
    } satisfies UsageMixAnalysisRow;
  });

  const totalRuns = rawRows.reduce((sum, row) => sum + (row.runsPerMonth ?? 0), 0);
  const totalProjectedBilledCredits = rawRows.reduce(
    (sum, row) => sum + (row.billedCreditsPerRun ?? 0) * (row.runsPerMonth ?? 0),
    0
  );
  return rawRows.map((row) => ({
    ...row,
    revenuePerMonthUsd:
      planSummary.netRevenueUsd != null &&
      totalProjectedBilledCredits > 0 &&
      row.billedCreditsPerRun != null &&
      row.runsPerMonth != null
        ? planSummary.netRevenueUsd *
          (((row.billedCreditsPerRun ?? 0) * row.runsPerMonth) / totalProjectedBilledCredits)
        : null,
    revenuePerRunUsd:
      planSummary.netRevenueUsd != null &&
      totalProjectedBilledCredits > 0 &&
      row.billedCreditsPerRun != null &&
      row.runsPerMonth != null &&
      row.runsPerMonth > 0
        ? (planSummary.netRevenueUsd *
            (((row.billedCreditsPerRun ?? 0) * row.runsPerMonth) / totalProjectedBilledCredits)) /
          row.runsPerMonth
        : null,
    profitPerMonthUsd:
      planSummary.netRevenueUsd != null &&
      totalProjectedBilledCredits > 0 &&
      row.billedCreditsPerRun != null &&
      row.runsPerMonth != null &&
      row.providerCostPerMonthUsd != null
        ? planSummary.netRevenueUsd *
            (((row.billedCreditsPerRun ?? 0) * row.runsPerMonth) / totalProjectedBilledCredits) -
          row.providerCostPerMonthUsd
        : null,
    profitPerRunUsd:
      planSummary.netRevenueUsd != null &&
      totalProjectedBilledCredits > 0 &&
      row.billedCreditsPerRun != null &&
      row.runsPerMonth != null &&
      row.providerCostPerRunUsd != null &&
      row.runsPerMonth > 0
        ? (planSummary.netRevenueUsd *
            (((row.billedCreditsPerRun ?? 0) * row.runsPerMonth) / totalProjectedBilledCredits)) /
            row.runsPerMonth -
          row.providerCostPerRunUsd
        : null,
    runSharePercent:
      totalRuns > 0 && row.runsPerMonth != null ? (row.runsPerMonth / totalRuns) * 100 : null,
  }));
};

export const describeDraftPolicyDiff = ({
  livePolicy,
  draftPolicy,
}: {
  livePolicy: ModelPricingPolicyDocument;
  draftPolicy: ModelPricingPolicyDocument;
}): string[] => {
  const descriptions: string[] = [];
  if (livePolicy.global.creditUsdScale !== draftPolicy.global.creditUsdScale) {
    descriptions.push(
      `Credit conversion changed from ${formatCredits(livePolicy.global.creditUsdScale)} to ${formatCredits(
        draftPolicy.global.creditUsdScale
      )} credits / $1`
    );
  }

  const modelIds = new Set([
    ...Object.keys(livePolicy.perModel),
    ...Object.keys(draftPolicy.perModel),
  ]);
  const changedModels = Array.from(modelIds).filter((modelId) => {
    const liveOverride = livePolicy.perModel[modelId] ?? {};
    const draftOverride = draftPolicy.perModel[modelId] ?? {};
    return JSON.stringify(liveOverride) !== JSON.stringify(draftOverride);
  });

  if (changedModels.length > 0) {
    descriptions.push(
      `${changedModels.length} model override${changedModels.length === 1 ? "" : "s"} changed`
    );
  }

  return descriptions;
};
