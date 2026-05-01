import type {
  AdminCreditPricingBreakdown,
  AdminPricingCreditPackageRow,
  AdminPricingModelRow,
  AdminPricingPlanRow,
  AdminPricingPreviewVariant,
  AdminPricingStorageAddonRow,
} from "./types";
import { buildDefaultPricingParams, computeCostForModel } from "../../lib/model-runtime/pricing";
import {
  compactModelPricingPolicyDocument,
  type ModelPricingPolicyDocument,
} from "../../lib/model-runtime/pricingPolicy";

export const formatUsd = (value: number): string => `$${value.toFixed(2)}`;

export const formatProviderCostUsd = (value: number | null | undefined): string => {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value > 0 && value < 1) return `$${value.toFixed(4)}`;
  return formatUsd(value);
};

export const formatCurrencyFromCents = (value: number): string => formatUsd(value / 100);

export const formatCredits = (value: number): string =>
  new Intl.NumberFormat("en-US").format(value);

export const formatFractionalCredits = (value: number): string => {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: value > 0 && value < 1 ? 4 : 2,
  }).format(value);
};

export const formatPercent = (value: number): string =>
  `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value)}%`;

export const formatDateTime = (value: string | null): string =>
  value ? new Date(value).toLocaleString() : "—";

export const getModelTypeLabel = (
  model: AdminPricingModelRow,
  variant: AdminPricingPreviewVariant | null = null
): string => {
  const workflow = model.workflowType.toLowerCase();
  const strategy = model.pricingStrategy.toLowerCase();
  const modelLabel = model.label.toLowerCase();
  const variantId = variant?.id.toLowerCase() ?? "";
  const variantLabel = variant?.label.toLowerCase() ?? "";

  if (workflow.includes("image to video") || workflow.includes("image + video")) {
    return "image → video";
  }
  if (workflow.includes("text to video")) {
    return "text → video";
  }
  if (workflow.includes("image to image")) {
    return "image → image";
  }
  if (workflow.includes("text to image")) {
    if (modelLabel.includes("edit") || variantId === "edit" || variantLabel.includes("edit")) {
      return "image → image";
    }
    return "text → image";
  }
  if (workflow.includes("text + image edit")) {
    if (variantId === "edit" || variantLabel.includes("edit") || modelLabel.includes("edit")) {
      return "image → image";
    }
    if (variantId === "create" || variantLabel.includes("create")) {
      return "text → image";
    }
    return "text/image → image";
  }
  if (strategy === "elevenlabs-voice-changer-per-minute") {
    return "sound → sound";
  }
  if (strategy.includes("elevenlabs")) {
    return "text → sound";
  }
  if (workflow.includes("audio") || workflow.includes("sound")) {
    return workflow.includes("text") ? "text → sound" : "sound → sound";
  }
  if (workflow.includes("text")) {
    return "text → text";
  }
  if (workflow.includes("video") || strategy.includes("video") || strategy.includes("per-second")) {
    return "video";
  }
  if (workflow.includes("image") || strategy.includes("image") || strategy.includes("megapixel")) {
    return "image";
  }
  return workflow || "text";
};

export const getPricingAuthorityLabel = (
  authority: "shared_policy" | "local_pricing" | "metadata_only"
): string => {
  if (authority === "shared_policy") return "Shared policy";
  if (authority === "local_pricing") return "Local pricing";
  return "Metadata only";
};

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

export type PricingView = "all" | "models" | "plans" | "credits" | "media-addons";
export type ModelPricingSortOption = "model_asc" | "model_desc" | "type" | "cost_desc" | "cost_asc";
export type DurationDraftByModelId = Record<string, string>;
export type CreditScaleDraftByModelId = Record<string, string>;
export type MarkupDraftByModelId = Record<string, string>;
export type RoundingDraftByModelId = Record<string, string>;
export type CostDocsPopover = {
  x: number;
  y: number;
  title: string;
  sourceUrl: string;
  lines: string[];
};

const COST_DOCS_POPOVER_WIDTH = 380;
const COST_DOCS_POPOVER_HEIGHT = 260;

export const PRICING_VIEW_TABS: Array<{ id: PricingView; label: string }> = [
  { id: "all", label: "All" },
  { id: "models", label: "Models" },
  { id: "plans", label: "Plans" },
  { id: "credits", label: "Credits" },
  { id: "media-addons", label: "Media add-ons" },
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
  storageLimitBytes: String(row.storageLimitBytes),
  recurringPriceCents: String(row.recurringPriceCents),
  stripePriceId: row.stripePriceId ?? "",
  expectedCurrentOfferId: row.offerId,
  expectedCurrentOfferAbsent: false,
});

export const getCostDocsPosition = (clientX: number, clientY: number): { x: number; y: number } => {
  if (typeof window === "undefined") {
    return { x: clientX + 14, y: clientY + 14 };
  }
  const maxX = Math.max(16, window.innerWidth - COST_DOCS_POPOVER_WIDTH - 16);
  const maxY = Math.max(16, window.innerHeight - COST_DOCS_POPOVER_HEIGHT - 16);
  return {
    x: Math.max(16, Math.min(clientX + 14, maxX)),
    y: Math.max(16, Math.min(clientY + 14, maxY)),
  };
};

const getProviderPricingDocLines = (
  model: AdminPricingModelRow,
  variant: AdminPricingPreviewVariant | null
): string[] => {
  switch (model.pricingStrategy) {
    case "fal-per-mp":
      return [
        "Provider cost basis used here: $0.025 per output megapixel.",
        "Workbook formula: output width x height / 1,000,000 multiplied by the provider rate.",
      ];
    case "fal-economy-image-per-mp":
      return model.id === "fal-ai/bria/background/remove"
        ? [
            "Provider cost basis used here: $0.018 per completed background-removal image.",
            "Workbook formula: one provider charge per generated output image.",
          ]
        : [
            "Provider cost basis used here: $0.006 per output megapixel.",
            "Workbook formula: output width x height / 1,000,000 multiplied by the provider rate.",
          ];
    case "fal-fill-per-mp":
      return [
        "Provider cost basis used here: $0.05 per output megapixel.",
        "Workbook formula: output width x height / 1,000,000 multiplied by the provider rate.",
      ];
    case "fal-flux-kontext-inpaint-per-mp":
      return [
        "Provider cost basis used here: $0.035 per output megapixel.",
        "Workbook formula: output width x height / 1,000,000 multiplied by the provider rate.",
      ];
    case "gpt-image-2-per-image":
      return [
        "Provider cost basis used here: GPT Image 2 output image price by size and quality.",
        "1024x1024: low $0.006, medium $0.053, high $0.211.",
        "1024x1536 or 1536x1024: low $0.005, medium $0.041, high $0.165.",
        variant?.id === "edit"
          ? "Edit rows add the deterministic input-image surcharge for the selected size and input fidelity."
          : "Create rows use only the output image price unless extra inputs are supplied.",
      ];
    case "google-nano-banana-per-image":
      return [
        "Provider cost basis used here: $0.039 per generated image.",
        "Workbook formula: one provider charge per completed output image.",
      ];
    case "nano-banana-2-per-image":
      return [
        "Provider cost basis used here: $0.08 per 1K image.",
        "Resolution multipliers: 0.5K is 0.75x, 2K is 1.5x, and 4K is 2x.",
        "Web search adds $0.015 when enabled.",
      ];
    case "nano-banana-per-image":
      return [
        "Provider cost basis used here: $0.15 per 1K image.",
        "4K requests are modeled at 2x the base provider price.",
        "Web search adds $0.015 when enabled.",
      ];
    case "seedream-per-image":
      return [
        "Provider cost basis used here: $0.04 per image at the default resolution.",
        "4K requests are modeled at 2x the base provider price.",
      ];
    case "seedream-5-lite-per-image":
      return [
        "Provider cost basis used here: $0.035 per image.",
        "Workbook formula: one provider charge per completed output image.",
      ];
    case "kling-3-per-second":
      return [
        "Provider cost basis used here: Kie credits convert at $0.005 per credit.",
        "Kling 3.0 standard mode: 14 credits/sec without audio, 21 credits/sec with audio.",
        "Kling 3.0 pro mode: 18 credits/sec without audio, 27 credits/sec with audio.",
      ];
    case "veo-3-per-second":
      return model.id.includes("veo")
        ? [
            "Provider cost basis used here: Kie Veo 3.1 Fast image-to-video is modeled as $0.40 per completed video.",
            "The duration field is still shown for request shape review, but this row currently charges a flat provider cost.",
          ]
        : [
            "Provider cost basis used here: 1080p video costs $0.20/sec without audio or $0.40/sec with audio.",
            "4K video costs $0.40/sec without audio or $0.60/sec with audio.",
          ];
    case "seedance-1.5-per-second":
      return [
        "Provider cost basis used here: Kie credits convert at $0.005 per credit.",
        "Seedance 1.5 Pro 1080p: 7.5 credits/sec without audio, 15 credits/sec with audio.",
        "720p: 3.5 credits/sec without audio, 7 credits/sec with audio. 480p: 2 credits/sec without audio, 4 credits/sec with audio.",
      ];
    case "seedance-2-per-second":
    case "seedance-2-fast-per-second":
      return [
        "Provider cost basis used here: tokenized video pricing by resolution, frame rate, duration, and audio setting.",
        "Formula: width x height x 24 fps x duration / 1024 tokens.",
        "Rates: $1.20 per million tokens without audio, $2.40 per million tokens with audio.",
      ];
    case "elevenlabs-music-per-minute":
      return [
        "Provider cost basis used here: $0.30 per generated music minute.",
        "Workbook formula: duration seconds / 60 multiplied by the provider rate.",
      ];
    case "elevenlabs-sound-effect":
      return [
        "Provider cost basis used here: $0.12 per auto-duration sound-effect generation.",
        "Explicit-duration sound effects are normalized to $0.024 per second.",
      ];
    case "elevenlabs-text-to-speech-per-kchar":
      return [
        "Provider cost basis used here: $0.10 per 1,000 text characters.",
        "Workbook formula: rounded character count / 1,000 multiplied by the provider rate.",
      ];
    case "elevenlabs-voice-changer-per-minute":
      return [
        "Provider cost basis used here: $0.12 per processed source-audio minute.",
        "Workbook formula: source duration seconds / 60 multiplied by the provider rate.",
      ];
    case "openai-text-token":
      return [
        "Provider cost basis used here: OpenAI standard short-context token rates.",
        "GPT-5.4: input $2.50/M, cached input $0.25/M, output $15.00/M.",
        "GPT-5.4 Mini: input $0.75/M, cached input $0.075/M, output $4.50/M.",
        "GPT-5.4 Nano: input $0.20/M, cached input $0.02/M, output $1.25/M.",
      ];
    default:
      return [
        `Provider cost basis used here: ${model.pricingStrategyLabel}.`,
        "Open the provider source link for the canonical docs page behind this workbook row.",
      ];
  }
};

export const getProviderPricingDocs = (
  model: AdminPricingModelRow,
  variant: AdminPricingPreviewVariant | null
): Omit<CostDocsPopover, "x" | "y"> => ({
  title: `${model.label}${variant && variant.id !== "default" ? ` ${variant.label}` : ""}`,
  sourceUrl: model.sourceUrl,
  lines: getProviderPricingDocLines(model, variant),
});

const mapDraftPricingBreakdown = (
  modelId: string,
  params: ReturnType<typeof buildDefaultPricingParams>,
  pricingPolicy: ModelPricingPolicyDocument
): AdminCreditPricingBreakdown | null => {
  const breakdown = computeCostForModel(modelId, params, pricingPolicy);
  if (!breakdown) return null;
  return {
    usdRaw: breakdown.usdRaw,
    rawCredits: breakdown.rawCredits,
    billedCredits: breakdown.credits,
    billedUsd: breakdown.usd,
  };
};

export const buildDraftPricingPreviewVariants = (
  model: AdminPricingModelRow,
  pricingPolicy: ModelPricingPolicyDocument,
  durationSeconds: number | null = null
): AdminPricingPreviewVariant[] => {
  const serverVariants = model.pricingPreviewVariants.length
    ? model.pricingPreviewVariants
    : model.pricingPreview
      ? [{ id: "default", label: "Default", breakdown: model.pricingPreview }]
      : [];

  if (model.pricingAuthority !== "shared_policy") {
    return serverVariants;
  }

  const variants = serverVariants.length
    ? serverVariants
    : [{ id: "default", label: "Default", breakdown: null }];

  const draftVariants = variants
    .map((variant) => {
      const durationOverrides =
        durationSeconds != null
          ? model.pricingStrategy === "elevenlabs-voice-changer-per-minute"
            ? { sourceDurationSeconds: durationSeconds }
            : { durationSeconds }
          : {};
      const params = buildDefaultPricingParams(model.id, {
        ...durationOverrides,
        ...(variant.id === "edit"
          ? {
              inputImageCount: 1,
              inputFidelity: "high",
            }
          : {}),
      });
      const breakdown =
        mapDraftPricingBreakdown(model.id, params, pricingPolicy) ?? variant.breakdown;
      if (!breakdown) return null;
      return {
        id: variant.id,
        label: variant.label,
        breakdown,
      };
    })
    .filter((variant): variant is AdminPricingPreviewVariant => variant !== null);

  return draftVariants.length ? draftVariants : serverVariants;
};

export const getCreditsAtProviderCost = (
  breakdown: AdminCreditPricingBreakdown | null | undefined,
  creditUsdScale: number
): number | null => {
  if (breakdown?.usdRaw == null || !Number.isFinite(breakdown.usdRaw)) return null;
  return Math.max(0, breakdown.usdRaw) * creditUsdScale;
};

export const getWorkbookBillableCredits = ({
  creditsAtCost,
  markupBps,
  roundingIncrement,
}: {
  creditsAtCost: number | null;
  markupBps: number | null | undefined;
  roundingIncrement: number | null | undefined;
}): number | null => {
  if (creditsAtCost == null || !Number.isFinite(creditsAtCost)) return null;
  const markedCredits = creditsAtCost * (1 + Math.max(0, markupBps ?? 0) / 10_000);
  if (roundingIncrement == null || !Number.isFinite(roundingIncrement) || roundingIncrement <= 0) {
    return markedCredits;
  }
  return Math.ceil(markedCredits / roundingIncrement) * roundingIncrement;
};

export const getWorkbookBillableUsd = (
  billableCredits: number | null,
  creditUsdScale: number
): number | null => {
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
  const marginUsd = Math.max(0, billedUsd - breakdown.usdRaw);
  return {
    usd: marginUsd,
    percent: billedUsd > 0 ? (marginUsd / billedUsd) * 100 : null,
  };
};

export const getModelSpecSummary = (model: AdminPricingModelRow): string => {
  const parts: string[] = [];
  if (model.defaultResolution) parts.push(model.defaultResolution);
  if (model.defaultAspect) parts.push(model.defaultAspect);
  return parts.length ? parts.join(" / ") : model.workflowType;
};

export const getModelDefaultDurationSeconds = (model: AdminPricingModelRow): number | null =>
  model.defaultDurationSeconds ?? model.defaultSourceDurationSeconds ?? null;

export const getModelDurationSummary = (model: AdminPricingModelRow): string => {
  if (model.pricingStrategy === "elevenlabs-voice-changer-per-minute") return "";
  const durationSeconds = getModelDefaultDurationSeconds(model);
  return durationSeconds != null ? String(durationSeconds) : "";
};

export const canEditModelDuration = (model: AdminPricingModelRow): boolean =>
  model.pricingAuthority === "shared_policy" &&
  model.pricingStrategy !== "elevenlabs-voice-changer-per-minute" &&
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

export const getVariantSpecSummary = (
  model: AdminPricingModelRow,
  variant: AdminPricingPreviewVariant | null,
  variantCount: number
): string => {
  const baseSpec = getModelSpecSummary(model);
  if (!variant || variantCount <= 1 || variant.id === "default") return baseSpec;
  return `${variant.label} / ${baseSpec}`;
};

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
  direction: "asc" | "desc"
): number | null => {
  const durationDraftValue = durationDrafts[model.id];
  const draftDurationSeconds =
    durationDraftValue !== undefined ? parseDurationSecondsInput(durationDraftValue) : null;
  const costs = buildDraftPricingPreviewVariants(model, pricingPolicy, draftDurationSeconds)
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
}: {
  models: AdminPricingModelRow[];
  sortOption: ModelPricingSortOption;
  pricingPolicy: ModelPricingPolicyDocument;
  durationDrafts: DurationDraftByModelId;
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
        getModelRawCostSortValue(left, pricingPolicy, durationDrafts, direction),
        getModelRawCostSortValue(right, pricingPolicy, durationDrafts, direction),
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
    const nextOverride = {} as NonNullable<(typeof nextPerModel)[string]>;
    if (hasCustomCreditUsdScale && typeof mergedOverride.creditUsdScale === "number") {
      nextOverride.creditUsdScale = mergedOverride.creditUsdScale;
    }
    if (hasCustomMarkup && typeof mergedOverride.markupBps === "number") {
      nextOverride.markupBps = mergedOverride.markupBps;
    }
    if (hasCustomRoundingIncrement && typeof mergedOverride.roundingIncrement === "number") {
      nextOverride.roundingIncrement = mergedOverride.roundingIncrement;
    }
    nextPerModel[modelId] = nextOverride;
  }

  return compactModelPricingPolicyDocument({
    ...policy,
    perModel: nextPerModel,
  });
};
