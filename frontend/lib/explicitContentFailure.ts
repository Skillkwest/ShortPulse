/**
 * Shared explicit-content failure copy and detection helpers.
 * Keeps provider moderation failures aligned across server persistence and client UI.
 */

export const EXPLICIT_CONTENT_FAILURE_SHORT_MESSAGE = "Content not allowed";
export const EXPLICIT_CONTENT_FAILURE_TITLE = "Explicit content blocked";
export const EXPLICIT_CONTENT_FAILURE_MESSAGE =
  "This request was blocked for explicit or unsafe content.";
export const EXPLICIT_CONTENT_FAILURE_DETAIL =
  "This request was blocked for explicit or unsafe content. Try revising the prompt or references.";

const EXPLICIT_CONTENT_PATTERNS = [
  /\bcontent not allowed\b/i,
  /\bcontent polic(?:y|ies)\b/i,
  /\bsafety policy\b/i,
  /\bsafety blocked\b/i,
  /\bunsafe content\b/i,
  /\bflagged as unsafe\b/i,
  /\bmoderation\b/i,
  /\bexplicit\b/i,
  /\bnsfw\b/i,
  /\bnudity\b/i,
  /\bsexual\b/i,
  /\badult\b/i,
  /\bsafety system\b/i,
];

export const isExplicitContentFailureMessage = (message: string | null | undefined): boolean => {
  if (typeof message !== "string") return false;
  const normalized = message.trim();
  if (!normalized) return false;
  return EXPLICIT_CONTENT_PATTERNS.some((pattern) => pattern.test(normalized));
};

export const normalizeExplicitContentFailure = ({
  message,
  detail,
  force = false,
}: {
  message?: string | null;
  detail?: string | null;
  force?: boolean;
}) => {
  if (
    !force &&
    !isExplicitContentFailureMessage(detail) &&
    !isExplicitContentFailureMessage(message)
  ) {
    return null;
  }
  return {
    errorMessage: EXPLICIT_CONTENT_FAILURE_MESSAGE,
    errorMessageShort: EXPLICIT_CONTENT_FAILURE_SHORT_MESSAGE,
    errorDetail: EXPLICIT_CONTENT_FAILURE_DETAIL,
  };
};
