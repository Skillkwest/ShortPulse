/**
 * Shared Media Library page helpers for tab routing, cache state, and pagination utilities.
 * Keep this module React-free so page orchestration stays focused on UI and side effects.
 */
import { resolveMediaKindFromFileType, resolveMediaRowKind } from "../../../lib/mediaRowKind";
import {
  normalizeMediaSearchTerm as normalizeMediaSearchTermShared,
  withMediaSearchFilter as withMediaSearchFilterShared,
  withMediaTabFilter as withMediaTabFilterShared,
  withUserScopedPromptQuery as withUserScopedPromptQueryShared,
} from "./mediaQueryModel";
export type { MediaSignBudget } from "../../../lib/mediaPreviewRuntimePolicy";

export const BUCKET = "media_library";
export const PRIVATE_MEDIA_SOURCE = "private_upload";
const PRIVATE_MEDIA_FOLDER = "private";
export type MediaDataTab = "uploaded_images" | "uploaded_videos" | "private" | "ai_generations";

export type MediaCursor = {
  createdAt: string;
  id: string;
};

export type MediaTabCache<TRow> = {
  rows: TRow[];
  nextCursor: MediaCursor | null;
  pagesLoaded: number;
  query: string;
  loadedAtMs: number | null;
  hasMore: boolean;
  loading: boolean;
  loaded: boolean;
  error: string | null;
};

export type MediaTabRequestState = Record<MediaDataTab, number>;
export type MediaTabBooleanState = Record<MediaDataTab, boolean>;

export const MEDIA_DATA_TABS: MediaDataTab[] = [
  "uploaded_images",
  "uploaded_videos",
  "private",
  "ai_generations",
];

export const sanitizeFileName = (name: string) => name.replace(/[^\w.-]+/g, "_");

export const fileTypeFromMime = (mime: string) => {
  if (mime.startsWith("video/")) return "video";
  return "image";
};

export const isVideoFile = (fileType?: string | null) =>
  resolveMediaKindFromFileType(fileType) === "video";

export const isPrivateStoragePath = (storagePath?: string | null) =>
  (storagePath ?? "").split("/").filter(Boolean).includes(PRIVATE_MEDIA_FOLDER);

export const isPrivateMediaFile = (file: {
  source?: string | null;
  storage_path?: string | null;
}) => (file.source ?? "") === PRIVATE_MEDIA_SOURCE || isPrivateStoragePath(file.storage_path);

export const isMediaDataTab = (tab: string): tab is MediaDataTab => tab !== "saved_prompts";

export const getMediaDataTabForRow = (row: {
  source?: string | null;
  storage_path?: string | null;
  file_type?: string | null;
  preview_variant_path?: string | null;
  poster_variant_path?: string | null;
  thumb_variant_path?: string | null;
  metadata?: Record<string, unknown> | null;
}): MediaDataTab => {
  if (isPrivateMediaFile(row)) return "private";
  if ((row.source ?? "upload") === "ai_studio") return "ai_generations";
  return resolveMediaRowKind(row) === "video" ? "uploaded_videos" : "uploaded_images";
};

export const createEmptyMediaTabCache = <TRow>(): MediaTabCache<TRow> => ({
  rows: [],
  nextCursor: null,
  pagesLoaded: 0,
  query: "",
  loadedAtMs: null,
  hasMore: true,
  loading: false,
  loaded: false,
  error: null,
});

export const createMediaTabCacheState = <TRow>(): Record<MediaDataTab, MediaTabCache<TRow>> => ({
  uploaded_images: createEmptyMediaTabCache<TRow>(),
  uploaded_videos: createEmptyMediaTabCache<TRow>(),
  private: createEmptyMediaTabCache<TRow>(),
  ai_generations: createEmptyMediaTabCache<TRow>(),
});

export const createMediaTabRequestState = (): MediaTabRequestState => ({
  uploaded_images: 0,
  uploaded_videos: 0,
  private: 0,
  ai_generations: 0,
});

export const createMediaTabBooleanState = (): MediaTabBooleanState => ({
  uploaded_images: false,
  uploaded_videos: false,
  private: false,
  ai_generations: false,
});

export const withMediaTabFilter = <
  T extends {
    eq: (column: string, value: string) => T;
    ilike: (column: string, pattern: string) => T;
    not: (column: string, operator: string, value: string) => T;
    or: (clause: string) => T;
  },
>(
  query: T,
  tab: MediaDataTab
): T => withMediaTabFilterShared(query, tab, { privateMediaSource: PRIVATE_MEDIA_SOURCE });

export const normalizeMediaSearchTerm = normalizeMediaSearchTermShared;

export const withMediaSearchFilter = <T extends { or: (clause: string) => T }>(
  query: T,
  rawSearchTerm: string
): T => withMediaSearchFilterShared(query, rawSearchTerm);

export const withUserScopedPromptQuery = withUserScopedPromptQueryShared;

export const buildCursorFromRows = <T extends { id?: string | null; created_at?: string | null }>(
  rows: T[]
): MediaCursor | null => {
  if (!rows.length) return null;
  const tail = rows[rows.length - 1];
  const id = tail.id ?? "";
  const createdAt = tail.created_at ?? "";
  if (!id || !createdAt) return null;
  return { id, createdAt };
};

const createdAtTime = (value?: string | null): number => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const mergePageRows = <TRow extends { id: string; created_at?: string | null }>(
  current: TRow[],
  incoming: TRow[]
): TRow[] => {
  if (!incoming.length) return current;
  const byId = new Map(current.map((row) => [row.id, row]));
  for (const row of incoming) {
    byId.set(row.id, row);
  }
  return Array.from(byId.values()).sort((a, b) => {
    const createdDelta = createdAtTime(b.created_at) - createdAtTime(a.created_at);
    if (createdDelta !== 0) return createdDelta;
    return b.id.localeCompare(a.id);
  });
};

export const appendCursorPageRows = <TRow extends { id: string }>(
  current: TRow[],
  incoming: TRow[]
): TRow[] => {
  if (!incoming.length) return current;
  if (!current.length) return incoming;

  const indexById = new Map(current.map((row, index) => [row.id, index]));
  let changed = false;
  const nextRows = current.slice();

  for (const row of incoming) {
    const existingIndex = indexById.get(row.id);
    if (existingIndex !== undefined) {
      if (nextRows[existingIndex] !== row) {
        nextRows[existingIndex] = row;
        changed = true;
      }
      continue;
    }
    indexById.set(row.id, nextRows.length);
    nextRows.push(row);
    changed = true;
  }

  return changed ? nextRows : current;
};

export const formatDate = (value?: string | null) => {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

export const sortByCreatedAtDesc = <T extends { created_at?: string | null; id?: string | null }>(
  rows: T[]
): T[] =>
  [...rows].sort((a, b) => {
    const createdDelta = createdAtTime(b.created_at) - createdAtTime(a.created_at);
    if (createdDelta !== 0) return createdDelta;
    return (b.id ?? "").localeCompare(a.id ?? "");
  });

export const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

export const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export const isMissingRelationError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  return "code" in error && (error as { code?: string }).code === "42P01";
};

export const isMissingRoutineError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  return "code" in error && (error as { code?: string }).code === "42883";
};
