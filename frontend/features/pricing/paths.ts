/**
 * Shared pricing-route helpers for guest funnel navigation and post-auth return paths.
 * Keeps dashboard, pricing, and auth transitions on one consistent URL contract.
 */
import { normalizePlanId } from "../billing/catalog";
import { buildLoginPath, buildSignupPath } from "../../lib/authRedirects";

export type PricingIntent = "create-project" | "open-projects" | "dashboard" | "tutorial";
export type PricingBillingInterval = "month" | "year";

const DEFAULT_PRICING_INTENT: PricingIntent = "dashboard";
const DEFAULT_PRICING_BILLING_INTERVAL: PricingBillingInterval = "year";
const PAID_PRICING_PLAN_IDS = new Set(["starter", "media", "studio", "business"]);

/**
 * Normalizes any incoming pricing intent query value into a supported funnel intent.
 */
export const normalizePricingIntent = (value: string | string[] | undefined): PricingIntent => {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const normalized = typeof rawValue === "string" ? rawValue.trim().toLowerCase() : "";
  if (normalized === "create-project") return "create-project";
  if (normalized === "open-projects") return "open-projects";
  if (normalized === "tutorial") return "tutorial";
  return DEFAULT_PRICING_INTENT;
};

/**
 * Normalizes an optional selected plan id for pricing-route URLs.
 */
export const normalizePricingPlanId = (value: string | string[] | undefined): string | null => {
  const rawValue = Array.isArray(value) ? value[0] : value;
  if (typeof rawValue !== "string" || !rawValue.trim()) return null;
  return normalizePlanId(rawValue);
};

export const normalizePaidPricingPlanId = (value: string | string[] | undefined): string | null => {
  const normalized = normalizePricingPlanId(value);
  return normalized && PAID_PRICING_PLAN_IDS.has(normalized) ? normalized : null;
};

export const normalizePricingBillingInterval = (
  value: string | string[] | undefined
): PricingBillingInterval => {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const normalized = typeof rawValue === "string" ? rawValue.trim().toLowerCase() : "";
  if (normalized === "month") return "month";
  if (normalized === "year") return "year";
  return DEFAULT_PRICING_BILLING_INTERVAL;
};

/**
 * Builds a stable pricing-route href with optional intent and plan query state.
 */
export const buildPricingPath = (params?: {
  intent?: PricingIntent;
  planId?: string | null;
  billingInterval?: PricingBillingInterval;
}): string => {
  const intent = params?.intent ?? DEFAULT_PRICING_INTENT;
  const normalizedPlanId = normalizePricingPlanId(params?.planId ?? undefined);
  const billingInterval = normalizePricingBillingInterval(params?.billingInterval);
  const query = new URLSearchParams();
  if (intent !== DEFAULT_PRICING_INTENT) {
    query.set("intent", intent);
  }
  if (normalizedPlanId) {
    query.set("plan", normalizedPlanId);
  }
  if (billingInterval !== DEFAULT_PRICING_BILLING_INTERVAL) {
    query.set("interval", billingInterval);
  }
  const queryString = query.toString();
  return queryString ? `/pricing?${queryString}` : "/pricing";
};

/**
 * Builds an auth route that returns the visitor to pricing with the same intent.
 */
export const buildPricingAuthPath = (params?: {
  intent?: PricingIntent;
  planId?: string | null;
  billingInterval?: PricingBillingInterval;
  publicSignupEnabled?: boolean;
}): string => {
  const planId = normalizePaidPricingPlanId(params?.planId ?? undefined);
  const nextPath = buildPricingPath({
    ...params,
    planId,
  });
  if (params?.publicSignupEnabled === false) {
    return buildLoginPath({ nextPath });
  }
  return buildSignupPath({ nextPath });
};

/**
 * Builds an auth route that returns the visitor to the dashboard after authentication.
 */
export const buildDashboardAuthPath = (): string => {
  return buildLoginPath({ nextPath: "/dashboard" });
};

/**
 * Builds the canonical public signup route for entering AI Studio.
 */
export const buildDashboardSignupPath = (): string => {
  return buildSignupPath({ nextPath: "/ai-studio" });
};
