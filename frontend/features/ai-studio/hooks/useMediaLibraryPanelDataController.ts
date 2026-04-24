import React from "react";
import {
  fetchMediaListPage,
  type MediaListCursor,
  type MediaListMediaKind,
} from "../../media-library/logic/mediaListApi";
import { shouldAutoLoadNearBottom } from "../../media-library/logic/mediaLoadMoreGating";
import { mergePageRows } from "../../media-library/logic/mediaLibraryPageHelpers";
import { useMediaLibraryPanelRuntime } from "../../media-library/runtime";
import { fetchMediaPromptListPage, type PromptListCursor } from "../logic/mediaLibraryPanelApi";
import { toMediaLibraryErrorText } from "../logic/mediaLibraryErrorText";
import type { MediaFileRow, PromptRow } from "../logic/mediaLibraryModalModel";

type MediaLibraryPanelItemType = "all" | "images" | "videos" | "audio" | "prompts";

type UseMediaLibraryPanelDataControllerParams = {
  projectId?: string | null;
  activeFolderId: string;
  itemType: MediaLibraryPanelItemType;
  normalizedSearch: string;
  shouldShowMedia: boolean;
  shouldShowPrompts: boolean;
  showFolderCanvas: boolean;
  panelBodyRef: React.RefObject<HTMLDivElement | null>;
};

type UseMediaLibraryPanelDataControllerResult = {
  error: string | null;
  mediaRows: MediaFileRow[];
  setMediaRows: React.Dispatch<React.SetStateAction<MediaFileRow[]>>;
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

const MEDIA_PAGE_SIZE = 36;
const PROMPT_PAGE_SIZE = 36;
const INFINITE_LOAD_BOTTOM_THRESHOLD_PX = 220;
const MEDIA_FOLDER_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeRequestFolderId = (folderId: string): string => {
  const normalizedFolderId = folderId.trim();
  if (!normalizedFolderId || normalizedFolderId === "all_items") {
    return "all_items";
  }
  return MEDIA_FOLDER_UUID_PATTERN.test(normalizedFolderId) ? normalizedFolderId : "all_items";
};

const resolveMediaKind = (itemType: MediaLibraryPanelItemType): MediaListMediaKind => {
  if (itemType === "images") return "images";
  if (itemType === "videos") return "videos";
  return "all";
};

const waitForAnimationFrame = async (): Promise<void> => {
  if (typeof window === "undefined") return;
  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
};

export const useMediaLibraryPanelDataController = ({
  projectId = null,
  activeFolderId,
  itemType,
  normalizedSearch,
  shouldShowMedia,
  shouldShowPrompts,
  showFolderCanvas,
  panelBodyRef,
}: UseMediaLibraryPanelDataControllerParams): UseMediaLibraryPanelDataControllerResult => {
  const {
    error,
    mediaRows,
    mediaScopeCache,
    promptRows,
    promptScopeCache,
    setError,
    setMediaRows,
    setMediaScopeCache,
    setPromptRows,
    setPromptScopeCache,
    setSignedUrls,
  } = useMediaLibraryPanelRuntime({ itemType });

  const mediaRequestTokenRef = React.useRef(0);
  const promptRequestTokenRef = React.useRef(0);
  const autoLoadInFlightRef = React.useRef<{ media: boolean; prompts: boolean }>({
    media: false,
    prompts: false,
  });
  const mediaRowsRef = React.useRef<MediaFileRow[]>([]);
  const promptRowsRef = React.useRef<PromptRow[]>([]);
  const mediaCursorRef = React.useRef<MediaListCursor | null>(null);
  const promptCursorRef = React.useRef<PromptListCursor | null>(null);

  const requestFolderId = React.useMemo(
    () => normalizeRequestFolderId(activeFolderId),
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
    promptCursorRef.current = promptScopeCache.nextCursor;
  }, [promptScopeCache.nextCursor]);

  const loadMediaPage = React.useCallback(
    async ({ reset }: { reset: boolean }) => {
      const scopeKey = activeRowsScopeKey;
      const requestToken = mediaRequestTokenRef.current + 1;
      mediaRequestTokenRef.current = requestToken;
      setMediaScopeCache((prev) => ({
        ...prev,
        nextCursor: reset ? null : prev.nextCursor,
        hasMore: reset ? false : prev.hasMore,
        loading: true,
        error: null,
        resolvedScopeKey: reset ? null : prev.resolvedScopeKey,
      }));
      if (reset) {
        setMediaRows([]);
      }
      try {
        const result = await fetchMediaListPage<MediaFileRow>({
          tab: null,
          mediaKind: resolveMediaKind(itemType),
          query: normalizedSearch,
          cursor: reset ? null : mediaCursorRef.current,
          limit: MEDIA_PAGE_SIZE,
          surface: "media-library-panel",
          profile: "expanded",
          folderId: requestFolderId,
          projectId,
          includeLibraryTotalCount: true,
        });
        if (!result) {
          throw new Error("Unable to load media.");
        }
        if (mediaRequestTokenRef.current !== requestToken) return;
        const existingRows = reset ? [] : mediaRowsRef.current;
        const nextRows = mergePageRows(existingRows, result.rows);
        setMediaRows(nextRows);
        setSignedUrls(result.signedById);
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
            typeof result.libraryTotalCount === "number"
              ? result.libraryTotalCount
              : prev.libraryTotalCount,
        }));
        setError(null);
      } catch (loadError) {
        if (mediaRequestTokenRef.current !== requestToken) return;
        const nextError = toMediaLibraryErrorText(loadError, "Unable to load media.");
        setMediaScopeCache((prev) => ({
          ...prev,
          loading: false,
          error: nextError,
        }));
        setError(nextError);
      }
    },
    [
      activeRowsScopeKey,
      itemType,
      normalizedSearch,
      projectId,
      requestFolderId,
      setError,
      setMediaRows,
      setMediaScopeCache,
      setSignedUrls,
    ]
  );

  const loadPromptPage = React.useCallback(
    async ({ reset }: { reset: boolean }) => {
      const scopeKey = activeRowsScopeKey;
      const requestToken = promptRequestTokenRef.current + 1;
      promptRequestTokenRef.current = requestToken;
      setPromptScopeCache((prev) => ({
        ...prev,
        nextCursor: reset ? null : prev.nextCursor,
        hasMore: reset ? false : prev.hasMore,
        loading: true,
        error: null,
        resolvedScopeKey: reset ? null : prev.resolvedScopeKey,
      }));
      if (reset) {
        setPromptRows([]);
      }
      try {
        const result = await fetchMediaPromptListPage({
          folderId: requestFolderId,
          projectId,
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
        const nextRows = mergePageRows(reset ? [] : promptRowsRef.current, normalizedRows);
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
        setError(null);
      } catch (loadError) {
        if (promptRequestTokenRef.current !== requestToken) return;
        const nextError = toMediaLibraryErrorText(loadError, "Unable to load prompts.");
        setPromptScopeCache((prev) => ({
          ...prev,
          loading: false,
          error: nextError,
        }));
        setError(nextError);
      }
    },
    [
      activeRowsScopeKey,
      normalizedSearch,
      projectId,
      requestFolderId,
      setError,
      setPromptRows,
      setPromptScopeCache,
    ]
  );

  React.useEffect(() => {
    if (shouldShowMedia) {
      void loadMediaPage({ reset: true });
    } else {
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
    activeFolderId,
    itemType,
    loadMediaPage,
    loadPromptPage,
    normalizedSearch,
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

    if (shouldShowMedia) {
      await loadMediaPage({ reset: true });
    }
    if (shouldShowPrompts) {
      await loadPromptPage({ reset: true });
    }

    if (!shouldPreserveScroll) return;
    await waitForAnimationFrame();
    await waitForAnimationFrame();
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
        surfaceBlocked: showFolderCanvas,
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
        surfaceBlocked: showFolderCanvas,
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
    showFolderCanvas,
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
