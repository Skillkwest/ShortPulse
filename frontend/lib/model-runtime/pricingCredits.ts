/**
 * Shared credit-conversion helpers for model runtime pricing.
 * Converts provider USD to credits with optional markup and model-specific rounding.
 */

import {
  CREDIT_USD_SCALE,
  DEFAULT_CREDIT_ROUNDING_INCREMENT,
  DEFAULT_CREDIT_ROUNDING_MODE,
  EXCEPTION_ROUNDING_MODEL_IDS,
  MARKUP_DENOMINATOR,
  MARKUP_NUMERATOR,
  USD_MICRO_SCALE,
  type CreditRoundingMode,
} from "./pricingPolicy";

const BIGINT_ZERO = BigInt(0);
const BIGINT_ONE = BigInt(1);
const CREDIT_USD_SCALE_BIGINT = BigInt(CREDIT_USD_SCALE);
const USD_MICRO_SCALE_BIGINT = BigInt(USD_MICRO_SCALE);
const MARKUP_NUMERATOR_BIGINT = BigInt(MARKUP_NUMERATOR);
const MARKUP_DENOMINATOR_BIGINT = BigInt(MARKUP_DENOMINATOR);
const EXCEPTION_ROUNDING_MODEL_ID_SET = new Set<string>(EXCEPTION_ROUNDING_MODEL_IDS);

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

export const resolveModelCreditRoundingMode = (modelId: string): CreditRoundingMode =>
  EXCEPTION_ROUNDING_MODEL_ID_SET.has(modelId) ? "ceil" : DEFAULT_CREDIT_ROUNDING_MODE;

/**
 * Converts provider USD to credits with decimal-safe math.
 * Markup is applied before quantization.
 */
export const convertUsdToCredits = ({
  usdRaw,
  modelId,
  applyMarkup = true,
}: {
  usdRaw: number;
  modelId: string;
  applyMarkup?: boolean;
}) => {
  const usdMicro = toMicroUsd(usdRaw);
  if (usdMicro <= BIGINT_ZERO) {
    return {
      rawCredits: 0,
      credits: 0,
      billedUsd: 0,
    };
  }

  let numerator = usdMicro * CREDIT_USD_SCALE_BIGINT;
  let denominator = USD_MICRO_SCALE_BIGINT;
  if (applyMarkup) {
    numerator *= MARKUP_NUMERATOR_BIGINT;
    denominator *= MARKUP_DENOMINATOR_BIGINT;
  }

  const rawCredits = Number(ceilDiv(numerator, denominator));
  const roundingMode = resolveModelCreditRoundingMode(modelId);
  const credits =
    roundingMode === "ceil"
      ? rawCredits
      : Math.ceil(rawCredits / DEFAULT_CREDIT_ROUNDING_INCREMENT) *
        DEFAULT_CREDIT_ROUNDING_INCREMENT;

  return {
    rawCredits,
    credits,
    billedUsd: credits / 100,
  };
};
