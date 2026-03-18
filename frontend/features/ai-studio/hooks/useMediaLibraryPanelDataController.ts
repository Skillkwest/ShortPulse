import React from "react";
import {
  fetchMediaListPage,
  type MediaListCursor,
  type MediaListMediaKind,
} from "../../media-library/logic/mediaListApi";
import { fetchMediaPromptListPage, type PromptListCursor } from "../logic/mediaLibraryPanelApi";
import { toMediaLibraryErrorText } from "../logic/mediaLibraryErrorText";
import type { MediaFileRow, PromptRow } from "../logic/mediaLibraryModalModel";

type MediaLibraryPanelItemType = "all" | "images" | "videos" | "prompts";

type UseMediaLibraryPanelDataControllerParams = {
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

const resolveMediaKind = (itemType: MediaLibraryPanelItemType): MediaListMediaKind => {
  if (itemType === "images") return "images";
  if (itemType === "videos") return "videos";
  return "all";
};

const createdAtTime = (value: string | null | undefined): number => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const waitForAnimationFrame = async (): Promise<void> => {
  if (typeof window === "undefined") return;
  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
};

export const useMediaLibraryPanelDataController = ({
  activeFolderId,
  itemType,
  normalizedSearch,
  shouldShowMedia,
  shouldShowPrompts,
  showFolderCanvas,
  panelBodyRef,
}: UseMediaLibraryPanelDataControllerParams): UseMediaLibraryPanelDataControllerResult => {
  const [mediaRows, setMediaRows] = React.useState<MediaFileRow[]>([]);
  const [promptRows, setPromptRows] = React.useState<PromptRow[]>([]);
  const [mediaCursor, setMediaCursor] = React.useState<MediaListCursor | null>(null);
  const [promptCursor, setPromptCursor] = React.useState<PromptListCursor | null>(null);
  const [mediaHasMore, setMediaHasMore] = React.useState(false);
  const [promptHasMore, setPromptHasMore] = React.useState(false);
  const [mediaLoading, setMediaLoading] = React.useState(false);
  const [promptLoading, setPromptLoading] = React.useState(false);
  const [resolvedMediaScopeKey, setResolvedMediaScopeKey] = React.useState<string | null>(null);
  const [resolvedPromptScopeKey, setResolvedPromptScopeKey] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

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

  const activeRowsScopeKey = `${activeFolderId}|${itemType}|${normalizedSearch}`;
  const mediaScopeResolved = !shouldShowMedia || resolvedMediaScopeKey === activeRowsScopeKey;
  const promptScopeResolved = !shouldShowPrompts || resolvedPromptScopeKey === activeRowsScopeKey;

  React.useEffect(() => {
    mediaRowsRef.current = mediaRows;
  }, [mediaRows]);

  React.useEffect(() => {
    promptRowsRef.current = promptRows;
  }, [promptRows]);

  React.useEffect(() => {
    mediaCursorRef.current = mediaCursor;
  }, [mediaCursor]);

  React.useEffect(() => {
    promptCursorRef.current = promptCursor;
  }, [promptCursor]);

  const loadMediaPage = React.useCallback(
    async ({ reset }: { reset: boolean }) => {
      const scopeKey = activeRowsScopeKey;
      const requestToken = mediaRequestTokenRef.current + 1;
      mediaRequestTokenRef.current = requestToken;
      setMediaLoading(true);
      if (reset) {
        setMediaRows([]);
        setMediaCursor(null);
        setMediaHasMore(false);
        setResolvedMediaScopeKey(null);
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
          folderId: activeFolderId,
        });
        if (!result) {
          throw new Error("Unable to load media.");
        }
        if (mediaRequestTokenRef.current !== requestToken) return;
        const signedById = result.signedById;
        const rowById = new Map<string, MediaFileRow>();
        const existingRows = reset ? [] : mediaRowsRef.current;
        for (const row of [...existingRows, ...result.rows]) {
          const signedUrl = row.signedUrl || signedById.get(row.id) || null;
          rowById.set(row.id, { ...row, signedUrl });
        }
        const nextRows = Array.from(rowById.values());
        nextRows.sort((left, right) => {
          const createdDelta = createdAtTime(right.created_at) - createdAtTime(left.created_at);
          if (createdDelta !== 0) return createdDelta;
          return right.id.localeCompare(left.id);
        });
        setMediaRows(nextRows);
        setMediaCursor(result.nextCursor);
        setMediaHasMore(result.hasMore);
        setResolvedMediaScopeKey(scopeKey);
        setError(null);
      } catch (loadError) {
        if (mediaRequestTokenRef.current !== requestToken) return;
        setError(toMediaLibraryErrorText(loadError, "Unable to load media."));
      } finally {
        if (mediaRequestTokenRef.current === requestToken) {
          setMediaLoading(false);
        }
      }
    },
    [activeFolderId, activeRowsScopeKey, itemType, normalizedSearch]
  );

  const loadPromptPage = React.useCallback(
    async ({ reset }: { reset: boolean }) => {
      const scopeKey = activeRowsScopeKey;
      const requestToken = promptRequestTokenRef.current + 1;
      promptRequestTokenRef.current = requestToken;
      setPromptLoading(true);
      if (reset) {
        setPromptRows([]);
        setPromptCursor(null);
        setPromptHasMore(false);
        setResolvedPromptScopeKey(null);
      }
      try {
        const result = await fetchMediaPromptListPage({
          folderId: activeFolderId,
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
          : [...promptRowsRef.current, ...normalizedRows].filter(
              (row, index, rows) => rows.findIndex((candidate) => candidate.id === row.id) === index
            );
        setPromptRows(nextRows);
        setPromptCursor(result.nextCursor);
        setPromptHasMore(result.hasMore);
        setResolvedPromptScopeKey(scopeKey);
        setError(null);
      } catch (loadError) {
        if (promptRequestTokenRef.current !== requestToken) return;
        setError(toMediaLibraryErrorText(loadError, "Unable to load prompts."));
      } finally {
        if (promptRequestTokenRef.current === requestToken) {
          setPromptLoading(false);
        }
      }
    },
    [activeFolderId, activeRowsScopeKey, normalizedSearch]
  );

  React.useEffect(() => {
    if (shouldShowMedia) {
      void loadMediaPage({ reset: true });
    } else {
      setMediaRows([]);
      setMediaHasMore(false);
      setMediaCursor(null);
      setResolvedMediaScopeKey(null);
    }
    if (shouldShowPrompts) {
      void loadPromptPage({ reset: true });
    } else {
      setPromptRows([]);
      setPromptHasMore(false);
      setPromptCursor(null);
      setResolvedPromptScopeKey(null);
    }
  }, [
    activeFolderId,
    itemType,
    loadMediaPage,
    loadPromptPage,
    normalizedSearch,
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
    if (!container || showFolderCanvas) return;
    if (container.clientHeight <= 0 || container.scrollHeight <= 0) return;
    const remaining = container.scrollHeight - (container.scrollTop + container.clientHeight);
    if (!Number.isFinite(remaining) || remaining > INFINITE_LOAD_BOTTOM_THRESHOLD_PX) return;

    if (shouldShowMedia && mediaHasMore && !mediaLoading && !autoLoadInFlightRef.current.media) {
      autoLoadInFlightRef.current.media = true;
      void loadMediaPage({ reset: false }).finally(() => {
        autoLoadInFlightRef.current.media = false;
      });
      return;
    }

    if (
      shouldShowPrompts &&
      promptHasMore &&
      !promptLoading &&
      !autoLoadInFlightRef.current.prompts
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
