/**
 * Shared plan concurrency entitlement defaults.
 * These values are migration fallback defaults; subscriber contracts remain the runtime authority.
 */

export const PLAN_CONCURRENCY_LIMITS: Record<string, number> = {
  free: 0,
  starter: 1,
  media: 2,
  studio: 4,
  business: 8,
};

export const DEFAULT_PLAN_CONCURRENCY_LIMIT = 0;

export const PLAN_CONCURRENCY_DISPLAY_NAMES: Record<string, string> = {
  free: "Baseline access",
  starter: "Starter",
  media: "Media",
  studio: "Studio",
  business: "Business",
};

/**
 * Resolves the default active-generation slot limit for a plan id.
 */
export const resolveDefaultPlanConcurrencyLimit = (planId: string | null | undefined): number => {
  const normalized = (planId ?? "").trim().toLowerCase();
  return PLAN_CONCURRENCY_LIMITS[normalized] ?? DEFAULT_PLAN_CONCURRENCY_LIMIT;
};

/**
 * Resolves the customer-facing plan label for concurrency-limit messages.
 */
export const resolvePlanConcurrencyDisplayName = (planId: string | null | undefined): string => {
  const normalized = (planId ?? "").trim().toLowerCase();
  return PLAN_CONCURRENCY_DISPLAY_NAMES[normalized] ?? "Current plan";
};
