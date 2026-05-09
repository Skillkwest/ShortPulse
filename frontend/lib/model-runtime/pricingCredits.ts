/**
 * Shared credit-conversion helpers for model runtime pricing.
 * Converts provider USD to credits with optional markup and model-specific rounding.
 */

import {
  CREDIT_USD_SCALE,
  DEFAULT_MARKUP_BPS,
  DEFAULT_CREDIT_ROUNDING_INCREMENT,
  USD_MICRO_SCALE,
  resolveModelPricingForModel,
  type ModelPricingPolicyDocument,
  type CreditRoundingMode,
} from "./pricingPolicy";

const BIGINT_ZERO = BigInt(0);
const BIGINT_ONE = BigInt(1);
const USD_MICRO_SCALE_BIGINT = BigInt(USD_MICRO_SCALE);
const BPS_DENOMINATOR = BigInt(10_000);

const ceilDiv = (numerator: bigint, denominator: bigint): bigint => {
  if (denominator <= BIGINT_ZERO) throw new Error("denominator must be positive");
  if (numerator <= BIGINT_ZERO) return BIGINT_ZERO;
  return (numerator + denominator - BIGINT_ONE) / denominator;
};

const parseScaledDecimal = (value: string, scale: bigint): bigint => {
  const trimmed = value.trim();
  if (!trimmed) return BIGINT_ZERO;

  const negative = trimmed.startsWith("-");
  const normalized = negative ? trimmed.slice(1) : trimmed;
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error(`Unsupported decimal value: ${value}`);
  }

  const [wholePart, fractionalPartRaw = ""] = normalized.split(".");
  const scaleDigits = scale.toString().length - 1;
  const fractionalPart = (fractionalPartRaw + "0".repeat(scaleDigits)).slice(0, scaleDigits);

  const whole = BigInt(wholePart || "0") * scale;
  const fraction = BigInt(fractionalPart || "0");
  const combined = whole + fraction;
  return negative ? -combined : combined;
};

const toMicroUsd = (usdRaw: number): bigint => {
  if (!Number.isFinite(usdRaw)) return BIGINT_ZERO;
  // toFixed normalizes binary floating-point jitter before bigint conversion.
  return parseScaledDecimal(usdRaw.toFixed(12), USD_MICRO_SCALE_BIGINT);
};

export const resolveModelCreditRoundingMode = (
  modelId: string,
  policy?: ModelPricingPolicyDocument | null,
  variantId?: string | null
): CreditRoundingMode => resolveModelPricingForModel(policy, modelId, variantId).roundingMode;

/**
 * Converts provider USD to credits with decimal-safe math.
 * Markup is applied before credit ceiling and any row-specific round-nearest override.
 */
export const convertUsdToCredits = ({
  usdRaw,
  modelId,
  applyMarkup = true,
  policy = null,
  variantId = null,
}: {
  usdRaw: number;
  modelId: string;
  applyMarkup?: boolean;
  policy?: ModelPricingPolicyDocument | null;
  variantId?: string | null;
}) => {
  const usdMicro = toMicroUsd(usdRaw);
  const resolvedPolicy = resolveModelPricingForModel(policy, modelId, variantId);
  const creditUsdScaleBigInt = BigInt(resolvedPolicy.creditUsdScale || CREDIT_USD_SCALE);
  if (usdMicro <= BIGINT_ZERO) {
    return {
      rawCredits: 0,
      credits: 0,
      billedUsd: 0,
    };
  }

  let numerator = usdMicro * creditUsdScaleBigInt;
  let denominator = USD_MICRO_SCALE_BIGINT;
  if (applyMarkup) {
    numerator *= BigInt(10_000 + (resolvedPolicy.markupBps ?? DEFAULT_MARKUP_BPS));
    denominator *= BPS_DENOMINATOR;
  }

  const rawCredits = Number(ceilDiv(numerator, denominator));
  const roundingMode = resolveModelCreditRoundingMode(modelId, policy, variantId);
  const credits =
    roundingMode === "ceil"
      ? rawCredits
      : Math.ceil(
          rawCredits / (resolvedPolicy.roundingIncrement || DEFAULT_CREDIT_ROUNDING_INCREMENT)
        ) * (resolvedPolicy.roundingIncrement || DEFAULT_CREDIT_ROUNDING_INCREMENT);

  return {
    rawCredits,
    credits,
    billedUsd: credits / resolvedPolicy.creditUsdScale,
  };
};
