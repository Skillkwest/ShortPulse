/**
 * Shared pricing-route helpers for guest funnel navigation and post-auth return paths.
 * Keeps dashboard, pricing, and auth transitions on one consistent URL contract.
 */
import { normalizePlanId } from "../billing/catalog";

export type PricingIntent = "create-project" | "open-projects" | "dashboard";

const DEFAULT_PRICING_INTENT: PricingIntent = "dashboard";

/**
 * Normalizes any incoming pricing intent query value into a supported funnel intent.
 */
export const normalizePricingIntent = (value: string | string[] | undefined): PricingIntent => {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const normalized = typeof rawValue === "string" ? rawValue.trim().toLowerCase() : "";
  if (normalized === "create-project") return "create-project";
  if (normalized === "open-projects") return "open-projects";
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

/**
 * Builds a stable pricing-route href with optional intent and plan query state.
 */
export const buildPricingPath = (params?: {
  intent?: PricingIntent;
  planId?: string | null;
}): string => {
  const intent = params?.intent ?? DEFAULT_PRICING_INTENT;
  const normalizedPlanId = normalizePricingPlanId(params?.planId ?? undefined);
  const query = new URLSearchParams();
  if (intent !== DEFAULT_PRICING_INTENT) {
    query.set("intent", intent);
  }
  if (normalizedPlanId) {
    query.set("plan", normalizedPlanId);
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
}): string => `/auth?next=${encodeURIComponent(buildPricingPath(params))}`;
