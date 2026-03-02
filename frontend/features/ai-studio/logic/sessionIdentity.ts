/**
 * AI Studio session-identity helpers.
 * Provides strict `sid` query parsing/validation and UUID generation for URL session contracts.
 */

export const AI_STUDIO_SESSION_QUERY_KEY = "sid";

const SESSION_ID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeCandidateValue = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return SESSION_ID_REGEX.test(trimmed) ? trimmed : null;
};

const fallbackUuidV4 = (): string =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const randomNibble = Math.floor(Math.random() * 16);
    const value = char === "x" ? randomNibble : (randomNibble & 0x3) | 0x8;
    return value.toString(16);
  });

/**
 * Returns true when the provided value is a valid session UUID.
 */
export const isValidAiStudioSessionId = (value: string): boolean =>
  SESSION_ID_REGEX.test(value.trim());

/**
 * Parses a `sid` query candidate and returns a valid UUID string or `null`.
 */
export const parseAiStudioSessionId = (
  value: string | string[] | null | undefined
): string | null => {
  if (Array.isArray(value)) {
    for (const item of value) {
      const parsed = normalizeCandidateValue(String(item ?? ""));
      if (parsed) return parsed;
    }
    return null;
  }
  if (typeof value !== "string") return null;
  return normalizeCandidateValue(value);
};

/**
 * Creates a new UUID session identifier.
 */
export const createAiStudioSessionId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return fallbackUuidV4();
};
