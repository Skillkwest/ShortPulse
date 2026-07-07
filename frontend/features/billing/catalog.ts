/**
 * Billing catalog helpers for plans and credit packages.
 * Monetary values come from Supabase rows so pricing can be changed without app code edits.
 */
import { resolveDefaultPlanConcurrencyLimit } from "../../lib/billing/planConcurrency";
import {
  PLAN_STORAGE_LIMIT_BYTES_BY_ID,
  STORAGE_ADDON_LIMIT_BYTES_BY_ID,
} from "../../lib/billing/storageAddonEligibility";

export type BillingInterval = "month" | "year";

export type BillingPlanIntervalOfferRecord = {
  id: string;
  billing_interval: BillingInterval;
  recurring_price_cents: number;
  monthly_credits_cents: number;
  storage_limit_bytes: number;
  max_concurrent_generations?: number;
  stripe_price_id?: string | null;
  acquisition_enabled?: boolean;
  is_active?: boolean;
  effective_start_at?: string | null;
};

export type BillingPlanRecord = {
  id: string;
  display_name: string;
  sort_order?: number;
  monthly_price_cents: number;
  monthly_credits_cents: number;
  storage_limit_bytes: number;
  max_concurrent_generations?: number;
  is_active?: boolean;
  offers?: Partial<Record<BillingInterval, BillingPlanIntervalOfferRecord>>;
};

export type CreditPackageRecord = {
  id: string;
  display_name: string;
  credit_amount_cents: number;
  price_cents: number;
  sort_order: number;
};

export type BillingStorageAddonRecord = {
  id: string;
  display_name: string;
  storage_limit_bytes: number;
  monthly_price_cents: number;
  sort_order: number;
};

export type BillingCatalogSnapshot = {
  plans: BillingPlanRecord[];
  packages: CreditPackageRecord[];
  storageAddons: BillingStorageAddonRecord[];
};

const PLAN_TIER_ORDER = ["free", "starter", "media", "studio", "business"] as const;

export const DEFAULT_STORAGE_ADDON_RECORDS: BillingStorageAddonRecord[] = [
  {
    id: "storage_50gb",
    display_name: "Extra 50 GB",
    storage_limit_bytes: STORAGE_ADDON_LIMIT_BYTES_BY_ID.storage_50gb,
    monthly_price_cents: 1000,
    sort_order: 10,
  },
  {
    id: "storage_100gb",
    display_name: "Extra 100 GB",
    storage_limit_bytes: STORAGE_ADDON_LIMIT_BYTES_BY_ID.storage_100gb,
    monthly_price_cents: 2000,
    sort_order: 20,
  },
  {
    id: "storage_250gb",
    display_name: "Extra 250 GB",
    storage_limit_bytes: STORAGE_ADDON_LIMIT_BYTES_BY_ID.storage_250gb,
    monthly_price_cents: 3000,
    sort_order: 30,
  },
  {
    id: "storage_1tb",
    display_name: "Extra 1 TB",
    storage_limit_bytes: STORAGE_ADDON_LIMIT_BYTES_BY_ID.storage_1tb,
    monthly_price_cents: 8900,
    sort_order: 40,
  },
];

type AnnualPricingConfig = {
  yearlyPriceCents: number;
  savingsBadge: string;
};

const ANNUAL_PRICING_CONFIG: Partial<Record<string, AnnualPricingConfig>> = {
  starter: {
    yearlyPriceCents: 18_000,
    savingsBadge: "",
  },
  media: {
    yearlyPriceCents: 58_800,
    savingsBadge: "",
  },
  studio: {
    yearlyPriceCents: 118_800,
    savingsBadge: "23% OFF",
  },
  business: {
    yearlyPriceCents: 274_800,
    savingsBadge: "23% OFF",
  },
};

export type SubscriptionPlanFeature = {
  label: string;
  included: boolean;
};

export type SubscriptionPlanDisplayPricing = {
  monthlyDisplayPriceCents: number;
  annualDisplayPriceCents: number;
  annualComparePriceCents?: number | null;
  annualDiscountLabel?: string | null;
  annualSaveLabel?: string | null;
};

export type SubscriptionPlanDisplayBenefits = {
  monthlyCreditsLabel: string;
  storageLabel: string;
};

type PlanPresentation = {
  className: string;
  displayNameOverride?: string;
  seatsLabel: string;
  description: string;
  cardFooterDescription: string;
  cardFeatures: SubscriptionPlanFeature[];
  bonusCreditsLabel?: string;
  displayPricing?: SubscriptionPlanDisplayPricing;
  displayBenefits?: SubscriptionPlanDisplayBenefits;
  pricingHighlights?: string[];
};

export type BillingPlanView = {
  id: string;
  displayName: string;
  className: string;
  description: string;
  cardFooterDescription: string;
  seatsLabel: string;
  concurrentGenerationsLabel: string;
  concurrentGenerationsCompactLabel: string;
  cardFeatures: SubscriptionPlanFeature[];
  bonusCreditsLabel: string | null;
  displayPricing: SubscriptionPlanDisplayPricing;
  displayBenefits: SubscriptionPlanDisplayBenefits;
  pricingHighlights: string[];
  monthlyPriceCents: number;
  monthlyCreditsCents: number;
  storageLimitBytes: number;
  maxConcurrentGenerations: number;
};

const PLAN_PRESENTATION: Record<string, PlanPresentation> = {
  free: {
    className: "plan-starter",
    displayNameOverride: "Baseline access",
    seatsLabel: "1 workspace seat",
    description: "Account access without generation privileges.",
    cardFooterDescription: "Generation access starts on Starter.",
    cardFeatures: [
      { label: "Create studio", included: true },
      { label: "Editing studio", included: true },
      { label: "Video Studio", included: false },
      { label: "Sound Studio", included: false },
      { label: "Lowest cost per credit", included: false },
    ],
    displayPricing: {
      monthlyDisplayPriceCents: 0,
      annualDisplayPriceCents: 0,
      annualComparePriceCents: null,
      annualDiscountLabel: null,
      annualSaveLabel: null,
    },
    displayBenefits: {
      monthlyCreditsLabel: "No generation credits included",
      storageLabel: "No media storage included",
    },
  },
  starter: {
    className: "plan-starter",
    seatsLabel: "1 workspace seat",
    description: "Starter access for exploration.",
    cardFooterDescription: "Best for graphic artists and all image based workflows.",
    cardFeatures: [
      { label: "Create studio", included: true },
      { label: "Editing studio", included: true },
      { label: "Video Studio", included: false },
      { label: "Sound Studio", included: false },
      { label: "Lowest cost per credit", included: false },
    ],
    displayPricing: {
      monthlyDisplayPriceCents: 1_500,
      annualDisplayPriceCents: 1_500,
      annualComparePriceCents: null,
      annualDiscountLabel: null,
      annualSaveLabel: null,
    },
    displayBenefits: {
      monthlyCreditsLabel: "350 credits every month",
      storageLabel: "5 GB of media storage",
    },
  },
  media: {
    className: "plan-media",
    seatsLabel: "1 workspace seat",
    description: "Ideal for creators testing cadence.",
    cardFooterDescription: "Best for image + short form video workflows.",
    cardFeatures: [
      { label: "Create studio", included: true },
      { label: "Editing studio", included: true },
      { label: "Video studio", included: true },
      { label: "Sound Studio", included: true },
      { label: "Lowest cost per credit", included: false },
    ],
    displayPricing: {
      monthlyDisplayPriceCents: 4_900,
      annualDisplayPriceCents: 4_900,
      annualComparePriceCents: null,
      annualDiscountLabel: null,
      annualSaveLabel: null,
    },
    displayBenefits: {
      monthlyCreditsLabel: "1,200 credits every month",
      storageLabel: "25 GB of media storage",
    },
  },
  studio: {
    className: "plan-studio",
    seatsLabel: "1 workspace seat",
    description: "Built for consistent creative production.",
    cardFooterDescription:
      "Best for creators moving from casual experimenting to serious AI production.",
    cardFeatures: [
      { label: "Create studio", included: true },
      { label: "Editing studio", included: true },
      { label: "Video studio", included: true },
      { label: "Sound Studio", included: true },
      { label: "Lowest cost per credit", included: true },
    ],
    displayPricing: {
      monthlyDisplayPriceCents: 12_900,
      annualDisplayPriceCents: 9_900,
      annualComparePriceCents: 12_900,
      annualDiscountLabel: "23% OFF",
      annualSaveLabel: "Save $360",
    },
    displayBenefits: {
      monthlyCreditsLabel: "3,200 credits every month",
      storageLabel: "75 GB of media storage",
    },
  },
  business: {
    className: "plan-business",
    seatsLabel: "Team access",
    description: "Highest throughput for heavy AI workloads.",
    cardFooterDescription: "Best for serious creators with heavy workflow & storage needs",
    cardFeatures: [
      { label: "Create studio", included: true },
      { label: "Editing studio", included: true },
      { label: "Video studio", included: true },
      { label: "Sound Studio", included: true },
      { label: "Lowest cost per credit", included: true },
    ],
    displayPricing: {
      monthlyDisplayPriceCents: 29_900,
      annualDisplayPriceCents: 22_900,
      annualComparePriceCents: 29_900,
      annualDiscountLabel: "23% OFF",
      annualSaveLabel: "Save $840",
    },
    displayBenefits: {
      monthlyCreditsLabel: "8,000 credits every month",
      storageLabel: "150 GB of media storage",
    },
    pricingHighlights: ["Lowest cost per credit", "Discounted credit top-ups"],
  },
};

const DEFAULT_PLAN_ID = "free";
const GENERIC_PLAN_PRESENTATION: PlanPresentation = {
  className: "plan-generic",
  seatsLabel: "Workspace access",
  description: "Subscription plan.",
  cardFooterDescription: "Built for creators scaling their workflow.",
  cardFeatures: [
    { label: "Create studio", included: true },
    { label: "Editing studio", included: true },
    { label: "Video studio", included: true },
    { label: "Sound Studio", included: true },
  ],
  displayPricing: {
    monthlyDisplayPriceCents: 0,
    annualDisplayPriceCents: 0,
    annualComparePriceCents: null,
    annualDiscountLabel: null,
    annualSaveLabel: null,
  },
  displayBenefits: {
    monthlyCreditsLabel: "Credits every month",
    storageLabel: "Media storage",
  },
};

const GENERIC_PLAN_DISPLAY_PRICING: SubscriptionPlanDisplayPricing =
  GENERIC_PLAN_PRESENTATION.displayPricing!;
const GENERIC_PLAN_DISPLAY_BENEFITS: SubscriptionPlanDisplayBenefits =
  GENERIC_PLAN_PRESENTATION.displayBenefits!;

/**
 * Normalizes any plan identifier into a known plan key.
 */
export const normalizePlanId = (value: string | undefined | null): string => {
  const normalized = (value ?? "").toLowerCase().trim();
  // Handle legacy plan names
  if (normalized === "pro") return "studio";
  if (normalized === "creative") return "business";
  if (normalized === "creative_suite") return "business";
  // Current plan names
  if (normalized === "business") return "business";
  if (normalized === "studio") return "studio";
  if (normalized === "media") return "media";
  if (normalized === "starter") return "starter";
  if (normalized === "free") return "free";
  return normalized || DEFAULT_PLAN_ID;
};

export const filterPublicSubscriptionPlans = (plans: BillingPlanRecord[]): BillingPlanRecord[] => {
  return plans.filter((plan) => normalizePlanId(plan.id) !== "free");
};

/**
 * Returns a stable ordinal for tier comparisons so price changes do not affect upgrade logic.
 */
export const getPlanTierRank = (
  value: string | undefined | null,
  plans?: BillingPlanRecord[]
): number => {
  const normalized = normalizePlanId(value);
  const fromCatalog = plans?.find((plan) => normalizePlanId(plan.id) === normalized);
  if (fromCatalog && typeof fromCatalog.sort_order === "number") {
    return fromCatalog.sort_order;
  }
  const rank = PLAN_TIER_ORDER.indexOf(normalized as (typeof PLAN_TIER_ORDER)[number]);
  return rank >= 0 ? rank : Number.MAX_SAFE_INTEGER;
};

const humanizePlanId = (value: string): string =>
  value
    .split(/[_-]+/g)
    .filter(Boolean)
    .map((segment) => segment[0]?.toUpperCase() + segment.slice(1))
    .join(" ") || "Plan";

/**
 * Formats the plan's active-generation slot entitlement as exact customer-facing copy.
 */
export const formatConcurrentGenerationsLabel = (value: number, planId?: string | null): string => {
  const normalizedValue = Math.max(0, Math.trunc(Number.isFinite(value) ? value : 0));
  const normalizedPlanId = normalizePlanId(planId);
  if (normalizedValue === 1 && normalizedPlanId === "starter") {
    return "1 active image generation at a time";
  }
  if (normalizedValue === 1) return "1 active generation at a time";
  return `${normalizedValue.toLocaleString()} active generations at a time`;
};

/**
 * Resolves plan display data from database rows plus stable presentation metadata.
 */
export const buildPlanView = (params: {
  planId: string | undefined | null;
  plans: BillingPlanRecord[];
}): BillingPlanView => {
  const normalizedId = normalizePlanId(params.planId);
  const fromCatalog = params.plans.find((plan) => plan.id === normalizedId);
  const fallbackCatalog = params.plans.find((plan) => plan.id === DEFAULT_PLAN_ID);
  const resolvedCatalog =
    fromCatalog ?? (normalizedId === DEFAULT_PLAN_ID ? (fallbackCatalog ?? null) : null);
  const presentation =
    PLAN_PRESENTATION[normalizedId] ??
    (fromCatalog ? GENERIC_PLAN_PRESENTATION : PLAN_PRESENTATION[DEFAULT_PLAN_ID]);
  const maxConcurrentGenerations =
    resolvedCatalog?.max_concurrent_generations ?? resolveDefaultPlanConcurrencyLimit(normalizedId);
  const concurrentGenerationsLabel = formatConcurrentGenerationsLabel(
    maxConcurrentGenerations,
    normalizedId
  );

  return {
    id: normalizedId,
    displayName:
      presentation.displayNameOverride ??
      resolvedCatalog?.display_name ??
      humanizePlanId(normalizedId),
    className: presentation.className,
    description: presentation.description,
    cardFooterDescription: presentation.cardFooterDescription,
    seatsLabel: presentation.seatsLabel,
    concurrentGenerationsLabel,
    concurrentGenerationsCompactLabel: concurrentGenerationsLabel,
    cardFeatures: presentation.cardFeatures,
    bonusCreditsLabel: presentation.bonusCreditsLabel ?? null,
    displayPricing: presentation.displayPricing ?? GENERIC_PLAN_DISPLAY_PRICING,
    displayBenefits: presentation.displayBenefits ?? GENERIC_PLAN_DISPLAY_BENEFITS,
    pricingHighlights: presentation.pricingHighlights ?? [],
    monthlyPriceCents: resolvedCatalog?.monthly_price_cents ?? 0,
    monthlyCreditsCents: resolvedCatalog?.monthly_credits_cents ?? 0,
    storageLimitBytes:
      resolvedCatalog?.storage_limit_bytes ?? PLAN_STORAGE_LIMIT_BYTES_BY_ID[normalizedId] ?? 0,
    maxConcurrentGenerations,
  };
};

export const resolvePlanOfferForInterval = (
  plan: BillingPlanRecord,
  billingInterval: BillingInterval
): BillingPlanIntervalOfferRecord | null => {
  const directOffer = plan.offers?.[billingInterval];
  if (directOffer) return directOffer;

  if (billingInterval === "month") {
    return {
      id: `${plan.id}__month_legacy`,
      billing_interval: "month",
      recurring_price_cents: plan.monthly_price_cents,
      monthly_credits_cents: plan.monthly_credits_cents,
      storage_limit_bytes: plan.storage_limit_bytes,
      max_concurrent_generations:
        plan.max_concurrent_generations ?? resolveDefaultPlanConcurrencyLimit(plan.id),
      stripe_price_id: null,
      acquisition_enabled: Boolean(plan.is_active),
      is_active: Boolean(plan.is_active),
      effective_start_at: null,
    };
  }

  return null;
};

export type BillingPlanIntervalPricing = {
  billingInterval: BillingInterval;
  displayMode: "monthly" | "annual";
  source: "catalog" | "recommended";
  recurringPriceCents: number;
  monthlyEquivalentCents: number;
  monthlyCreditsCents: number;
  storageLimitBytes: number;
  maxConcurrentGenerations: number;
  billedPriceCents: number;
  savingsAmountCents: number;
  savingsPercent: number;
  savingsBadge: string | null;
  billingLabel: string;
  stripePriceId: string | null;
  offerId: string | null;
  hasLiveOffer: boolean;
};

export const resolvePlanPricingForInterval = (
  plan: BillingPlanRecord,
  billingInterval: BillingInterval
): BillingPlanIntervalPricing => {
  const normalizedPlanId = normalizePlanId(plan.id);
  const monthlyOffer = resolvePlanOfferForInterval(plan, "month");
  const baseMonthlyPriceCents = Math.max(0, Number(plan.monthly_price_cents ?? 0));
  const baseMonthlyCreditsCents = Math.max(0, Number(plan.monthly_credits_cents ?? 0));
  const baseStorageLimitBytes = Math.max(0, Number(plan.storage_limit_bytes ?? 0));
  const baseMaxConcurrentGenerations =
    plan.max_concurrent_generations ?? resolveDefaultPlanConcurrencyLimit(plan.id);

  if (billingInterval === "month" || normalizedPlanId === "free") {
    return {
      billingInterval: "month",
      displayMode: "monthly",
      source: monthlyOffer ? "catalog" : "recommended",
      recurringPriceCents: baseMonthlyPriceCents,
      monthlyEquivalentCents: baseMonthlyPriceCents,
      monthlyCreditsCents: monthlyOffer?.monthly_credits_cents ?? baseMonthlyCreditsCents,
      storageLimitBytes: monthlyOffer?.storage_limit_bytes ?? baseStorageLimitBytes,
      maxConcurrentGenerations:
        monthlyOffer?.max_concurrent_generations ?? baseMaxConcurrentGenerations,
      billedPriceCents: baseMonthlyPriceCents,
      savingsAmountCents: 0,
      savingsPercent: 0,
      savingsBadge: null,
      billingLabel: baseMonthlyPriceCents === 0 ? "forever" : "per month",
      stripePriceId: monthlyOffer?.stripe_price_id ?? null,
      offerId: monthlyOffer?.id ?? null,
      hasLiveOffer: Boolean(plan.offers?.month),
    };
  }

  const annualOffer = resolvePlanOfferForInterval(plan, "year");
  if (annualOffer) {
    const billedPriceCents = Math.max(0, Number(annualOffer.recurring_price_cents ?? 0));
    const monthlyEquivalentCents = Math.round(billedPriceCents / 12);
    const monthlyValueCents = baseMonthlyPriceCents * 12;
    const savingsAmountCents = Math.max(0, monthlyValueCents - billedPriceCents);
    const savingsPercent =
      monthlyValueCents > 0 ? Math.round((savingsAmountCents / monthlyValueCents) * 1000) / 10 : 0;

    return {
      billingInterval: "year",
      displayMode: "annual",
      source: "catalog",
      recurringPriceCents: billedPriceCents,
      monthlyEquivalentCents,
      monthlyCreditsCents: Number(annualOffer.monthly_credits_cents ?? baseMonthlyCreditsCents),
      storageLimitBytes: Number(annualOffer.storage_limit_bytes ?? baseStorageLimitBytes),
      maxConcurrentGenerations:
        annualOffer.max_concurrent_generations ?? baseMaxConcurrentGenerations,
      billedPriceCents,
      savingsAmountCents,
      savingsPercent,
      savingsBadge: savingsPercent > 0 ? `Save ${savingsPercent}%` : null,
      billingLabel: `billed annually as $${(billedPriceCents / 100).toFixed(0)}`,
      stripePriceId: annualOffer.stripe_price_id ?? null,
      offerId: annualOffer.id,
      hasLiveOffer: true,
    };
  }

  const annualConfig = ANNUAL_PRICING_CONFIG[normalizedPlanId];
  if (!annualConfig) {
    return {
      billingInterval: "month",
      displayMode: "monthly",
      source: monthlyOffer ? "catalog" : "recommended",
      recurringPriceCents: baseMonthlyPriceCents,
      monthlyEquivalentCents: baseMonthlyPriceCents,
      monthlyCreditsCents: monthlyOffer?.monthly_credits_cents ?? baseMonthlyCreditsCents,
      storageLimitBytes: monthlyOffer?.storage_limit_bytes ?? baseStorageLimitBytes,
      maxConcurrentGenerations:
        monthlyOffer?.max_concurrent_generations ?? baseMaxConcurrentGenerations,
      billedPriceCents: baseMonthlyPriceCents,
      savingsAmountCents: 0,
      savingsPercent: 0,
      savingsBadge: null,
      billingLabel: baseMonthlyPriceCents === 0 ? "forever" : "per month",
      stripePriceId: monthlyOffer?.stripe_price_id ?? null,
      offerId: monthlyOffer?.id ?? null,
      hasLiveOffer: Boolean(plan.offers?.month),
    };
  }

  const billedPriceCents = annualConfig.yearlyPriceCents;
  const monthlyEquivalentCents = Math.round(billedPriceCents / 12);
  const monthlyValueCents = baseMonthlyPriceCents * 12;
  const savingsAmountCents = Math.max(0, monthlyValueCents - billedPriceCents);
  const savingsPercent =
    monthlyValueCents > 0 ? Math.round((savingsAmountCents / monthlyValueCents) * 1000) / 10 : 0;

  return {
    billingInterval: "year",
    displayMode: "annual",
    source: "recommended",
    recurringPriceCents: billedPriceCents,
    monthlyEquivalentCents,
    monthlyCreditsCents: baseMonthlyCreditsCents,
    storageLimitBytes: baseStorageLimitBytes,
    maxConcurrentGenerations: baseMaxConcurrentGenerations,
    billedPriceCents,
    savingsAmountCents,
    savingsPercent,
    savingsBadge: annualConfig.savingsBadge,
    billingLabel: `billed annually as $${(billedPriceCents / 100).toFixed(0)}`,
    stripePriceId: null,
    offerId: null,
    hasLiveOffer: false,
  };
};

/**
 * Returns effective package unit price in dollars per 1,000 credits.
 */
export const getPackageUsdPerThousandCredits = (pkg: CreditPackageRecord): number => {
  if (!pkg.credit_amount_cents) return 0;
  return ((pkg.price_cents / pkg.credit_amount_cents) * 1000) / 100;
};

/**
 * Adds display analytics (badges and unit economics) to credit packages.
 */
export const annotateCreditPackages = (packages: CreditPackageRecord[]) => {
  if (!packages.length) return [];

  const sortedByUnitPrice = [...packages].sort((a, b) => {
    const aUnit = getPackageUsdPerThousandCredits(a);
    const bUnit = getPackageUsdPerThousandCredits(b);
    if (aUnit === bUnit) return a.sort_order - b.sort_order;
    return aUnit - bUnit;
  });

  const bestValueId = sortedByUnitPrice[0]?.id ?? null;

  return packages.map((pkg) => {
    const priceUsd = pkg.price_cents / 100;
    const creditFaceValueUsd = pkg.credit_amount_cents / 100;
    const unitUsdPerThousand = getPackageUsdPerThousandCredits(pkg);

    const badge = pkg.id === bestValueId ? "Best value" : pkg.id === "1200" ? "Most popular" : null;

    return {
      ...pkg,
      badge,
      priceUsd,
      creditFaceValueUsd,
      unitUsdPerThousand,
    };
  });
};
