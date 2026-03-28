/**
 * Shared Media Library runtime store.
 * Normalizes media/prompt entities once so route, modal, and panel adapters can stop cloning full row arrays.
 */
import { MEDIA_DATA_TABS, createEmptyMediaTabCache } from "../logic/mediaLibraryPageHelpers";
import type {
  MediaLibraryMediaRow,
  MediaLibraryOrderedViews,
  MediaLibraryPromptRow,
  MediaLibraryRuntimeState,
  MediaLibrarySelectionState,
  MediaLibrarySurfaceKind,
  MediaLibrarySurfaceState,
  MediaLibraryTabCacheState,
} from "./types";

const createEmptyMediaLibraryTabCacheState = (): MediaLibraryTabCacheState => {
  const cache = createEmptyMediaTabCache<MediaLibraryMediaRow>();
  return {
    nextCursor: cache.nextCursor,
    pagesLoaded: cache.pagesLoaded,
    query: cache.query,
    loadedAtMs: cache.loadedAtMs,
    hasMore: cache.hasMore,
    loading: cache.loading,
    loaded: cache.loaded,
    error: cache.error,
  };
};

const createEmptyOrderedViews = (): MediaLibraryOrderedViews => ({
  mediaIdsByTab: {
    uploaded_images: [],
    uploaded_videos: [],
    private: [],
    ai_generations: [],
  },
  promptIds: [],
});

const createEmptySelectionState = (): MediaLibrarySelectionState => ({
  selectedIds: new Set<string>(),
  focusedMediaId: null,
  focusedPromptId: null,
});

export const createEmptyMediaLibrarySurfaceState = (): MediaLibrarySurfaceState => ({
  cacheByTab: {
    uploaded_images: createEmptyMediaLibraryTabCacheState(),
    uploaded_videos: createEmptyMediaLibraryTabCacheState(),
    private: createEmptyMediaLibraryTabCacheState(),
    ai_generations: createEmptyMediaLibraryTabCacheState(),
  },
  orderedViews: createEmptyOrderedViews(),
  selection: createEmptySelectionState(),
  preview: {
    signedUrlById: {},
    aspectRatioById: {},
    previewErrorById: {},
    visibleIds: new Set<string>(),
  },
  promptsLoaded: false,
  loading: false,
  error: null,
});

export const createMediaLibraryRuntimeState = <
  TMedia extends MediaLibraryMediaRow = MediaLibraryMediaRow,
  TPrompt extends MediaLibraryPromptRow = MediaLibraryPromptRow,
>(): MediaLibraryRuntimeState<TMedia, TPrompt> => ({
  mediaById: {},
  promptById: {},
  surfaceStateByKind: {
    route: createEmptyMediaLibrarySurfaceState(),
    modal: createEmptyMediaLibrarySurfaceState(),
    panel: createEmptyMediaLibrarySurfaceState(),
  },
});

const cloneSurfaceState = (state: MediaLibrarySurfaceState): MediaLibrarySurfaceState => {
  const surface = state;
  return {
    ...surface,
    cacheByTab: { ...surface.cacheByTab },
    orderedViews: {
      mediaIdsByTab: { ...surface.orderedViews.mediaIdsByTab },
      promptIds: [...surface.orderedViews.promptIds],
    },
    selection: {
      ...surface.selection,
      selectedIds: new Set(surface.selection.selectedIds),
    },
    preview: {
      ...surface.preview,
      signedUrlById: { ...surface.preview.signedUrlById },
      aspectRatioById: { ...surface.preview.aspectRatioById },
      previewErrorById: { ...surface.preview.previewErrorById },
      visibleIds: new Set(surface.preview.visibleIds),
    },
  };
};

const areShallowObjectsEqual = (
  left: Record<string, unknown>,
  right: Record<string, unknown>
): boolean => {
  if (left === right) return true;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  for (const key of leftKeys) {
    if (!Object.prototype.hasOwnProperty.call(right, key)) return false;
    if (!Object.is(left[key], right[key])) return false;
  }
  return true;
};

const areOrderedRowsEqual = <TRow extends Record<string, unknown>>(
  left: TRow[],
  right: TRow[]
): boolean => {
  if (left === right) return true;
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (!areShallowObjectsEqual(left[index], right[index])) {
      return false;
    }
  }
  return true;
};

const areTabCacheStatesEqual = (
  left: MediaLibraryTabCacheState,
  right: MediaLibraryTabCacheState
): boolean =>
  left.nextCursor === right.nextCursor &&
  left.pagesLoaded === right.pagesLoaded &&
  left.query === right.query &&
  left.loadedAtMs === right.loadedAtMs &&
  left.hasMore === right.hasMore &&
  left.loading === right.loading &&
  left.loaded === right.loaded &&
  left.error === right.error;

export const replaceSurfaceMediaTabRows = <
  TMedia extends MediaLibraryMediaRow,
  TPrompt extends MediaLibraryPromptRow,
>(
  state: MediaLibraryRuntimeState<TMedia, TPrompt>,
  {
    surface,
    tab,
    rows,
    cache,
  }: {
    surface: MediaLibrarySurfaceKind;
    tab: keyof MediaLibraryOrderedViews["mediaIdsByTab"];
    rows: TMedia[];
    cache?: Partial<MediaLibraryTabCacheState>;
  }
): MediaLibraryRuntimeState<TMedia, TPrompt> => {
  const currentRows = selectSurfaceMediaRows(state, { surface, tab });
  const currentCache = state.surfaceStateByKind[surface].cacheByTab[tab];
  const nextCache = {
    ...currentCache,
    ...cache,
  };
  if (areOrderedRowsEqual(currentRows, rows) && areTabCacheStatesEqual(currentCache, nextCache)) {
    return state;
  }
  const next: MediaLibraryRuntimeState<TMedia, TPrompt> = {
    ...state,
    mediaById: { ...state.mediaById },
    surfaceStateByKind: { ...state.surfaceStateByKind },
  };
  const surfaceState = cloneSurfaceState(state.surfaceStateByKind[surface]);
  for (const row of rows) {
    next.mediaById[row.id] = row;
  }
  surfaceState.orderedViews.mediaIdsByTab[tab] = rows.map((row) => row.id);
  surfaceState.cacheByTab[tab] = nextCache;
  next.surfaceStateByKind[surface] = surfaceState;
  return next;
};

export const replaceSurfacePromptRows = <
  TMedia extends MediaLibraryMediaRow,
  TPrompt extends MediaLibraryPromptRow,
>(
  state: MediaLibraryRuntimeState<TMedia, TPrompt>,
  {
    surface,
    rows,
    promptsLoaded,
  }: {
    surface: MediaLibrarySurfaceKind;
    rows: TPrompt[];
    promptsLoaded?: boolean;
  }
): MediaLibraryRuntimeState<TMedia, TPrompt> => {
  const next: MediaLibraryRuntimeState<TMedia, TPrompt> = {
    ...state,
    promptById: { ...state.promptById },
    surfaceStateByKind: { ...state.surfaceStateByKind },
  };
  const surfaceState = cloneSurfaceState(state.surfaceStateByKind[surface]);
  for (const row of rows) {
    next.promptById[row.id] = row;
  }
  surfaceState.orderedViews.promptIds = rows.map((row) => row.id);
  if (typeof promptsLoaded === "boolean") {
    surfaceState.promptsLoaded = promptsLoaded;
  }
  next.surfaceStateByKind[surface] = surfaceState;
  return next;
};

export const applyMediaSignedUrls = <
  TMedia extends MediaLibraryMediaRow,
  TPrompt extends MediaLibraryPromptRow,
>(
  state: MediaLibraryRuntimeState<TMedia, TPrompt>,
  signedUrlById: Map<string, string>
): MediaLibraryRuntimeState<TMedia, TPrompt> => {
  if (signedUrlById.size === 0) return state;
  const next: MediaLibraryRuntimeState<TMedia, TPrompt> = {
    ...state,
    mediaById: { ...state.mediaById },
    surfaceStateByKind: { ...state.surfaceStateByKind },
  };

  for (const [mediaId, signedUrl] of signedUrlById) {
    const currentRow = next.mediaById[mediaId];
    if (currentRow) {
      next.mediaById[mediaId] = {
        ...currentRow,
        signedUrl,
      };
    }
  }

  for (const surface of ["route", "modal", "panel"] as const) {
    const surfaceState = cloneSurfaceState(state.surfaceStateByKind[surface]);
    let changed = false;
    for (const [mediaId, signedUrl] of signedUrlById) {
      if (surfaceState.preview.signedUrlById[mediaId] === signedUrl) continue;
      surfaceState.preview.signedUrlById[mediaId] = signedUrl;
      changed = true;
    }
    next.surfaceStateByKind[surface] = changed ? surfaceState : state.surfaceStateByKind[surface];
  }

  return next;
};

export const setSurfaceAspectRatio = <
  TMedia extends MediaLibraryMediaRow,
  TPrompt extends MediaLibraryPromptRow,
>(
  state: MediaLibraryRuntimeState<TMedia, TPrompt>,
  {
    surface,
    mediaId,
    aspectRatio,
  }: {
    surface: MediaLibrarySurfaceKind;
    mediaId: string;
    aspectRatio: number;
  }
): MediaLibraryRuntimeState<TMedia, TPrompt> => {
  const current = state.surfaceStateByKind[surface].preview.aspectRatioById[mediaId];
  if (current === aspectRatio) return state;
  const next: MediaLibraryRuntimeState<TMedia, TPrompt> = {
    ...state,
    surfaceStateByKind: { ...state.surfaceStateByKind },
  };
  const surfaceState = cloneSurfaceState(state.surfaceStateByKind[surface]);
  surfaceState.preview.aspectRatioById[mediaId] = aspectRatio;
  next.surfaceStateByKind[surface] = surfaceState;
  return next;
};

export const setSurfaceSignedUrls = <
  TMedia extends MediaLibraryMediaRow,
  TPrompt extends MediaLibraryPromptRow,
>(
  state: MediaLibraryRuntimeState<TMedia, TPrompt>,
  {
    surface,
    signedUrlById,
  }: {
    surface: MediaLibrarySurfaceKind;
    signedUrlById: Map<string, string>;
  }
): MediaLibraryRuntimeState<TMedia, TPrompt> => {
  if (signedUrlById.size === 0) return state;
  let changed = false;
  const next: MediaLibraryRuntimeState<TMedia, TPrompt> = {
    ...state,
    surfaceStateByKind: { ...state.surfaceStateByKind },
  };
  const surfaceState = cloneSurfaceState(state.surfaceStateByKind[surface]);
  for (const [mediaId, signedUrl] of signedUrlById) {
    if (surfaceState.preview.signedUrlById[mediaId] === signedUrl) continue;
    surfaceState.preview.signedUrlById[mediaId] = signedUrl;
    changed = true;
  }
  if (!changed) return state;
  next.surfaceStateByKind[surface] = surfaceState;
  return next;
};

export const setSurfaceSelectedIds = <
  TMedia extends MediaLibraryMediaRow,
  TPrompt extends MediaLibraryPromptRow,
>(
  state: MediaLibraryRuntimeState<TMedia, TPrompt>,
  {
    surface,
    selectedIds,
  }: {
    surface: MediaLibrarySurfaceKind;
    selectedIds: Iterable<string>;
  }
): MediaLibraryRuntimeState<TMedia, TPrompt> => {
  const nextSelectedIds = new Set(selectedIds);
  const currentSelection = state.surfaceStateByKind[surface].selection.selectedIds;
  if (
    currentSelection.size === nextSelectedIds.size &&
    Array.from(nextSelectedIds).every((id) => currentSelection.has(id))
  ) {
    return state;
  }
  const next: MediaLibraryRuntimeState<TMedia, TPrompt> = {
    ...state,
    surfaceStateByKind: { ...state.surfaceStateByKind },
  };
  const surfaceState = cloneSurfaceState(state.surfaceStateByKind[surface]);
  surfaceState.selection.selectedIds = nextSelectedIds;
  next.surfaceStateByKind[surface] = surfaceState;
  return next;
};

export const setSurfacePromptsLoaded = <
  TMedia extends MediaLibraryMediaRow,
  TPrompt extends MediaLibraryPromptRow,
>(
  state: MediaLibraryRuntimeState<TMedia, TPrompt>,
  {
    surface,
    promptsLoaded,
  }: {
    surface: MediaLibrarySurfaceKind;
    promptsLoaded: boolean;
  }
): MediaLibraryRuntimeState<TMedia, TPrompt> => {
  if (state.surfaceStateByKind[surface].promptsLoaded === promptsLoaded) return state;
  const next: MediaLibraryRuntimeState<TMedia, TPrompt> = {
    ...state,
    surfaceStateByKind: { ...state.surfaceStateByKind },
  };
  const surfaceState = cloneSurfaceState(state.surfaceStateByKind[surface]);
  surfaceState.promptsLoaded = promptsLoaded;
  next.surfaceStateByKind[surface] = surfaceState;
  return next;
};

export const selectSurfaceMediaRows = <
  TMedia extends MediaLibraryMediaRow,
  TPrompt extends MediaLibraryPromptRow,
>(
  state: MediaLibraryRuntimeState<TMedia, TPrompt>,
  {
    surface,
    tab,
  }: {
    surface: MediaLibrarySurfaceKind;
    tab: keyof MediaLibraryOrderedViews["mediaIdsByTab"];
  }
): TMedia[] => {
  const surfaceState = state.surfaceStateByKind[surface];
  return surfaceState.orderedViews.mediaIdsByTab[tab]
    .map((id) => {
      const row = state.mediaById[id];
      if (!row) return null;
      const signedUrl = surfaceState.preview.signedUrlById[id];
      if (!signedUrl || row.signedUrl === signedUrl) return row;
      return {
        ...row,
        signedUrl,
      };
    })
    .filter((row): row is TMedia => Boolean(row));
};

export const selectSurfacePromptRows = <
  TMedia extends MediaLibraryMediaRow,
  TPrompt extends MediaLibraryPromptRow,
>(
  state: MediaLibraryRuntimeState<TMedia, TPrompt>,
  surface: MediaLibrarySurfaceKind
): TPrompt[] =>
  state.surfaceStateByKind[surface].orderedViews.promptIds
    .map((id) => state.promptById[id])
    .filter((row): row is TPrompt => Boolean(row));

export const selectSurfaceSelectedIds = <
  TMedia extends MediaLibraryMediaRow,
  TPrompt extends MediaLibraryPromptRow,
>(
  state: MediaLibraryRuntimeState<TMedia, TPrompt>,
  surface: MediaLibrarySurfaceKind
): string[] => Array.from(state.surfaceStateByKind[surface].selection.selectedIds);

export const selectTotalCachedMediaBytes = <
  TMedia extends MediaLibraryMediaRow,
  TPrompt extends MediaLibraryPromptRow,
>(
  state: MediaLibraryRuntimeState<TMedia, TPrompt>
): number => {
  const countedIds = new Set<string>();
  let totalBytes = 0;
  for (const surface of ["route", "modal", "panel"] as const) {
    for (const tab of MEDIA_DATA_TABS) {
      for (const mediaId of state.surfaceStateByKind[surface].orderedViews.mediaIdsByTab[tab]) {
        if (countedIds.has(mediaId)) continue;
        countedIds.add(mediaId);
        totalBytes += state.mediaById[mediaId]?.file_size ?? 0;
      }
    }
  }
  return totalBytes;
};
