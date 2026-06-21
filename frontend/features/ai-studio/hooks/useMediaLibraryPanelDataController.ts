import React from "react";
import {
  fetchMediaListPage,
  type MediaListCursor,
  type MediaListSurface,
} from "../../media-library/logic/mediaListApi";
import { shouldAutoLoadNearBottom } from "../../media-library/logic/mediaLoadMoreGating";
import { appendCursorPageRows } from "../../media-library/logic/mediaLibraryPageHelpers";
import {
  getMediaLibrarySurfaceConfig,
  useMediaLibraryPanelRuntime,
} from "../../media-library/runtime";
import {
  normalizeMediaLibraryPanelRequestFolderId,
  resolveMediaLibraryPanelListProfile,
  resolveMediaLibraryPanelMediaKind,
  scheduleMediaLibraryPanelBackgroundCountTask,
  waitForMediaLibraryPanelAnimationFrame,
  type MediaLibraryPanelItemType,
} from "../logic/mediaLibraryPanelDataControllerLogic";
import { fetchMediaPromptListPage, type PromptListCursor } from "../logic/mediaLibraryPanelApi";
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
  mediaScopeResolved: boolean;
  promptScopeResolved: boolean;
  loadMediaPage: ({ reset }: { reset: boolean }) => Promise<void>;
  loadPromptPage: ({ reset }: { reset: boolean }) => Promise<void>;
  refreshActiveRows: () => Promise<void>;
};

const MEDIA_PAGE_SIZE = getMediaLibrarySurfaceConfig("panel").pageSize;
const PROMPT_PAGE_SIZE = MEDIA_PAGE_SIZE;
const INFINITE_LOAD_BOTTOM_THRESHOLD_PX = 220;
const AUDIO_COMPANION_ART_REFRESH_INTERVAL_MS = 3_500;

const isRefreshableAudioCompanionArtRow = (row: MediaFileRow): boolean => {
  if (!row.file_type.toLowerCase().startsWith("audio")) return false;
  if (row.companion_art_status === "pending" || row.companion_art_status === "processing") {
    return true;
  }
  if (row.companion_art_status === "failed") return false;
  return Boolean(row.companion_art_storage_path?.trim() && !row.companion_art_url?.trim());
};

export const useMediaLibraryPanelDataController = ({
  activeFolderId,
  itemType,
  normalizedSearch,
  shouldShowMedia,
  shouldShowPrompts,
  panelBodyRef,
  listSurface = "media-library-panel",
}: UseMediaLibraryPanelDataControllerParams): UseMediaLibraryPanelDataControllerResult => {
  const {
    error: runtimeError,
    mediaRows,
    mediaScopeCache,
    promptRows,
    promptScopeCache,
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
  const mediaRowsRef = React.useRef<MediaFileRow[]>([]);
  const promptRowsRef = React.useRef<PromptRow[]>([]);
  const mediaCursorRef = React.useRef<MediaListCursor | null>(null);
  const promptCursorRef = React.useRef<PromptListCursor | null>(null);
  const mediaScopeCacheRef = React.useRef(mediaScopeCache);
  const promptScopeCacheRef = React.useRef(promptScopeCache);

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
  const mediaScopeResolved =
    !shouldShowMedia || mediaScopeCache.resolvedScopeKey === activeRowsScopeKey;
  const promptScopeResolved =
    !shouldShowPrompts || promptScopeCache.resolvedScopeKey === activeRowsScopeKey;
  const error = mediaScopeCache.error ?? promptScopeCache.error ?? runtimeError;
  const refreshableAudioCompanionArtRefreshKey = React.useMemo(() => {
    if (!shouldShowMedia) return "";
    return mediaRows
      .filter(isRefreshableAudioCompanionArtRow)
      .map((row) => `${row.id}:${row.companion_art_status ?? ""}`)
      .join("|");
  }, [mediaRows, shouldShowMedia]);

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
      setMediaScopeCache((prev) =>
        prev.resolvedScopeKey === scopeKey
          ? {
              ...prev,
              libraryTotalCount: returnedLibraryTotalCount,
            }
          : prev
      );
    },
    [itemType, listSurface, normalizedSearch, requestFolderId, setMediaScopeCache]
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
    async ({ reset }: { reset: boolean }) => {
      const scopeKey = activeRowsScopeKey;
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
      setMediaScopeCache((prev) => ({
        ...prev,
        nextCursor: reset ? null : prev.nextCursor,
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
        setMediaRows(nextRows);
        setSignedUrls(result.signedById);
        const previousLibraryTotalCount = mediaScopeCacheRef.current.libraryTotalCount;
        setMediaScopeCache((prev) => ({
          ...prev,
          nextCursor: result.nextCursor,
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
        setMediaScopeCache((prev) => ({
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
      itemType,
      listSurface,
      normalizedSearch,
      requestFolderId,
      scheduleLibraryTotalCountRefresh,
      setMediaRows,
      setMediaScopeCache,
      setSignedUrls,
    ]
  );

  const loadPromptPage = React.useCallback(
    async ({ reset }: { reset: boolean }) => {
      const scopeKey = activeRowsScopeKey;
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
      setPromptScopeCache((prev) => ({
        ...prev,
        nextCursor: reset ? null : prev.nextCursor,
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
        setPromptScopeCache((prev) => ({
          ...prev,
          nextCursor: result.nextCursor,
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
        setPromptScopeCache((prev) => ({
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
    [activeRowsScopeKey, normalizedSearch, requestFolderId, setPromptRows, setPromptScopeCache]
  );

  React.useEffect(() => {
    if (shouldShowMedia) {
      void loadMediaPage({ reset: true });
    } else {
      cancelLibraryTotalCountRefresh();
      setMediaRows([]);
      setMediaScopeCache((prev) => ({
        ...prev,
        nextCursor: null,
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
      setPromptScopeCache((prev) => ({
        ...prev,
        nextCursor: null,
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
    loadMediaPage,
    loadPromptPage,
    normalizedSearch,
    requestFolderId,
    setMediaRows,
    setMediaScopeCache,
    setPromptRows,
    setPromptScopeCache,
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
      refreshTasks.push(loadMediaPage({ reset: true }));
    }
    if (shouldShowPrompts) {
      refreshTasks.push(loadPromptPage({ reset: true }));
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

  React.useEffect(() => {
    if (!refreshableAudioCompanionArtRefreshKey) return;

    let cancelled = false;
    const refreshPendingAudioCompanionArt = () => {
      if (cancelled || audioCompanionArtRefreshInFlightRef.current) return;
      audioCompanionArtRefreshInFlightRef.current = true;
      void refreshActiveRows().finally(() => {
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
  }, [refreshableAudioCompanionArtRefreshKey, refreshActiveRows]);

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
    mediaScopeResolved,
    promptScopeResolved,
    loadMediaPage,
    loadPromptPage,
    refreshActiveRows,
  };
};
