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

export const canEditModelDuration = (model: AdminPricingModelRow): boolean =>
  model.pricingAuthority === "shared_policy" &&
  (model.defaultDurationSeconds != null ||
    model.defaultSourceDurationSeconds != null ||
    model.minDurationSeconds != null ||
    model.maxDurationSeconds != null ||
    model.allowedDurations.length > 0 ||
    model.pricingStrategy.includes("per-second") ||
    model.pricingStrategy.includes("per-minute") ||
    model.pricingStrategy === "elevenlabs-sound-effect");

export const getDurationInputStep = (model: AdminPricingModelRow): string => {
  if (
    model.allowedDurations.some((duration) => !Number.isInteger(duration)) ||
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
  model.allowedAspects.length > 1;

export const shouldShowResolutionSpecControl = (model: AdminPricingModelRow): boolean =>
  model.allowedResolutions.length > 1;

export const shouldShowAudioSpecControl = (model: AdminPricingModelRow): boolean =>
  model.defaultAudio != null && model.workflowType.toLowerCase().includes("video");
