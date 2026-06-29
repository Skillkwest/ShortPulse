import React from "react";
import {
  fetchMediaListPage,
  type MediaListCursor,
  type MediaListSurface,
} from "../../media-library/logic/mediaListApi";
import {
  subscribeMediaLibraryChanged,
  type MediaLibraryChangedPayload,
} from "../../media-library/logic/mediaLibrarySyncEvents";
import { shouldAutoLoadNearBottom } from "../../media-library/logic/mediaLoadMoreGating";
import { appendCursorPageRows } from "../../media-library/logic/mediaLibraryPageHelpers";
import {
  getMediaLibrarySurfaceConfig,
  useMediaLibraryPanelRuntime,
} from "../../media-library/runtime";
import type { MediaLibraryAggregateScopeCacheState } from "../../media-library/runtime";
import {
  normalizeMediaLibraryPanelRequestFolderId,
  resolveMediaLibraryPanelListProfile,
  resolveMediaLibraryPanelMediaKind,
  scheduleMediaLibraryPanelBackgroundCountTask,
  waitForMediaLibraryPanelAnimationFrame,
  type MediaLibraryPanelItemType,
} from "../logic/mediaLibraryPanelDataControllerLogic";
import {
  AUDIO_COMPANION_ART_STATUS_REFRESH_MAX_ATTEMPTS,
  buildAudioCompanionArtRefreshKey,
  shouldRefreshAudioCompanionArt,
} from "../logic/audioCompanionArtRefreshPolicy";
import {
  fetchMediaPromptListPage,
  MEDIA_LIBRARY_ROOT_FOLDER_ID,
  type PromptListCursor,
} from "../logic/mediaLibraryPanelApi";
import { toMediaLibraryErrorText } from "../logic/mediaLibraryErrorText";
import type { MediaFileRow, PromptRow } from "../logic/mediaLibraryModalModel";

type UseMediaLibraryPanelDataControllerParams = {
  activeFolderId: string;
  itemType: MediaLibraryPanelItemType;
  normalizedSearch: string;
  shouldShowMedia: boolean;
  shouldShowPrompts: boolean;
  panelBodyRef: React.RefObject<HTMLDivElement | null>;
  listSurface?: MediaListSurface;
  currentUserId?: string | null;
};

type UseMediaLibraryPanelDataControllerResult = {
  error: string | null;
  mediaRows: MediaFileRow[];
  setMediaRows: React.Dispatch<React.SetStateAction<MediaFileRow[]>>;
  setSignedUrls: (signedUrlById: Map<string, string>) => void;
  libraryTotalCount: number | null;
  promptRows: PromptRow[];
  setPromptRows: React.Dispatch<React.SetStateAction<PromptRow[]>>;
  mediaHasMore: boolean;
  promptHasMore: boolean;
  mediaLoading: boolean;
  promptLoading: boolean;
  mediaPagesLoaded: number;
  mediaScopeResolved: boolean;
  promptScopeResolved: boolean;
  loadMediaPage: (options: LoadPanelPageOptions) => Promise<void>;
  loadPromptPage: (options: LoadPanelPageOptions) => Promise<void>;
  refreshActiveRows: () => Promise<void>;
};

type LoadPanelPageOptions = { reset: boolean; force?: boolean };

const PANEL_SURFACE_CONFIG = getMediaLibrarySurfaceConfig("panel");
const MEDIA_PAGE_SIZE = PANEL_SURFACE_CONFIG.pageSize;
const PANEL_CACHE_TTL_MS = PANEL_SURFACE_CONFIG.cacheTtlMs;
const PROMPT_PAGE_SIZE = MEDIA_PAGE_SIZE;
const INFINITE_LOAD_BOTTOM_THRESHOLD_PX = 220;
const AUDIO_COMPANION_ART_REFRESH_INTERVAL_MS = 3_500;
const EXTERNAL_LIBRARY_REFRESH_DEBOUNCE_MS = 400;
const EXTERNAL_LIBRARY_REFRESH_MAX_WAIT_MS = 2_000;

const isDocumentVisible = (): boolean =>
  typeof document === "undefined" || document.visibilityState === "visible";

const isRefreshableAudioCompanionArtRow = (
  row: MediaFileRow,
  statusRefreshAttempts = 0
): boolean => {
  if (!row.file_type.toLowerCase().startsWith("audio")) return false;
  return shouldRefreshAudioCompanionArt({
    candidate: {
      companionArtStatus: row.companion_art_status,
      companionArtStoragePath: row.companion_art_storage_path,
      companionArtUrl: row.companion_art_url,
    },
    statusRefreshAttempts,
  });
};

const buildPanelAudioCompanionArtRefreshKey = (row: MediaFileRow): string =>
  buildAudioCompanionArtRefreshKey({
    id: row.id,
    status: row.companion_art_status,
    storagePath: row.companion_art_storage_path,
    url: row.companion_art_url,
  });

const isPanelScopeCacheFresh = ({
  cache,
  scopeKey,
  nowMs,
}: {
  cache: MediaLibraryAggregateScopeCacheState;
  scopeKey: string;
  nowMs: number;
}): boolean => {
  if (typeof PANEL_CACHE_TTL_MS !== "number" || PANEL_CACHE_TTL_MS <= 0) return false;
  if (!cache.loaded || cache.loading || cache.error !== null) return false;
  if (cache.resolvedScopeKey !== scopeKey || cache.loadedAtMs === null) return false;
  return nowMs - cache.loadedAtMs <= PANEL_CACHE_TTL_MS;
};

export const useMediaLibraryPanelDataController = ({
  activeFolderId,
  itemType,
  normalizedSearch,
  shouldShowMedia,
  shouldShowPrompts,
  panelBodyRef,
  listSurface = "media-library-panel",
  currentUserId = null,
}: UseMediaLibraryPanelDataControllerParams): UseMediaLibraryPanelDataControllerResult => {
  const {
    error: runtimeError,
    mediaRows,
    mediaScopeCache,
    promptRows,
    promptScopeCache,
    appendMediaRows,
    setMediaRows,
    setMediaScopeCache,
    setPromptRows,
    setPromptScopeCache,
    setSignedUrls,
  } = useMediaLibraryPanelRuntime({ itemType });

  const mediaRequestTokenRef = React.useRef(0);
  const libraryTotalCountRequestTokenRef = React.useRef(0);
  const cancelLibraryTotalCountRefreshRef = React.useRef<(() => void) | null>(null);
  const promptRequestTokenRef = React.useRef(0);
  const autoLoadInFlightRef = React.useRef<{ media: boolean; prompts: boolean }>({
    media: false,
    prompts: false,
  });
  const appendRequestInFlightRef = React.useRef<{ media: boolean; prompts: boolean }>({
    media: false,
    prompts: false,
  });
  const audioCompanionArtRefreshInFlightRef = React.useRef(false);
  const audioCompanionArtRefreshAttemptByKeyRef = React.useRef<Map<string, number>>(new Map());
  const mediaRowsRef = React.useRef<MediaFileRow[]>([]);
  const promptRowsRef = React.useRef<PromptRow[]>([]);
  const mediaCursorRef = React.useRef<MediaListCursor | null>(null);
  const promptCursorRef = React.useRef<PromptListCursor | null>(null);
  const mediaScopeCacheRef = React.useRef(mediaScopeCache);
  const promptScopeCacheRef = React.useRef(promptScopeCache);
  const externalLibraryRefreshStateRef = React.useRef<{
    debounceTimer: ReturnType<typeof globalThis.setTimeout> | null;
    maxWaitTimer: ReturnType<typeof globalThis.setTimeout> | null;
    refreshInFlight: boolean;
    dirty: boolean;
  }>({
    debounceTimer: null,
    maxWaitTimer: null,
    refreshInFlight: false,
    dirty: false,
  });
  const [audioCompanionArtRefreshAttemptVersion, setAudioCompanionArtRefreshAttemptVersion] =
    React.useState(0);
  const [documentVisible, setDocumentVisible] = React.useState(isDocumentVisible);

  const requestFolderId = React.useMemo(
    () => normalizeMediaLibraryPanelRequestFolderId(activeFolderId),
    [activeFolderId]
  );
  const activeRowsScopeKey = `${requestFolderId}|${itemType}|${normalizedSearch}`;
  const libraryTotalCount = mediaScopeCache.libraryTotalCount;
  const mediaHasMore = mediaScopeCache.hasMore;
  const promptHasMore = promptScopeCache.hasMore;
  const mediaLoading = mediaScopeCache.loading;
  const promptLoading = promptScopeCache.loading;
  const mediaPagesLoaded = mediaScopeCache.pagesLoaded;
  const mediaScopeResolved =
    !shouldShowMedia || mediaScopeCache.resolvedScopeKey === activeRowsScopeKey;
  const promptScopeResolved =
    !shouldShowPrompts || promptScopeCache.resolvedScopeKey === activeRowsScopeKey;
  const error = mediaScopeCache.error ?? promptScopeCache.error ?? runtimeError;
  const refreshableAudioCompanionArtRefreshKey = React.useMemo(() => {
    void audioCompanionArtRefreshAttemptVersion;
    if (!shouldShowMedia) return "";
    return mediaRows
      .filter((row) =>
        isRefreshableAudioCompanionArtRow(
          row,
          audioCompanionArtRefreshAttemptByKeyRef.current.get(
            buildPanelAudioCompanionArtRefreshKey(row)
          ) ?? 0
        )
      )
      .map(buildPanelAudioCompanionArtRefreshKey)
      .join("|");
  }, [audioCompanionArtRefreshAttemptVersion, mediaRows, shouldShowMedia]);

  React.useEffect(() => {
    mediaRowsRef.current = mediaRows;
  }, [mediaRows]);

  React.useEffect(() => {
    promptRowsRef.current = promptRows;
  }, [promptRows]);

  React.useEffect(() => {
    mediaCursorRef.current = mediaScopeCache.nextCursor;
  }, [mediaScopeCache.nextCursor]);

  React.useEffect(() => {
    mediaScopeCacheRef.current = mediaScopeCache;
  }, [mediaScopeCache]);

  React.useEffect(() => {
    promptCursorRef.current = promptScopeCache.nextCursor;
  }, [promptScopeCache.nextCursor]);

  React.useEffect(() => {
    promptScopeCacheRef.current = promptScopeCache;
  }, [promptScopeCache]);

  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const updateDocumentVisible = () => {
      setDocumentVisible(isDocumentVisible());
    };
    updateDocumentVisible();
    document.addEventListener("visibilitychange", updateDocumentVisible);
    return () => {
      document.removeEventListener("visibilitychange", updateDocumentVisible);
    };
  }, []);

  const commitMediaScopeCache = React.useCallback(
    (updater: React.SetStateAction<MediaLibraryAggregateScopeCacheState>) => {
      setMediaScopeCache((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        mediaScopeCacheRef.current = next;
        return next;
      });
    },
    [setMediaScopeCache]
  );

  const commitPromptScopeCache = React.useCallback(
    (updater: React.SetStateAction<MediaLibraryAggregateScopeCacheState>) => {
      setPromptScopeCache((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        promptScopeCacheRef.current = next;
        return next;
      });
    },
    [setPromptScopeCache]
  );

  const shouldRefreshLibraryTotalCount =
    requestFolderId === "all_items" && normalizedSearch.length === 0;

  const cancelLibraryTotalCountRefresh = React.useCallback(() => {
    cancelLibraryTotalCountRefreshRef.current?.();
    cancelLibraryTotalCountRefreshRef.current = null;
  }, []);

  const refreshLibraryTotalCount = React.useCallback(
    async ({ scopeKey }: { scopeKey: string }) => {
      const requestToken = libraryTotalCountRequestTokenRef.current + 1;
      libraryTotalCountRequestTokenRef.current = requestToken;
      const result = await fetchMediaListPage<MediaFileRow>({
        tab: null,
        mediaKind: resolveMediaLibraryPanelMediaKind(itemType),
        query: normalizedSearch,
        cursor: null,
        limit: 1,
        surface: listSurface,
        profile: "minimal",
        folderId: requestFolderId,
        includeLibraryTotalCount: true,
        countOnly: true,
      });
      if (libraryTotalCountRequestTokenRef.current !== requestToken) return;
      const returnedLibraryTotalCount =
        typeof result?.libraryTotalCount === "number" ? result.libraryTotalCount : null;
      if (returnedLibraryTotalCount === null) return;
      commitMediaScopeCache((prev) =>
        prev.resolvedScopeKey === scopeKey
          ? {
              ...prev,
              libraryTotalCount: returnedLibraryTotalCount,
            }
          : prev
      );
    },
    [commitMediaScopeCache, itemType, listSurface, normalizedSearch, requestFolderId]
  );

  const scheduleLibraryTotalCountRefresh = React.useCallback(
    ({ scopeKey }: { scopeKey: string }) => {
      if (!shouldRefreshLibraryTotalCount) return;
      cancelLibraryTotalCountRefresh();
      cancelLibraryTotalCountRefreshRef.current = scheduleMediaLibraryPanelBackgroundCountTask(
        () => {
          cancelLibraryTotalCountRefreshRef.current = null;
          void refreshLibraryTotalCount({ scopeKey }).catch(() => {
            // Count badges are non-critical; the visible media grid should remain uninterrupted.
          });
        }
      );
    },
    [cancelLibraryTotalCountRefresh, refreshLibraryTotalCount, shouldRefreshLibraryTotalCount]
  );

  React.useEffect(() => cancelLibraryTotalCountRefresh, [cancelLibraryTotalCountRefresh]);

  const loadMediaPage = React.useCallback(
    async ({ reset, force = false }: LoadPanelPageOptions) => {
      const scopeKey = activeRowsScopeKey;
      if (
        reset &&
        !force &&
        isPanelScopeCacheFresh({
          cache: mediaScopeCacheRef.current,
          scopeKey,
          nowMs: Date.now(),
        })
      ) {
        return;
      }
      if (reset) {
        cancelLibraryTotalCountRefresh();
      }
      if (!reset && appendRequestInFlightRef.current.media) {
        return;
      }
      if (!reset) {
        appendRequestInFlightRef.current.media = true;
      }
      const requestToken = mediaRequestTokenRef.current + 1;
      mediaRequestTokenRef.current = requestToken;
      const shouldPreserveRowsDuringRefresh =
        reset && mediaScopeCacheRef.current.resolvedScopeKey === scopeKey;
      commitMediaScopeCache((prev) => ({
        ...prev,
        nextCursor: reset ? null : prev.nextCursor,
        pagesLoaded: reset && !shouldPreserveRowsDuringRefresh ? 0 : prev.pagesLoaded,
        hasMore: prev.hasMore,
        loading: true,
        error: null,
        resolvedScopeKey: reset && !shouldPreserveRowsDuringRefresh ? null : prev.resolvedScopeKey,
      }));
      if (reset && !shouldPreserveRowsDuringRefresh) {
        setMediaRows([]);
      }
      try {
        const result = await fetchMediaListPage<MediaFileRow>({
          tab: null,
          mediaKind: resolveMediaLibraryPanelMediaKind(itemType),
          query: normalizedSearch,
          cursor: reset ? null : mediaCursorRef.current,
          limit: MEDIA_PAGE_SIZE,
          surface: listSurface,
          profile: resolveMediaLibraryPanelListProfile(itemType),
          folderId: requestFolderId,
          includeLibraryTotalCount: false,
        });
        if (!result) {
          throw new Error("Unable to load media.");
        }
        if (mediaRequestTokenRef.current !== requestToken) return;
        const nextRows = reset
          ? result.rows
          : appendCursorPageRows(mediaRowsRef.current, result.rows);
        const derivedLibraryTotalCount = result.hasMore ? null : nextRows.length;
        const returnedLibraryTotalCount =
          typeof result.libraryTotalCount === "number" ? result.libraryTotalCount : null;
        if (reset) {
          setMediaRows(nextRows);
        } else {
          appendMediaRows(result.rows);
        }
        setSignedUrls(result.signedById);
        const previousLibraryTotalCount = mediaScopeCacheRef.current.libraryTotalCount;
        commitMediaScopeCache((prev) => ({
          ...prev,
          nextCursor: result.nextCursor,
          pagesLoaded: reset
            ? result.rows.length > 0
              ? 1
              : 0
            : prev.pagesLoaded + (result.rows.length > 0 ? 1 : 0),
          hasMore: result.hasMore,
          loading: false,
          loaded: true,
          error: null,
          loadedAtMs: Date.now(),
          resolvedScopeKey: scopeKey,
          libraryTotalCount:
            returnedLibraryTotalCount ??
            previousLibraryTotalCount ??
            derivedLibraryTotalCount ??
            prev.libraryTotalCount,
        }));
        if (reset && result.hasMore && returnedLibraryTotalCount === null) {
          scheduleLibraryTotalCountRefresh({ scopeKey });
        }
      } catch (loadError) {
        if (mediaRequestTokenRef.current !== requestToken) return;
        const nextError = toMediaLibraryErrorText(loadError, "Unable to load media.");
        commitMediaScopeCache((prev) => ({
          ...prev,
          loading: false,
          error: nextError,
        }));
      } finally {
        if (!reset) {
          appendRequestInFlightRef.current.media = false;
        }
      }
    },
    [
      activeRowsScopeKey,
      cancelLibraryTotalCountRefresh,
      commitMediaScopeCache,
      itemType,
      listSurface,
      normalizedSearch,
      requestFolderId,
      scheduleLibraryTotalCountRefresh,
      appendMediaRows,
      setMediaRows,
      setSignedUrls,
    ]
  );

  const loadPromptPage = React.useCallback(
    async ({ reset, force = false }: LoadPanelPageOptions) => {
      const scopeKey = activeRowsScopeKey;
      if (
        reset &&
        !force &&
        isPanelScopeCacheFresh({
          cache: promptScopeCacheRef.current,
          scopeKey,
          nowMs: Date.now(),
        })
      ) {
        return;
      }
      if (!reset && appendRequestInFlightRef.current.prompts) {
        return;
      }
      if (!reset) {
        appendRequestInFlightRef.current.prompts = true;
      }
      const requestToken = promptRequestTokenRef.current + 1;
      promptRequestTokenRef.current = requestToken;
      const shouldPreserveRowsDuringRefresh =
        reset && promptScopeCacheRef.current.resolvedScopeKey === scopeKey;
      commitPromptScopeCache((prev) => ({
        ...prev,
        nextCursor: reset ? null : prev.nextCursor,
        pagesLoaded: reset && !shouldPreserveRowsDuringRefresh ? 0 : prev.pagesLoaded,
        hasMore: prev.hasMore,
        loading: true,
        error: null,
        resolvedScopeKey: reset && !shouldPreserveRowsDuringRefresh ? null : prev.resolvedScopeKey,
      }));
      if (reset && !shouldPreserveRowsDuringRefresh) {
        setPromptRows([]);
      }
      try {
        const result = await fetchMediaPromptListPage({
          folderId: requestFolderId,
          query: normalizedSearch,
          cursor: reset ? null : promptCursorRef.current,
          limit: PROMPT_PAGE_SIZE,
        });
        if (promptRequestTokenRef.current !== requestToken) return;
        const normalizedRows: PromptRow[] = result.rows.map((row) => ({
          id: row.id,
          title: row.title,
          prompt_text: row.prompt_text,
          mode: row.mode,
          source: row.source,
          created_at: row.created_at,
        }));
        const nextRows = reset
          ? normalizedRows
          : appendCursorPageRows(promptRowsRef.current, normalizedRows);
        setPromptRows(nextRows);
        commitPromptScopeCache((prev) => ({
          ...prev,
          nextCursor: result.nextCursor,
          pagesLoaded: reset
            ? normalizedRows.length > 0
              ? 1
              : 0
            : prev.pagesLoaded + (normalizedRows.length > 0 ? 1 : 0),
          hasMore: result.hasMore,
          loading: false,
          loaded: true,
          error: null,
          loadedAtMs: Date.now(),
          resolvedScopeKey: scopeKey,
        }));
      } catch (loadError) {
        if (promptRequestTokenRef.current !== requestToken) return;
        const nextError = toMediaLibraryErrorText(loadError, "Unable to load prompts.");
        commitPromptScopeCache((prev) => ({
          ...prev,
          loading: false,
          error: nextError,
        }));
      } finally {
        if (!reset) {
          appendRequestInFlightRef.current.prompts = false;
        }
      }
    },
    [activeRowsScopeKey, commitPromptScopeCache, normalizedSearch, requestFolderId, setPromptRows]
  );

  React.useEffect(() => {
    if (shouldShowMedia) {
      void loadMediaPage({ reset: true });
    } else {
      cancelLibraryTotalCountRefresh();
      setMediaRows([]);
      commitMediaScopeCache((prev) => ({
        ...prev,
        nextCursor: null,
        pagesLoaded: 0,
        hasMore: false,
        loading: false,
        loaded: false,
        error: null,
        loadedAtMs: null,
        resolvedScopeKey: null,
      }));
    }
    if (shouldShowPrompts) {
      void loadPromptPage({ reset: true });
    } else {
      setPromptRows([]);
      commitPromptScopeCache((prev) => ({
        ...prev,
        nextCursor: null,
        pagesLoaded: 0,
        hasMore: false,
        loading: false,
        loaded: false,
        error: null,
        loadedAtMs: null,
        resolvedScopeKey: null,
      }));
    }
  }, [
    itemType,
    cancelLibraryTotalCountRefresh,
    commitMediaScopeCache,
    commitPromptScopeCache,
    loadMediaPage,
    loadPromptPage,
    normalizedSearch,
    requestFolderId,
    setMediaRows,
    setPromptRows,
    shouldShowMedia,
    shouldShowPrompts,
  ]);

  const refreshActiveRows = React.useCallback(async () => {
    const container = panelBodyRef.current;
    const shouldPreserveScroll = Boolean(container);
    const previousScrollTop = container?.scrollTop ?? 0;
    const previousBottomGap = container
      ? Math.max(0, container.scrollHeight - (container.scrollTop + container.clientHeight))
      : 0;
    const wasNearBottom =
      shouldPreserveScroll && previousBottomGap <= INFINITE_LOAD_BOTTOM_THRESHOLD_PX;

    const refreshTasks: Promise<void>[] = [];
    if (shouldShowMedia) {
      refreshTasks.push(loadMediaPage({ reset: true, force: true }));
    }
    if (shouldShowPrompts) {
      refreshTasks.push(loadPromptPage({ reset: true, force: true }));
    }
    if (refreshTasks.length > 0) {
      await Promise.all(refreshTasks);
    }

    if (!shouldPreserveScroll) return;
    await waitForMediaLibraryPanelAnimationFrame();
    await waitForMediaLibraryPanelAnimationFrame();
    const nextContainer = panelBodyRef.current;
    if (!nextContainer) return;
    const nextMaxTop = Math.max(0, nextContainer.scrollHeight - nextContainer.clientHeight);
    if (wasNearBottom) {
      const nextTop = Math.max(
        0,
        nextContainer.scrollHeight - nextContainer.clientHeight - previousBottomGap
      );
      nextContainer.scrollTop = Math.min(nextTop, nextMaxTop);
      return;
    }
    nextContainer.scrollTop = Math.min(Math.max(previousScrollTop, 0), nextMaxTop);
  }, [loadMediaPage, loadPromptPage, panelBodyRef, shouldShowMedia, shouldShowPrompts]);

  const refreshActiveRowsRef = React.useRef(refreshActiveRows);

  React.useEffect(() => {
    refreshActiveRowsRef.current = refreshActiveRows;
  }, [refreshActiveRows]);

  const shouldRefreshForExternalLibraryChange = React.useCallback(
    (payload: MediaLibraryChangedPayload): boolean => {
      const mediaChanged = payload.mediaFileIds.length > 0;
      const promptsChanged = payload.promptIds.length > 0;
      const unknownKindChanged = !mediaChanged && !promptsChanged;
      const affectsVisibleRows =
        unknownKindChanged ||
        (mediaChanged && shouldShowMedia) ||
        (promptsChanged && shouldShowPrompts);
      if (!affectsVisibleRows) return false;
      if (requestFolderId === MEDIA_LIBRARY_ROOT_FOLDER_ID) return true;
      return payload.folderIds.includes(requestFolderId);
    },
    [requestFolderId, shouldShowMedia, shouldShowPrompts]
  );

  const shouldRefreshForExternalLibraryChangeRef = React.useRef(
    shouldRefreshForExternalLibraryChange
  );

  React.useEffect(() => {
    shouldRefreshForExternalLibraryChangeRef.current = shouldRefreshForExternalLibraryChange;
  }, [shouldRefreshForExternalLibraryChange]);

  React.useEffect(() => {
    let cancelled = false;

    const clearTimers = () => {
      const state = externalLibraryRefreshStateRef.current;
      if (state.debounceTimer !== null) {
        globalThis.clearTimeout(state.debounceTimer);
        state.debounceTimer = null;
      }
      if (state.maxWaitTimer !== null) {
        globalThis.clearTimeout(state.maxWaitTimer);
        state.maxWaitTimer = null;
      }
    };

    const scheduleRefresh = () => {
      if (cancelled) return;
      const state = externalLibraryRefreshStateRef.current;
      state.dirty = true;
      if (state.debounceTimer !== null) {
        globalThis.clearTimeout(state.debounceTimer);
      }
      state.debounceTimer = globalThis.setTimeout(runRefresh, EXTERNAL_LIBRARY_REFRESH_DEBOUNCE_MS);
      if (state.maxWaitTimer === null) {
        state.maxWaitTimer = globalThis.setTimeout(
          runRefresh,
          EXTERNAL_LIBRARY_REFRESH_MAX_WAIT_MS
        );
      }
    };

    const finishRefresh = () => {
      const state = externalLibraryRefreshStateRef.current;
      state.refreshInFlight = false;
      if (!state.dirty || cancelled) return;
      scheduleRefresh();
    };

    function runRefresh() {
      const state = externalLibraryRefreshStateRef.current;
      clearTimers();
      if (cancelled) return;
      if (state.refreshInFlight) {
        state.dirty = true;
        return;
      }
      state.dirty = false;
      state.refreshInFlight = true;
      void refreshActiveRowsRef.current().finally(finishRefresh);
    }

    const unsubscribe = subscribeMediaLibraryChanged(
      (payload) => {
        if (!shouldRefreshForExternalLibraryChangeRef.current(payload)) return;
        scheduleRefresh();
      },
      currentUserId ? { userId: currentUserId } : undefined
    );

    return () => {
      cancelled = true;
      clearTimers();
      unsubscribe();
    };
  }, [currentUserId]);

  const refreshAudioCompanionArtRows = React.useCallback(async () => {
    const scopeKey = activeRowsScopeKey;
    const refreshableRows = mediaRowsRef.current.filter((row) =>
      isRefreshableAudioCompanionArtRow(
        row,
        audioCompanionArtRefreshAttemptByKeyRef.current.get(
          buildPanelAudioCompanionArtRefreshKey(row)
        ) ?? 0
      )
    );
    const refreshableIds = new Set(refreshableRows.map((row) => row.id));
    if (!refreshableIds.size) return;

    try {
      const result = await fetchMediaListPage<MediaFileRow>({
        tab: null,
        mediaKind: "audio",
        query: normalizedSearch,
        cursor: null,
        limit: MEDIA_PAGE_SIZE,
        surface: listSurface,
        profile: resolveMediaLibraryPanelListProfile("audio"),
        folderId: requestFolderId,
        includeLibraryTotalCount: false,
      });
      if (!result || mediaScopeCacheRef.current.resolvedScopeKey !== scopeKey) return;
      const refreshedRows = result.rows.filter((row) => refreshableIds.has(row.id));
      const refreshedById = new Map(refreshedRows.map((row) => [row.id, row]));
      let exhaustedStatusOnlyRefresh = false;
      refreshableRows.forEach((row) => {
        const refreshKey = buildPanelAudioCompanionArtRefreshKey(row);
        const requiresSignedUrl = Boolean(
          row.companion_art_storage_path?.trim() && !row.companion_art_url?.trim()
        );
        const refreshedRow = refreshedById.get(row.id);
        const refreshedStillNeedsStatusPolling =
          refreshedRow &&
          isRefreshableAudioCompanionArtRow(refreshedRow) &&
          !refreshedRow.companion_art_storage_path?.trim();
        if (requiresSignedUrl || (refreshedRow && !refreshedStillNeedsStatusPolling)) {
          audioCompanionArtRefreshAttemptByKeyRef.current.delete(refreshKey);
          return;
        }
        const nextAttempt =
          (audioCompanionArtRefreshAttemptByKeyRef.current.get(refreshKey) ?? 0) + 1;
        audioCompanionArtRefreshAttemptByKeyRef.current.set(refreshKey, nextAttempt);
        if (nextAttempt >= AUDIO_COMPANION_ART_STATUS_REFRESH_MAX_ATTEMPTS) {
          exhaustedStatusOnlyRefresh = true;
        }
      });
      if (exhaustedStatusOnlyRefresh) {
        setAudioCompanionArtRefreshAttemptVersion((version) => version + 1);
      }
      if (!refreshedRows.length) return;
      appendMediaRows(refreshedRows);
      setSignedUrls(result.signedById);
    } catch {
      // Companion art is decorative; keep the loaded media list stable if polling fails.
    }
  }, [
    activeRowsScopeKey,
    appendMediaRows,
    listSurface,
    normalizedSearch,
    requestFolderId,
    setSignedUrls,
  ]);

  React.useEffect(() => {
    if (!refreshableAudioCompanionArtRefreshKey) return;
    if (!documentVisible) return;

    let cancelled = false;
    const refreshPendingAudioCompanionArt = () => {
      if (cancelled || audioCompanionArtRefreshInFlightRef.current) return;
      audioCompanionArtRefreshInFlightRef.current = true;
      void refreshAudioCompanionArtRows().finally(() => {
        audioCompanionArtRefreshInFlightRef.current = false;
      });
    };

    const intervalId = globalThis.setInterval(
      refreshPendingAudioCompanionArt,
      AUDIO_COMPANION_ART_REFRESH_INTERVAL_MS
    );
    refreshPendingAudioCompanionArt();

    return () => {
      cancelled = true;
      globalThis.clearInterval(intervalId);
    };
  }, [documentVisible, refreshableAudioCompanionArtRefreshKey, refreshAudioCompanionArtRows]);

  const maybeAutoLoadMore = React.useCallback(() => {
    const container = panelBodyRef.current;
    if (!container) return;

    if (
      shouldShowMedia &&
      shouldAutoLoadNearBottom({
        clientHeight: container.clientHeight,
        hasMore: mediaHasMore,
        inFlight: autoLoadInFlightRef.current.media,
        loading: mediaLoading,
        scrollHeight: container.scrollHeight,
        scrollTop: container.scrollTop,
        surfaceBlocked: false,
        thresholdPx: INFINITE_LOAD_BOTTOM_THRESHOLD_PX,
      })
    ) {
      autoLoadInFlightRef.current.media = true;
      void loadMediaPage({ reset: false }).finally(() => {
        autoLoadInFlightRef.current.media = false;
      });
      return;
    }

    if (
      shouldShowPrompts &&
      shouldAutoLoadNearBottom({
        clientHeight: container.clientHeight,
        hasMore: promptHasMore,
        inFlight: autoLoadInFlightRef.current.prompts,
        loading: promptLoading,
        scrollHeight: container.scrollHeight,
        scrollTop: container.scrollTop,
        surfaceBlocked: false,
        thresholdPx: INFINITE_LOAD_BOTTOM_THRESHOLD_PX,
      })
    ) {
      autoLoadInFlightRef.current.prompts = true;
      void loadPromptPage({ reset: false }).finally(() => {
        autoLoadInFlightRef.current.prompts = false;
      });
    }
  }, [
    loadMediaPage,
    loadPromptPage,
    mediaHasMore,
    mediaLoading,
    panelBodyRef,
    promptHasMore,
    promptLoading,
    shouldShowMedia,
    shouldShowPrompts,
  ]);

  React.useEffect(() => {
    const container = panelBodyRef.current;
    if (!container) return;
    let rafId = 0;
    const onScroll = () => {
      if (rafId !== 0) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        maybeAutoLoadMore();
      });
    };
    container.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      container.removeEventListener("scroll", onScroll);
      if (rafId !== 0) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [maybeAutoLoadMore, panelBodyRef]);

  return {
    error,
    mediaRows,
    setMediaRows,
    setSignedUrls,
    libraryTotalCount,
    promptRows,
    setPromptRows,
    mediaHasMore,
    promptHasMore,
    mediaLoading,
    promptLoading,
    mediaPagesLoaded,
    mediaScopeResolved,
    promptScopeResolved,
    loadMediaPage,
    loadPromptPage,
    refreshActiveRows,
  };
};
