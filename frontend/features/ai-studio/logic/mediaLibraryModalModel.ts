import {
  resolveMediaPreviewSignBudget,
  type MediaSignBudget,
} from "../../../lib/mediaPreviewRuntimePolicy";
import {
  buildMediaSearchOrClause as buildMediaSearchOrClauseShared,
  normalizeMediaSearchTerm as normalizeMediaSearchTermShared,
  withMediaSearchFilter as withMediaSearchFilterShared,
  withMediaTabFilter as withMediaTabFilterShared,
  withUserScopedPromptQuery as withUserScopedPromptQueryShared,
} from "../../media-library/logic/mediaQueryModel";

export type MediaFileRow = {
  id: string;
  filename: string;
  storage_path: string;
  preview_storage_path?: string;
  file_type: string;
  width?: number | null;
  height?: number | null;
  source?: string | null;
  created_at?: string | null;
  metadata?: Record<string, unknown> | null;
  thumb_variant_path?: string | null;
  poster_variant_path?: string | null;
  preview_variant_path?: string | null;
  signedUrl?: string | null;
};

export type PromptRow = {
  id: string;
  title: string | null;
  prompt_text: string;
  mode?: string | null;
  model_id?: string | null;
  source?: string | null;
  created_at?: string | null;
};

export type MediaTab =
  | "uploaded_images"
  | "uploaded_videos"
  | "private"
  | "saved_prompts"
  | "ai_generations";

export type MediaDataTab = Exclude<MediaTab, "saved_prompts">;

export type MediaCursor = {
  createdAt: string;
  id: string;
};

export type MediaTabCache = {
  rows: MediaFileRow[];
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
export type MediaCardRefCallback = (node: HTMLButtonElement | null) => void;
export type NavigatorWithConnection = Navigator & {
  connection?: {
    addEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void;
    removeEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void;
  };
};

export const BUCKET = "media_library";
export const PRIVATE_MEDIA_SOURCE = "private_upload";
export const PRIVATE_MEDIA_FOLDER = "private";
export const MEDIA_MODAL_PAGE_SIZE = 36;
export const MEDIA_MODAL_CACHE_TTL_MS = 60_000;
const MEDIA_MODAL_SIGN_SMALL_SCREEN_QUERY = "(max-width: 900px)";
const MEDIA_MODAL_SIGN_BUDGET_DESKTOP: MediaSignBudget = {
  initialSignLimit: 6,
  prefetchWindow: 10,
  signBatchSize: 4,
};
const MEDIA_MODAL_SIGN_BUDGET_SMALL_SCREEN: MediaSignBudget = {
  initialSignLimit: 5,
  prefetchWindow: 8,
  signBatchSize: 3,
};
const MEDIA_MODAL_SIGN_BUDGET_CONSTRAINED: MediaSignBudget = {
  initialSignLimit: 4,
  prefetchWindow: 6,
  signBatchSize: 2,
};
const NEXT_IMAGE_OPTIMIZER_PATH_PATTERN = /(?:^|\/)_next\/image\?/i;

export const isNextImageOptimizerUrl = (value: string | null | undefined): boolean => {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return trimmed.length > 0 && NEXT_IMAGE_OPTIMIZER_PATH_PATTERN.test(trimmed);
};

export const resolveNextImageOptimizerSourceUrl = (
  value: string | null | undefined
): string | null => {
  if (!isNextImageOptimizerUrl(value)) return null;
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed, "https://shortpulse.local");
    const source = parsed.searchParams.get("url");
    const resolved = source?.trim() ?? "";
    return resolved.length > 0 ? resolved : null;
  } catch {
    return null;
  }
};

export const resolveModalSignBudget = (): MediaSignBudget => {
  return resolveMediaPreviewSignBudget({
    desktop: MEDIA_MODAL_SIGN_BUDGET_DESKTOP,
    smallScreen: MEDIA_MODAL_SIGN_BUDGET_SMALL_SCREEN,
    constrained: MEDIA_MODAL_SIGN_BUDGET_CONSTRAINED,
    smallScreenQuery: MEDIA_MODAL_SIGN_SMALL_SCREEN_QUERY,
  });
};

export const isVideoFile = (fileType?: string | null) =>
  (fileType ?? "").toLowerCase().startsWith("video");

export const isPrivateStoragePath = (storagePath?: string | null) =>
  (storagePath ?? "").split("/").filter(Boolean).includes(PRIVATE_MEDIA_FOLDER);

export const isPrivateMediaFile = (file: Pick<MediaFileRow, "source" | "storage_path">) =>
  (file.source ?? "") === PRIVATE_MEDIA_SOURCE || isPrivateStoragePath(file.storage_path);

export const isMediaDataTab = (tab: MediaTab): tab is MediaDataTab => tab !== "saved_prompts";

export const getMediaDataTabForRow = (
  row: Pick<MediaFileRow, "source" | "storage_path" | "file_type">
): MediaDataTab => {
  if (isPrivateMediaFile(row)) return "private";
  if ((row.source ?? "upload") === "ai_studio") return "ai_generations";
  return isVideoFile(row.file_type) ? "uploaded_videos" : "uploaded_images";
};

export const createEmptyMediaTabCache = (): MediaTabCache => ({
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

export const createMediaTabCacheState = (): Record<MediaDataTab, MediaTabCache> => ({
  uploaded_images: createEmptyMediaTabCache(),
  uploaded_videos: createEmptyMediaTabCache(),
  private: createEmptyMediaTabCache(),
  ai_generations: createEmptyMediaTabCache(),
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
  },
>(
  query: T,
  tab: MediaDataTab
): T => withMediaTabFilterShared(query, tab, { privateMediaSource: PRIVATE_MEDIA_SOURCE });

export const normalizeMediaSearchTerm = normalizeMediaSearchTermShared;

export const buildMediaSearchOrClause = buildMediaSearchOrClauseShared;

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

export const mergePageRows = (
  current: MediaFileRow[],
  incoming: MediaFileRow[]
): MediaFileRow[] => {
  if (!incoming.length) return current;
  const byId = new Map(current.map((row) => [row.id, row]));
  for (const row of incoming) {
    byId.set(row.id, row);
  }
  return Array.from(byId.values()).sort((a, b) => {
    const createdDelta = createdAtTime(b.created_at) - createdAtTime(a.created_at);
    if (createdDelta !== 0) return createdDelta;
    return (b.id ?? "").localeCompare(a.id ?? "");
  });
};

export const formatDate = (value?: string | null) => {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export const createdAtTime = (value?: string | null): number => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
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

export const resolveMediaMetadataPromptText = (
  metadata?: Record<string, unknown> | null
): string | null => {
  if (!metadata) return null;
  const prompt =
    typeof metadata.prompt === "string"
      ? metadata.prompt
      : typeof metadata.prompt_text === "string"
        ? metadata.prompt_text
        : typeof metadata.promptText === "string"
          ? metadata.promptText
          : "";
  const trimmed = prompt.trim();
  return trimmed.length > 0 ? trimmed : null;
};
