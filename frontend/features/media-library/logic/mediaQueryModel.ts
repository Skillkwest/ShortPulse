/**
 * Shared media query model helpers used by Media Library page and AI Studio modal.
 * Centralizes tab filters, search clause generation, and prompt user-scope rules.
 */
import {
  MEDIA_ROW_AUDIO_EXTENSIONS,
  MEDIA_ROW_VIDEO_EXTENSIONS,
  type MediaRowKind,
} from "../../../lib/mediaRowKind";

export type MediaQueryDataTab =
  | "uploaded_images"
  | "uploaded_videos"
  | "private"
  | "ai_generations";

const DEFAULT_PRIVATE_MEDIA_SOURCE = "private_upload";

type QueryMediaKind = Extract<MediaRowKind, "video" | "audio">;

const buildPathExtensionClauses = (
  column: "storage_path" | "preview_variant_path",
  extensions: readonly string[]
): string[] => extensions.map((extension) => `${column}.ilike.*.${extension}`);

export const buildMediaKindOrClause = (kind: QueryMediaKind): string => {
  const extensions = kind === "video" ? MEDIA_ROW_VIDEO_EXTENSIONS : MEDIA_ROW_AUDIO_EXTENSIONS;
  return [
    `file_type.ilike.${kind}*`,
    ...buildPathExtensionClauses("storage_path", extensions),
    ...buildPathExtensionClauses("preview_variant_path", extensions),
  ].join(",");
};

export const withPlayableMediaKindFilter = <T extends { or: (clause: string) => T }>(
  query: T,
  kind: QueryMediaKind
): T => query.or(buildMediaKindOrClause(kind));

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
    not: (column: string, operator: string, value: string) => T;
    or: (clause: string) => T;
  },
>(
  query: T,
  tab: MediaQueryDataTab,
  options?: { privateMediaSource?: string }
): T => {
  const privateMediaSource = options?.privateMediaSource ?? DEFAULT_PRIVATE_MEDIA_SOURCE;
  if (tab === "private") return query.eq("source", privateMediaSource);
  if (tab === "ai_generations") {
    return query.eq("source", "ai_studio");
  }
  if (tab === "uploaded_videos") {
    return withPlayableMediaKindFilter(query.eq("source", "upload"), "video");
  }
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
