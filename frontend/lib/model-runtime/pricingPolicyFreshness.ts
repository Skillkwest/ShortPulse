/**
 * Shared pricing-policy freshness constants and payload types used by submit routes and client handlers.
 */
export const PRICING_POLICY_STALE_CODE = "PRICING_POLICY_STALE";
export const PRICING_POLICY_VERSION_REQUIRED_CODE = "PRICING_POLICY_VERSION_REQUIRED";
export const PRICING_POLICY_REFRESH_REQUESTED_EVENT = "shortpulse:pricing-policy-refresh-requested";
export const PRICING_POLICY_CONFLICT_EVENT = "shortpulse:pricing-policy-conflict";

export type PricingPolicyConflictCode =
  | typeof PRICING_POLICY_STALE_CODE
  | typeof PRICING_POLICY_VERSION_REQUIRED_CODE;

export type PricingPolicyConflictPayload = {
  error: string;
  code: PricingPolicyConflictCode;
  displayedPricingPolicyVersion: number | null;
  activePricingPolicyVersion: number | null;
  displayedBilledCredits: number | null;
  activeBilledCredits: number | null;
  displayedPricingVariantId: string | null;
  activePricingVariantId: string | null;
};

export const isPricingPolicyConflictCode = (value: unknown): value is PricingPolicyConflictCode =>
  value === PRICING_POLICY_STALE_CODE || value === PRICING_POLICY_VERSION_REQUIRED_CODE;
