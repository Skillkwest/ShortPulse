/**
 * Shared static pricing-policy defaults for model credit conversion.
 * These values are the current runtime source of truth until an admin control plane replaces them.
 */

export type CreditRoundingMode = "nearest-5" | "ceil";

export const CREDIT_USD_SCALE = 100; // 1 USD = 100 credits
export const USD_MICRO_SCALE = 1_000_000; // 1e-6 USD precision
export const MARKUP_NUMERATOR = 103;
export const MARKUP_DENOMINATOR = 100;
export const DEFAULT_CREDIT_ROUNDING_MODE: CreditRoundingMode = "nearest-5";
export const DEFAULT_CREDIT_ROUNDING_INCREMENT = 5;

export const EXCEPTION_ROUNDING_MODEL_IDS = [
  "fal-ai/flux-2/klein/9b",
  "fal-ai/bria/background/remove",
] as const;

export const MODEL_PRICING_POLICY_VERSION = "runtime-default-v1";

export const getModelPricingPolicySnapshot = () => ({
  version: MODEL_PRICING_POLICY_VERSION,
  creditUsdScale: CREDIT_USD_SCALE,
  creditValueUsd: 1 / CREDIT_USD_SCALE,
  markupNumerator: MARKUP_NUMERATOR,
  markupDenominator: MARKUP_DENOMINATOR,
  markupPercent: (MARKUP_NUMERATOR / MARKUP_DENOMINATOR - 1) * 100,
  defaultRoundingMode: DEFAULT_CREDIT_ROUNDING_MODE,
  defaultRoundingIncrement: DEFAULT_CREDIT_ROUNDING_INCREMENT,
  exceptionRoundingModelIds: Array.from(EXCEPTION_ROUNDING_MODEL_IDS),
});
