/**
 * Shared credit-conversion helpers for model runtime pricing.
 * Converts provider USD to credits with optional markup and model-specific rounding.
 */

export type CreditRoundingMode = "nearest-5" | "ceil";

const BIGINT_ZERO = BigInt(0);
const BIGINT_ONE = BigInt(1);
const CREDIT_USD_SCALE = BigInt(100); // 1 USD = 100 credits
const USD_MICRO_SCALE = BigInt(1_000_000); // 1e-6 USD precision
const MARKUP_NUMERATOR = BigInt(103);
const MARKUP_DENOMINATOR = BigInt(100);

const EXCEPTION_ROUNDING_MODEL_IDS = new Set([
  "fal-ai/flux-2/klein/9b",
  "fal-ai/bria/background/remove",
]);

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
  return parseScaledDecimal(usdRaw.toFixed(12), USD_MICRO_SCALE);
};

export const resolveModelCreditRoundingMode = (modelId: string): CreditRoundingMode =>
  EXCEPTION_ROUNDING_MODEL_IDS.has(modelId) ? "ceil" : "nearest-5";

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

  let numerator = usdMicro * CREDIT_USD_SCALE;
  let denominator = USD_MICRO_SCALE;
  if (applyMarkup) {
    numerator *= MARKUP_NUMERATOR;
    denominator *= MARKUP_DENOMINATOR;
  }

  const rawCredits = Number(ceilDiv(numerator, denominator));
  const roundingMode = resolveModelCreditRoundingMode(modelId);
  const credits = roundingMode === "ceil" ? rawCredits : Math.ceil(rawCredits / 5) * 5;

  return {
    rawCredits,
    credits,
    billedUsd: credits / 100,
  };
};
