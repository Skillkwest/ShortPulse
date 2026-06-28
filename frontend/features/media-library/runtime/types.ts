/**
 * Shared Media Library runtime types.
 * Establishes the canonical client-side contracts used by modal and panel adapters.
 */
import type { MediaListProfile } from "../../../lib/mediaListProfile";
import type { MediaPreviewTransformProfile } from "../../../lib/mediaPreviewTransformProfile";
import type { MediaListCursor, MediaListSurface } from "../logic/mediaListApi";
import type {
  MediaDataTab,
  MediaSignBudget,
  MediaTabCache,
} from "../logic/mediaLibraryPageHelpers";

export type MediaLibrarySurfaceKind = "modal" | "panel";

export type MediaLibraryPanelAdapterSurface = Extract<
  MediaListSurface,
  "media-library-panel" | "elements-media-panel" | "character-media-panel"
>;

export type MediaLibraryAdaptiveSurface =
  | "media-library-grid"
  | "media-library-modal-grid"
  | "media-library-panel-grid";

export type MediaLibraryMediaRow = {
  id: string;
  filename: string;
  storage_path: string;
  preview_storage_path?: string | null;
  file_type: string;
  width?: number | null;
  height?: number | null;
  file_size?: number | null;
  source?: string | null;
  source_ref?: string | null;
  prompt_id?: string | null;
  metadata?: Record<string, unknown> | null;
  thumb_variant_path?: string | null;
  poster_variant_path?: string | null;
  preview_variant_path?: string | null;
  companion_art_status?: string | null;
  companion_art_storage_path?: string | null;
  companion_art_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  signedUrl?: string | null;
  status?: "uploading" | "ready";
};

export type MediaLibraryPromptRow = {
  id: string;
  title: string | null;
  prompt_text: string;
  mode?: string | null;
  model_id?: string | null;
  source?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type MediaLibraryEntityMap<TRow extends { id: string }> = Record<string, TRow>;

export type MediaLibraryOrderedViews = {
  mediaIds: string[];
  mediaIdsByTab: Record<MediaDataTab, string[]>;
  promptIds: string[];
};

export type MediaLibrarySelectionState = {
  selectedIds: Set<string>;
  focusedMediaId: string | null;
  focusedPromptId: string | null;
};

export type MediaLibraryPreviewState = {
  signedUrlById: Record<string, string>;
  aspectRatioById: Record<string, number>;
  previewErrorById: Record<string, number>;
  visibleIds: Set<string>;
};

export type MediaLibraryTabCacheState = Omit<MediaTabCache<MediaLibraryMediaRow>, "rows">;

export type MediaLibraryAggregateScopeKind = "media" | "prompts";

export type MediaLibraryAggregateScopeCacheState = {
  nextCursor: MediaListCursor | null;
  pagesLoaded: number;
  hasMore: boolean;
  loading: boolean;
  loaded: boolean;
  error: string | null;
  loadedAtMs: number | null;
  resolvedScopeKey: string | null;
  libraryTotalCount: number | null;
};

export type MediaLibrarySurfaceState = {
  cacheByTab: Record<MediaDataTab, MediaLibraryTabCacheState>;
  aggregateScopeCacheByKind: Record<
    MediaLibraryAggregateScopeKind,
    MediaLibraryAggregateScopeCacheState
  >;
  orderedViews: MediaLibraryOrderedViews;
  selection: MediaLibrarySelectionState;
  preview: MediaLibraryPreviewState;
  promptsLoaded: boolean;
  loading: boolean;
  error: string | null;
};

export type MediaLibraryRuntimeState<
  TMedia extends MediaLibraryMediaRow = MediaLibraryMediaRow,
  TPrompt extends MediaLibraryPromptRow = MediaLibraryPromptRow,
> = {
  mediaById: MediaLibraryEntityMap<TMedia>;
  promptById: MediaLibraryEntityMap<TPrompt>;
  surfaceStateByKind: Record<MediaLibrarySurfaceKind, MediaLibrarySurfaceState>;
};

export type MediaLibrarySurfaceConfig = {
  kind: MediaLibrarySurfaceKind;
  listSurface: MediaListSurface;
  listProfile: MediaListProfile;
  adaptiveSurface: MediaLibraryAdaptiveSurface;
  imageCardPreviewProfile: MediaPreviewTransformProfile;
  pageSize: number;
  cacheTtlMs: number | null;
  loadMoreRootMargin: string;
  visibilityRootMargin: string;
  signBudgetResolver: () => MediaSignBudget;
};
