/**
 * Shared media query model helpers used by Media Library page and AI Studio modal.
 * Centralizes tab filters, search clause generation, and prompt user-scope rules.
 */

export type MediaQueryDataTab =
  | "uploaded_images"
  | "uploaded_videos"
  | "private"
  | "ai_generations";

const DEFAULT_PRIVATE_MEDIA_SOURCE = "private_upload";

/**
 * Normalizes a free-text search term for safe `ilike` query usage.
 */
export const normalizeMediaSearchTerm = (value: string): string =>
  value
    .trim()
    .replace(/[,%*()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Builds a media search `or(...)` clause for filename/storage path matching.
 */
export const buildMediaSearchOrClause = (value: string): string | null => {
  const normalized = normalizeMediaSearchTerm(value);
  if (!normalized) return null;
  const wildcard = `*${normalized}*`;
  return `filename.ilike.${wildcard},storage_path.ilike.${wildcard}`;
};

/**
 * Applies media search filtering to a query builder when a term exists.
 */
export const withMediaSearchFilter = <T extends { or: (clause: string) => T }>(
  query: T,
  rawSearchTerm: string
): T => {
  const clause = buildMediaSearchOrClause(rawSearchTerm);
  if (!clause) return query;
  return query.or(clause);
};

/**
 * Applies tab-specific source/type filtering to a media query builder.
 */
export const withMediaTabFilter = <
  T extends {
    eq: (column: string, value: string) => T;
    ilike: (column: string, pattern: string) => T;
  },
>(
  query: T,
  tab: MediaQueryDataTab,
  options?: { privateMediaSource?: string }
): T => {
  const privateMediaSource = options?.privateMediaSource ?? DEFAULT_PRIVATE_MEDIA_SOURCE;
  if (tab === "private") return query.eq("source", privateMediaSource);
  if (tab === "ai_generations") return query.eq("source", "ai_studio");
  if (tab === "uploaded_videos") return query.eq("source", "upload").ilike("file_type", "video%");
  return query.eq("source", "upload").ilike("file_type", "image%");
};

/**
 * Enforces user-scoped prompt query semantics with stable sort ordering.
 */
export const withUserScopedPromptQuery = <
  T extends {
    eq: (column: string, value: string) => T;
    order: (column: string, options: { ascending: boolean }) => T;
  },
>(
  query: T,
  userId: string
): T => {
  return query.eq("user_id", userId).order("created_at", { ascending: false }).order("id", {
    ascending: false,
  });
};
