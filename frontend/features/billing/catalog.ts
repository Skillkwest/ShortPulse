/**
 * Billing catalog helpers for plans and credit packages.
 * Monetary values come from Supabase rows so pricing can be changed without app code edits.
 */

export type BillingInterval = "month" | "year";

export type BillingPlanIntervalOfferRecord = {
  id: string;
  billing_interval: BillingInterval;
  recurring_price_cents: number;
  monthly_credits_cents: number;
  storage_limit_bytes: number;
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

const PLAN_TIER_ORDER = ["free", "media", "studio", "business"] as const;
const GIB = 1024 * 1024 * 1024;

const DEFAULT_PLAN_STORAGE_LIMITS: Record<string, number> = {
  free: 1 * GIB,
  media: 25 * GIB,
  studio: 100 * GIB,
  business: 500 * GIB,
};

type AnnualPricingConfig = {
  yearlyPriceCents: number;
  savingsBadge: string;
};

const ANNUAL_PRICING_CONFIG: Partial<Record<string, AnnualPricingConfig>> = {
  media: {
    yearlyPriceCents: 12_000,
    savingsBadge: "2 months free",
  },
  studio: {
    yearlyPriceCents: 39_000,
    savingsBadge: "2 months free",
  },
  business: {
    yearlyPriceCents: 139_200,
    savingsBadge: "Save 10%",
  },
};

type PlanPresentation = {
  className: string;
  seatsLabel: string;
  description: string;
  concurrentGenerationsLabel: string;
  concurrentGenerationsCompactLabel: string;
  pricingHighlights?: string[];
};

const PLAN_PRESENTATION: Record<string, PlanPresentation> = {
  free: {
    className: "plan-free",
    seatsLabel: "1 workspace seat",
    description: "Starter access for exploration.",
    concurrentGenerationsLabel: "1 audio, 1 image, and 1 video generation at a time",
    concurrentGenerationsCompactLabel: "1 audio · 1 image · 1 video",
  },
  media: {
    className: "plan-media",
    seatsLabel: "1 workspace seat",
    description: "Ideal for creators testing cadence.",
    concurrentGenerationsLabel: "2 audio, 2 image, and 1 video generations at a time",
    concurrentGenerationsCompactLabel: "2 audio · 2 image · 1 video",
  },
  studio: {
    className: "plan-studio",
    seatsLabel: "1 workspace seat",
    description: "Built for consistent creative production.",
    concurrentGenerationsLabel: "4 audio, 3 image, and 2 video generations at a time",
    concurrentGenerationsCompactLabel: "4 audio · 3 image · 2 video",
  },
  business: {
    className: "plan-business",
    seatsLabel: "Team access",
    description: "Highest throughput for heavy AI workloads.",
    concurrentGenerationsLabel: "6 audio, 4 image, and 3 video generations at a time",
    concurrentGenerationsCompactLabel: "6 audio · 4 image · 3 video",
    pricingHighlights: ["Lowest cost per credit", "Discounted credit top-ups"],
  },
};

const DEFAULT_PLAN_ID = "free";
const GENERIC_PLAN_PRESENTATION: PlanPresentation = {
  className: "plan-generic",
  seatsLabel: "Workspace access",
  description: "Subscription plan.",
  concurrentGenerationsLabel: "Standard concurrent generation access",
  concurrentGenerationsCompactLabel: "Standard concurrent access",
};

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
  if (normalized === "free") return "free";
  return normalized || DEFAULT_PLAN_ID;
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
 * Resolves plan display data from database rows plus stable presentation metadata.
 */
export const buildPlanView = (params: {
  planId: string | undefined | null;
  plans: BillingPlanRecord[];
}) => {
  const normalizedId = normalizePlanId(params.planId);
  const fromCatalog = params.plans.find((plan) => plan.id === normalizedId);
  const fallbackCatalog = params.plans.find((plan) => plan.id === DEFAULT_PLAN_ID);
  const resolvedCatalog =
    fromCatalog ?? (normalizedId === DEFAULT_PLAN_ID ? (fallbackCatalog ?? null) : null);
  const presentation =
    PLAN_PRESENTATION[normalizedId] ??
    (fromCatalog ? GENERIC_PLAN_PRESENTATION : PLAN_PRESENTATION[DEFAULT_PLAN_ID]);

  return {
    id: normalizedId,
    displayName: resolvedCatalog?.display_name ?? humanizePlanId(normalizedId),
    className: presentation.className,
    description: presentation.description,
    seatsLabel: presentation.seatsLabel,
    concurrentGenerationsLabel: presentation.concurrentGenerationsLabel,
    concurrentGenerationsCompactLabel: presentation.concurrentGenerationsCompactLabel,
    pricingHighlights: presentation.pricingHighlights ?? [],
    monthlyPriceCents: resolvedCatalog?.monthly_price_cents ?? 0,
    monthlyCreditsCents: resolvedCatalog?.monthly_credits_cents ?? 0,
    storageLimitBytes:
      resolvedCatalog?.storage_limit_bytes ?? DEFAULT_PLAN_STORAGE_LIMITS[normalizedId] ?? 0,
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

  if (billingInterval === "month" || normalizedPlanId === "free") {
    return {
      billingInterval: "month",
      displayMode: "monthly",
      source: monthlyOffer ? "catalog" : "recommended",
      recurringPriceCents: baseMonthlyPriceCents,
      monthlyEquivalentCents: baseMonthlyPriceCents,
      monthlyCreditsCents: monthlyOffer?.monthly_credits_cents ?? baseMonthlyCreditsCents,
      storageLimitBytes: monthlyOffer?.storage_limit_bytes ?? baseStorageLimitBytes,
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

    const badge =
      pkg.id === bestValueId ? "Best value" : pkg.id === "growth_2000" ? "Most popular" : null;

    return {
      ...pkg,
      badge,
      priceUsd,
      creditFaceValueUsd,
      unitUsdPerThousand,
    };
  });
};
