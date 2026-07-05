/**
 * Helpers for recognizing Next.js client chunk load failures.
 * Used by route-change and action-triggered lazy import recovery paths.
 */

const NEXT_STATIC_CHUNK_PATTERN =
  /(?:https?:\/\/[^\s"')]+)?(\/_next\/static\/chunks\/[^\s"')]+?\.js)(?:\?[^\s"')]+)?/;

/**
 * Extracts a normalized message from an unknown chunk-load error payload.
 */
export const toChunkLoadErrorMessage = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object" && "message" in value) {
    const candidate = (value as { message?: unknown }).message;
    return typeof candidate === "string" ? candidate.trim() : "";
  }
  return "";
};

/**
 * Detects the common Next.js script/chunk load signatures without matching
 * unrelated application fetch failures.
 */
export const hasNextChunkLoadFailureText = (value: string): boolean => {
  const lower = value.toLowerCase();
  return (
    lower.includes("chunkloaderror") ||
    lower.includes("loading chunk") ||
    lower.includes("failed to load script") ||
    (lower.includes("failed to load") && NEXT_STATIC_CHUNK_PATTERN.test(value))
  );
};

/**
 * Returns the failed static chunk path when the browser error includes one.
 */
export const extractFailedNextChunk = (value: string): string | null => {
  const match = value.match(NEXT_STATIC_CHUNK_PATTERN);
  return match?.[1] ?? null;
};
