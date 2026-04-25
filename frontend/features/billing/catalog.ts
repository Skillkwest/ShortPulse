/**
 * Billing catalog helpers for plans and credit packages.
 * Monetary values come from Supabase rows so pricing can be changed without app code edits.
 */

export type BillingPlanRecord = {
  id: string;
  display_name: string;
  sort_order?: number;
  monthly_price_cents: number;
  monthly_credits_cents: number;
  storage_limit_bytes: number;
  is_active?: boolean;
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

const PLAN_TIER_ORDER = ["free", "media", "studio", "business"] as const;
const GIB = 1024 * 1024 * 1024;

const DEFAULT_PLAN_STORAGE_LIMITS: Record<string, number> = {
  free: 1 * GIB,
  media: 25 * GIB,
  studio: 100 * GIB,
  business: 500 * GIB,
};

type PlanPresentation = {
  className: string;
  seatsLabel: string;
  description: string;
};

const PLAN_PRESENTATION: Record<string, PlanPresentation> = {
  free: {
    className: "plan-free",
    seatsLabel: "1 workspace seat",
    description: "Starter access for exploration.",
  },
  media: {
    className: "plan-media",
    seatsLabel: "2 seats",
    description: "Ideal for creators testing cadence.",
  },
  studio: {
    className: "plan-studio",
    seatsLabel: "Up to 5 seats",
    description: "Built for consistent creative production.",
  },
  business: {
    className: "plan-business",
    seatsLabel: "Team access",
    description: "Highest throughput for heavy AI workloads.",
  },
};

const DEFAULT_PLAN_ID = "free";
const GENERIC_PLAN_PRESENTATION: PlanPresentation = {
  className: "plan-generic",
  seatsLabel: "Workspace access",
  description: "Subscription plan.",
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
    monthlyPriceCents: resolvedCatalog?.monthly_price_cents ?? 0,
    monthlyCreditsCents: resolvedCatalog?.monthly_credits_cents ?? 0,
    storageLimitBytes:
      resolvedCatalog?.storage_limit_bytes ?? DEFAULT_PLAN_STORAGE_LIMITS[normalizedId] ?? 0,
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
