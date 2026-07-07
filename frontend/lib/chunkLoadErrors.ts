/**
 * Helpers for recognizing Next.js client chunk load failures.
 * Used by route-change and action-triggered lazy import recovery paths.
 */

const NEXT_STATIC_CHUNK_PATTERN =
  /(?:https?:\/\/[^\s"')]+)?(\/_next\/static\/chunks\/[^\s"')]+?\.js)(?:\?[^\s"')]+)?/;
const NEXT_ROUTE_LOAD_TIMEOUT_PATTERN = /^Route did not complete loading:\s*(\/\S*)/i;
const NEXT_OUTDATED_DEPLOYMENT_PATTERN = /loaded static props were from an outdated deployment/i;

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

/**
 * Detects Next.js route-loader timeouts separately from missing chunk assets.
 */
export const hasNextRouteLoadTimeoutText = (value: string): boolean => {
  return NEXT_ROUTE_LOAD_TIMEOUT_PATTERN.test(value.trim());
};

/**
 * Detects the expected Next.js deploy-skew recovery where the router hard
 * reloads because static props came from a different deployment id.
 */
export const hasNextOutdatedDeploymentText = (value: string): boolean => {
  return NEXT_OUTDATED_DEPLOYMENT_PATTERN.test(value.trim());
};

/**
 * Returns the route whose client entrypoint did not register before timeout.
 */
export const extractNextRouteLoadTimeoutRoute = (value: string): string | null => {
  const match = value.trim().match(NEXT_ROUTE_LOAD_TIMEOUT_PATTERN);
  return match?.[1] ?? null;
};
