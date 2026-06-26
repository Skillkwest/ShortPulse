/**
 * AI Studio insufficient-credit helpers.
 * Centralizes credit-shortage copy and detection so UI surfaces do not key behavior on ad hoc text.
 */

export const INSUFFICIENT_CREDITS_CODE = "INSUFFICIENT_CREDITS";
export const INSUFFICIENT_CREDITS_TITLE = "Insufficient Credits";
export const INSUFFICIENT_CREDITS_MESSAGE = "Insufficient credits.";

const INSUFFICIENT_CREDITS_TEXT_PATTERNS = [
  /\binsufficient credits?\b/i,
  /\bnot enough credits?\b/i,
  /\benough credits for this run\b/i,
];

type ErrorLikeWithCode = {
  code?: unknown;
  message?: unknown;
};

const stringifyPayload = (value: unknown): string => {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (value instanceof Error) return value.message;
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

/**
 * Returns true when a payload or Error represents ShortPulse credit shortage.
 */
export const isInsufficientCreditsLike = (value: unknown): boolean => {
  if (value && typeof value === "object") {
    const maybeError = value as ErrorLikeWithCode;
    if (maybeError.code === INSUFFICIENT_CREDITS_CODE) return true;
  }
  const text = stringifyPayload(value);
  return INSUFFICIENT_CREDITS_TEXT_PATTERNS.some((pattern) => pattern.test(text));
};

/**
 * Builds friendly modal body copy from known required/available credit values.
 */
export const buildInsufficientCreditsModalCopy = ({
  requiredCredits,
  availableCredits,
}: {
  requiredCredits?: number | null;
  availableCredits?: number | null;
}): string => {
  if (
    typeof requiredCredits === "number" &&
    Number.isFinite(requiredCredits) &&
    typeof availableCredits === "number" &&
    Number.isFinite(availableCredits)
  ) {
    return `This generation needs ${Math.max(0, Math.ceil(requiredCredits)).toLocaleString()} credits. You have ${Math.max(0, Math.floor(availableCredits)).toLocaleString()} available. Top up now and come right back to your project.`;
  }
  return "Your balance is too low for this generation. Top up now and come right back to your project.";
};
