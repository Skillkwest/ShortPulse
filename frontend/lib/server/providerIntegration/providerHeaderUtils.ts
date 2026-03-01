/**
 * Shared provider header parsing helpers.
 * Keeps status/retry boundary modules aligned on consistent header semantics.
 */

/**
 * Parses boolean-like HTTP header values.
 * Returns null for missing/invalid values.
 */
export const parseBooleanHeader = (value: string | null): boolean | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return null;
};
