import type {
  AdminPricingCreditPackageRow,
  AdminPricingModelRow,
  AdminPricingPlanRow,
  AdminPricingStorageAddonRow,
} from "./types";
import type { PricingGridTab } from "./pricingAnalysis";

export type CreditPackageDraft = {
  id: string;
  displayName: string;
  creditAmountCents: string;
  priceCents: string;
  stripePriceId: string;
  sortOrder: string;
  isActive: boolean;
};

export type PlanCreateDraft = {
  planId: string;
  displayName: string;
  recurringPriceCents: string;
  annualRecurringPriceCents: string;
  monthlyCreditsCents: string;
  storageLimitBytes: string;
  maxConcurrentGenerations: string;
  sortOrder: string;
};

export type PlanOfferDraft = {
  planId: string;
  displayName: string;
  offerName: string;
  billingInterval: "month" | "year";
  recurringPriceCents: string;
  monthlyCreditsCents: string;
  storageLimitBytes: string;
  maxConcurrentGenerations: string;
  stripePriceId: string;
  expectedCurrentOfferId: string | null;
  expectedCurrentOfferAbsent: boolean;
};

export type StorageOfferDraft = {
  storageAddonId: string;
  offerName: string;
  storageLimitBytes: string;
  recurringPriceCents: string;
  stripePriceId: string;
  expectedCurrentOfferId: string | null;
  expectedCurrentOfferAbsent: boolean;
};

export type PricingView = PricingGridTab;
export type ModelPricingSortOption = "model_asc" | "model_desc" | "type" | "cost_desc" | "cost_asc";
export type DurationDraftByModelId = Record<string, string>;
export type CreditScaleDraftByModelId = Record<string, string>;
export type MarkupDraftByModelId = Record<string, string>;
export type RoundingDraftByModelId = Record<string, string>;
export type AspectDraftByModelId = Record<string, string>;
export type ResolutionDraftByModelId = Record<string, string>;
export type AudioDraftByModelId = Record<string, "default" | "on" | "off">;
export type VariantMarkupDraftByVariantKey = Record<string, string>;
export type ProviderCostDraftByModelId = Record<string, string>;
export type ProviderCostPerSecondDraftByModelId = Record<string, string>;
export type VariantProviderCostDraftByVariantKey = Record<string, string>;
export type VariantProviderCostPerSecondDraftByVariantKey = Record<string, string>;
export type ModelUsageKind =
  | "duration_seconds"
  | "source_duration_seconds"
  | "generation_count"
  | "text_characters"
  | "blended_text_characters"
  | "input_tokens"
  | "none";

export type ModelUsageControl = {
  kind: ModelUsageKind;
  label: string;
  unitLabel: string;
  defaultValue: number | null;
  minValue: number | null;
  maxValue: number | null;
  step: string;
  inputMode: "decimal" | "numeric";
};

export const PRICING_VIEW_TABS: Array<{ id: PricingView; label: string }> = [
  { id: "grid", label: "Pricing Grid" },
  { id: "model-economics", label: "Model Economics" },
  { id: "plan-economics", label: "Plan Economics" },
  { id: "usage-mix", label: "Usage Mix" },
];

export const MODEL_PRICING_SORT_OPTIONS: Array<{
  id: ModelPricingSortOption;
  label: string;
}> = [
  { id: "model_asc", label: "Model A-Z" },
  { id: "model_desc", label: "Model Z-A" },
  { id: "type", label: "Type" },
  { id: "cost_desc", label: "Cost high-low" },
  { id: "cost_asc", label: "Cost low-high" },
];

export const buildCreditPackageDraft = (row: AdminPricingCreditPackageRow): CreditPackageDraft => ({
  id: row.id,
  displayName: row.displayName,
  creditAmountCents: String(row.creditAmountCents),
  priceCents: String(row.priceCents),
  stripePriceId: row.stripePriceId ?? "",
  sortOrder: String(row.sortOrder),
  isActive: row.isActive,
});

export const buildEmptyPlanCreateDraft = (sortOrder: number): PlanCreateDraft => ({
  planId: "",
  displayName: "",
  recurringPriceCents: "",
  annualRecurringPriceCents: "",
  monthlyCreditsCents: "",
  storageLimitBytes: "",
  maxConcurrentGenerations: "",
  sortOrder: String(sortOrder),
});

export const buildPlanOfferDraft = (
  row: AdminPricingPlanRow,
  billingInterval: "month" | "year"
): PlanOfferDraft => {
  const offer = billingInterval === "year" ? row.annualOffer : row.monthlyOffer;
  const fallbackRecurringPriceCents =
    billingInterval === "year"
      ? Math.max(0, row.monthlyOffer?.recurringPriceCents ?? row.recurringPriceCents) * 12
      : row.recurringPriceCents;
  return {
    planId: row.planId,
    displayName: row.displayName,
    offerName: `${row.displayName} ${billingInterval === "year" ? "Annual" : "Monthly"} Admin Offer`,
    billingInterval,
    recurringPriceCents: String(offer?.recurringPriceCents ?? fallbackRecurringPriceCents),
    monthlyCreditsCents: String(offer?.monthlyCreditsCents ?? row.monthlyCreditsCents),
    storageLimitBytes: String(offer?.storageLimitBytes ?? row.storageLimitBytes),
    maxConcurrentGenerations: String(
      offer?.maxConcurrentGenerations ?? row.maxConcurrentGenerations
    ),
    stripePriceId: offer?.stripePriceId ?? "",
    expectedCurrentOfferId: offer?.offerId ?? null,
    expectedCurrentOfferAbsent: !offer,
  };
};

export const buildStorageOfferDraft = (row: AdminPricingStorageAddonRow): StorageOfferDraft => ({
  storageAddonId: row.storageAddonId,
  offerName: `${row.displayName} Admin Offer`,
  storageLimitBytes: row.offerId ? String(row.storageLimitBytes) : "",
  recurringPriceCents: row.offerId ? String(row.recurringPriceCents) : "",
  stripePriceId: row.stripePriceId ?? "",
  expectedCurrentOfferId: row.offerId ?? null,
  expectedCurrentOfferAbsent: !row.offerId,
});

export const parseIntegerInput = (value: string): number | null => {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
};

export const parsePositiveDecimalInput = (value: string): number | null => {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const parsePercentToBps = (value: string): number | null => {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
};

export const parseDurationSecondsInput = (value: string): number | null => {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const IMAGE_AMOUNT_PRICING_STRATEGIES = new Set([
  "fal-per-mp",
  "fal-economy-image-per-mp",
  "fal-fill-per-mp",
  "fal-flux-kontext-inpaint-per-mp",
  "google-nano-banana-per-image",
  "nano-banana-2-per-image",
  "nano-banana-per-image",
  "seedream-per-image",
  "seedream-5-lite-per-image",
]);

const INTEGER_USAGE_KINDS = new Set<ModelUsageKind>([
  "generation_count",
  "text_characters",
  "blended_text_characters",
  "input_tokens",
]);

export const getModelUsageControl = (model: AdminPricingModelRow): ModelUsageControl => {
  if (model.pricingStrategy === "openai-text-token") {
    return {
      kind: "blended_text_characters",
      label: "Characters",
      unitLabel: "chars",
      defaultValue: 50_000,
      minValue: 1,
      maxValue: null,
      step: "1000",
      inputMode: "numeric",
    };
  }

  if (model.pricingStrategy === "elevenlabs-text-to-speech-per-kchar") {
    return {
      kind: "text_characters",
      label: "Characters",
      unitLabel: "chars",
      defaultValue: 1_000,
      minValue: 1,
      maxValue: null,
      step: "100",
      inputMode: "numeric",
    };
  }

  if (model.pricingStrategy === "elevenlabs-voice-changer-per-minute") {
    return {
      kind: "source_duration_seconds",
      label: "Source duration",
      unitLabel: "sec",
      defaultValue: model.defaultSourceDurationSeconds ?? 60,
      minValue: model.minDurationSeconds ?? 1,
      maxValue: model.maxDurationSeconds ?? null,
      step: getDurationInputStep(model),
      inputMode: "decimal",
    };
  }

  if (IMAGE_AMOUNT_PRICING_STRATEGIES.has(model.pricingStrategy)) {
    return {
      kind: "generation_count",
      label: "Amount",
      unitLabel: "images",
      defaultValue: 1,
      minValue: 1,
      maxValue: null,
      step: "1",
      inputMode: "numeric",
    };
  }

  if (
    model.defaultDurationSeconds != null ||
    model.defaultSourceDurationSeconds != null ||
    model.minDurationSeconds != null ||
    model.maxDurationSeconds != null ||
    model.allowedDurations.length > 0 ||
    model.pricingStrategy.includes("per-second") ||
    model.pricingStrategy.includes("per-minute") ||
    model.pricingStrategy === "elevenlabs-sound-effect"
  ) {
    return {
      kind: "duration_seconds",
      label: "Duration",
      unitLabel: "sec",
      defaultValue: model.defaultDurationSeconds ?? model.defaultSourceDurationSeconds ?? null,
      minValue: model.minDurationSeconds ?? 0.1,
      maxValue: model.maxDurationSeconds ?? null,
      step: getDurationInputStep(model),
      inputMode: "decimal",
    };
  }

  return {
    kind: "none",
    label: "Usage",
    unitLabel: "",
    defaultValue: null,
    minValue: null,
    maxValue: null,
    step: "1",
    inputMode: "numeric",
  };
};

export const getModelUsageValue = (
  model: AdminPricingModelRow,
  draftValue: string | undefined
): number | null => {
  const parsed = draftValue !== undefined ? parseDurationSecondsInput(draftValue) : null;
  return parsed ?? getModelUsageControl(model).defaultValue;
};

export const getModelUsageDisplayValue = (
  model: AdminPricingModelRow,
  usageValue: number | null | undefined
): string => {
  if (usageValue == null || !Number.isFinite(usageValue)) return "";
  const { kind } = getModelUsageControl(model);
  if (INTEGER_USAGE_KINDS.has(kind)) {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
      Math.round(usageValue)
    );
  }
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: Number.isInteger(usageValue) ? 0 : 1,
    maximumFractionDigits: Number.isInteger(usageValue) ? 0 : 2,
  }).format(usageValue);
};

export const getModelDurationSecondsForUsage = (
  model: AdminPricingModelRow,
  usageValue: number | null | undefined
): number | null => {
  const usageControl = getModelUsageControl(model);
  if (
    (usageControl.kind === "duration_seconds" || usageControl.kind === "source_duration_seconds") &&
    usageValue != null &&
    Number.isFinite(usageValue) &&
    usageValue > 0
  ) {
    return usageValue;
  }
  return model.defaultDurationSeconds ?? model.defaultSourceDurationSeconds ?? null;
};

export const getModelUsageRateMultiplier = (
  model: AdminPricingModelRow,
  usageValue: number | null | undefined
): number | null => {
  if (usageValue == null || !Number.isFinite(usageValue) || usageValue <= 0) return null;
  switch (getModelUsageControl(model).kind) {
    case "generation_count":
      return Math.max(1, Math.round(usageValue));
    case "text_characters":
      return usageValue / 1_000;
    case "blended_text_characters":
      return usageValue / 50_000;
    case "input_tokens":
      return usageValue / 1_000_000;
    default:
      return null;
  }
};

export const buildModelUsagePricingOverrides = (
  model: AdminPricingModelRow,
  usageValue: number | null | undefined
): {
  durationSeconds?: number;
  sourceDurationSeconds?: number;
  generationCount?: number;
  textCharacters?: number;
  inputTokens?: number;
} => {
  if (usageValue == null || !Number.isFinite(usageValue) || usageValue <= 0) return {};
  const usageControl = getModelUsageControl(model);
  switch (usageControl.kind) {
    case "duration_seconds":
      return { durationSeconds: usageValue };
    case "source_duration_seconds":
      return { sourceDurationSeconds: usageValue };
    case "generation_count":
      return { generationCount: Math.max(1, Math.round(usageValue)) };
    case "text_characters":
    case "blended_text_characters":
      return { textCharacters: Math.max(1, Math.round(usageValue)) };
    case "input_tokens":
      return { inputTokens: Math.max(1, Math.round(usageValue)) };
    default:
      return {};
  }
};

export const canEditModelDuration = (model: AdminPricingModelRow): boolean =>
  model.pricingAuthority === "shared_policy" && getModelUsageControl(model).kind !== "none";

export const getDurationInputStep = (model: AdminPricingModelRow): string => {
  const allowedDurations = model.allowedDurations ?? [];
  if (
    allowedDurations.some((duration) => !Number.isInteger(duration)) ||
    !Number.isInteger(model.minDurationSeconds ?? 1) ||
    !Number.isInteger(model.maxDurationSeconds ?? 1)
  ) {
    return "0.1";
  }
  return "1";
};

export const parseAudioDraft = (
  value: AudioDraftByModelId[string] | undefined,
  model: AdminPricingModelRow
): boolean => {
  if (value === "on") return true;
  if (value === "off") return false;
  return model.defaultAudio ?? true;
};

export const shouldShowAspectSpecControl = (model: AdminPricingModelRow): boolean =>
  (model.allowedAspects ?? []).length > 1;

export const shouldShowResolutionSpecControl = (model: AdminPricingModelRow): boolean =>
  (model.allowedResolutions ?? []).length > 1;

export const shouldShowAudioSpecControl = (model: AdminPricingModelRow): boolean =>
  model.defaultAudio != null &&
  model.workflowType.toLowerCase().includes("video") &&
  !["seedance-2-per-second", "seedance-2-fast-per-second"].includes(model.pricingStrategy);
