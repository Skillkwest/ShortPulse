/**
 * Transitional route adapter for the shared Media Library runtime store.
 * Keeps current route hooks working while moving rows, cache metadata, and aspect ratios under the shared runtime substrate.
 */
import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { MediaDataTab, MediaTabCache } from "../logic/mediaLibraryPageHelpers";
import {
  createMediaLibraryRuntimeState,
  replaceSurfaceMediaRowsByTabs,
  replaceSurfaceMediaTabRows,
  replaceSurfacePromptRows,
  selectSurfaceMediaTabCacheRecord,
  selectSurfaceMediaRows,
  selectSurfacePromptRows,
  selectTotalCachedMediaBytes,
  setSurfaceAspectRatio,
  setSurfacePromptsLoaded,
  setSurfaceSignedUrls,
} from "./store";
import type {
  MediaLibraryMediaRow,
  MediaLibraryPromptRow,
  MediaLibraryRuntimeState,
} from "./types";

type UseMediaLibraryRouteRuntimeArgs = {
  activeMediaTab: MediaDataTab | null;
};

type UseMediaLibraryRouteRuntimeResult<
  TMedia extends MediaLibraryMediaRow,
  TPrompt extends MediaLibraryPromptRow,
> = {
  activeMediaCache: MediaTabCache<TMedia> | null;
  aspectMap: Record<string, number>;
  cachedMediaBytes: number;
  files: TMedia[];
  mediaTabCache: Record<MediaDataTab, MediaTabCache<TMedia>>;
  prompts: TPrompt[];
  promptsLoaded: boolean;
  runtimeState: MediaLibraryRuntimeState<TMedia, TPrompt>;
  setAspectRatio: (id: string, ratio: number) => void;
  setSignedUrls: (signedUrlById: Map<string, string>) => void;
  setFiles: Dispatch<SetStateAction<TMedia[]>>;
  setMediaTabCache: Dispatch<SetStateAction<Record<MediaDataTab, MediaTabCache<TMedia>>>>;
  setPrompts: Dispatch<SetStateAction<TPrompt[]>>;
  setPromptsLoaded: Dispatch<SetStateAction<boolean>>;
};

const buildRouteMediaTabCacheRecord = <
  TMedia extends MediaLibraryMediaRow,
  TPrompt extends MediaLibraryPromptRow,
>(
  runtimeState: MediaLibraryRuntimeState<TMedia, TPrompt>
): Record<MediaDataTab, MediaTabCache<TMedia>> => {
  const routeSurfaceState = runtimeState.surfaceStateByKind.route;
  const mediaIdsByTab = routeSurfaceState.orderedViews.mediaIdsByTab;
  const signedUrlById = routeSurfaceState.preview.signedUrlById;

  const buildRows = (tab: MediaDataTab): TMedia[] =>
    mediaIdsByTab[tab]
      .map((id) => {
        const row = runtimeState.mediaById[id];
        if (!row) return null;
        const signedUrl = signedUrlById[id];
        if (!signedUrl || row.signedUrl === signedUrl) return row;
        return { ...row, signedUrl };
      })
      .filter((row): row is TMedia => Boolean(row));

  return {
    uploaded_images: {
      ...routeSurfaceState.cacheByTab.uploaded_images,
      rows: buildRows("uploaded_images"),
    },
    uploaded_videos: {
      ...routeSurfaceState.cacheByTab.uploaded_videos,
      rows: buildRows("uploaded_videos"),
    },
    private: {
      ...routeSurfaceState.cacheByTab.private,
      rows: buildRows("private"),
    },
    ai_generations: {
      ...routeSurfaceState.cacheByTab.ai_generations,
      rows: buildRows("ai_generations"),
    },
  };
};

const buildRouteMediaTabCache = <
  TMedia extends MediaLibraryMediaRow,
  TPrompt extends MediaLibraryPromptRow,
>(
  runtimeState: MediaLibraryRuntimeState<TMedia, TPrompt>,
  tab: MediaDataTab
): MediaTabCache<TMedia> => {
  const routeSurfaceState = runtimeState.surfaceStateByKind.route;
  const signedUrlById = routeSurfaceState.preview.signedUrlById;
  const rows = routeSurfaceState.orderedViews.mediaIdsByTab[tab]
    .map((id) => {
      const row = runtimeState.mediaById[id];
      if (!row) return null;
      const signedUrl = signedUrlById[id];
      if (!signedUrl || row.signedUrl === signedUrl) return row;
      return { ...row, signedUrl };
    })
    .filter((row): row is TMedia => Boolean(row));
  return {
    ...routeSurfaceState.cacheByTab[tab],
    rows,
  };
};

export const useMediaLibraryRouteRuntime = <
  TMedia extends MediaLibraryMediaRow,
  TPrompt extends MediaLibraryPromptRow,
>({
  activeMediaTab,
}: UseMediaLibraryRouteRuntimeArgs): UseMediaLibraryRouteRuntimeResult<TMedia, TPrompt> => {
  const [runtimeState, setRuntimeState] = useState(() =>
    createMediaLibraryRuntimeState<TMedia, TPrompt>()
  );
  const routeSurfaceState = runtimeState.surfaceStateByKind.route;
  const routePromptIds = routeSurfaceState.orderedViews.promptIds;
  const mediaTabCache = useMemo(() => buildRouteMediaTabCacheRecord(runtimeState), [runtimeState]);

  const activeMediaCache = useMemo(() => {
    if (!activeMediaTab) return null;
    return buildRouteMediaTabCache(runtimeState, activeMediaTab);
  }, [activeMediaTab, runtimeState]);

  const files = useMemo(() => {
    return activeMediaCache?.rows ?? [];
  }, [activeMediaCache]);

  const prompts = useMemo(
    () =>
      routePromptIds
        .map((id) => runtimeState.promptById[id])
        .filter((row): row is TPrompt => Boolean(row)),
    [routePromptIds, runtimeState.promptById]
  );

  const setFiles = useCallback<Dispatch<SetStateAction<TMedia[]>>>(
    (updater) => {
      setRuntimeState((prev) => {
        const tab = activeMediaTab;
        if (!tab) return prev;
        const currentRows = selectSurfaceMediaRows(prev, { surface: "route", tab });
        const nextRows = typeof updater === "function" ? updater(currentRows) : updater;
        if (nextRows === currentRows) return prev;
        return replaceSurfaceMediaTabRows(prev, {
          surface: "route",
          tab,
          rows: nextRows,
          cache: prev.surfaceStateByKind.route.cacheByTab[tab],
        });
      });
    },
    [activeMediaTab]
  );

  const setPrompts = useCallback<Dispatch<SetStateAction<TPrompt[]>>>((updater) => {
    setRuntimeState((prev) => {
      const currentRows = selectSurfacePromptRows(prev, "route");
      const nextRows = typeof updater === "function" ? updater(currentRows) : updater;
      if (nextRows === currentRows) return prev;
      return replaceSurfacePromptRows(prev, {
        surface: "route",
        rows: nextRows,
      });
    });
  }, []);

  const setPromptsLoaded = useCallback<Dispatch<SetStateAction<boolean>>>((updater) => {
    setRuntimeState((prev) => {
      const currentValue = prev.surfaceStateByKind.route.promptsLoaded;
      const nextValue = typeof updater === "function" ? updater(currentValue) : updater;
      return setSurfacePromptsLoaded(prev, {
        surface: "route",
        promptsLoaded: nextValue,
      });
    });
  }, []);

  const setMediaTabCache = useCallback<
    Dispatch<SetStateAction<Record<MediaDataTab, MediaTabCache<TMedia>>>>
  >((updater) => {
    setRuntimeState((prev) => {
      const currentCache = selectSurfaceMediaTabCacheRecord(prev, "route");
      const nextCache = typeof updater === "function" ? updater(currentCache) : updater;
      return replaceSurfaceMediaRowsByTabs(prev, {
        surface: "route",
        rowsByTab: {
          uploaded_images: nextCache.uploaded_images.rows,
          uploaded_videos: nextCache.uploaded_videos.rows,
          private: nextCache.private.rows,
          ai_generations: nextCache.ai_generations.rows,
        },
        cacheByTab: {
          uploaded_images: {
            nextCursor: nextCache.uploaded_images.nextCursor,
            pagesLoaded: nextCache.uploaded_images.pagesLoaded,
            query: nextCache.uploaded_images.query,
            loadedAtMs: nextCache.uploaded_images.loadedAtMs,
            hasMore: nextCache.uploaded_images.hasMore,
            loading: nextCache.uploaded_images.loading,
            loaded: nextCache.uploaded_images.loaded,
            error: nextCache.uploaded_images.error,
          },
          uploaded_videos: {
            nextCursor: nextCache.uploaded_videos.nextCursor,
            pagesLoaded: nextCache.uploaded_videos.pagesLoaded,
            query: nextCache.uploaded_videos.query,
            loadedAtMs: nextCache.uploaded_videos.loadedAtMs,
            hasMore: nextCache.uploaded_videos.hasMore,
            loading: nextCache.uploaded_videos.loading,
            loaded: nextCache.uploaded_videos.loaded,
            error: nextCache.uploaded_videos.error,
          },
          private: {
            nextCursor: nextCache.private.nextCursor,
            pagesLoaded: nextCache.private.pagesLoaded,
            query: nextCache.private.query,
            loadedAtMs: nextCache.private.loadedAtMs,
            hasMore: nextCache.private.hasMore,
            loading: nextCache.private.loading,
            loaded: nextCache.private.loaded,
            error: nextCache.private.error,
          },
          ai_generations: {
            nextCursor: nextCache.ai_generations.nextCursor,
            pagesLoaded: nextCache.ai_generations.pagesLoaded,
            query: nextCache.ai_generations.query,
            loadedAtMs: nextCache.ai_generations.loadedAtMs,
            hasMore: nextCache.ai_generations.hasMore,
            loading: nextCache.ai_generations.loading,
            loaded: nextCache.ai_generations.loaded,
            error: nextCache.ai_generations.error,
          },
        },
      });
    });
  }, []);

  const setAspectRatio = useCallback((id: string, ratio: number) => {
    if (!Number.isFinite(ratio) || ratio <= 0) return;
    setRuntimeState((prev) =>
      setSurfaceAspectRatio(prev, {
        surface: "route",
        mediaId: id,
        aspectRatio: ratio,
      })
    );
  }, []);

  const setSignedUrls = useCallback((signedUrlById: Map<string, string>) => {
    setRuntimeState((prev) =>
      setSurfaceSignedUrls(prev, {
        surface: "route",
        signedUrlById,
      })
    );
  }, []);

  return {
    activeMediaCache,
    aspectMap: runtimeState.surfaceStateByKind.route.preview.aspectRatioById,
    cachedMediaBytes: selectTotalCachedMediaBytes(runtimeState),
    files,
    mediaTabCache,
    prompts,
    promptsLoaded: runtimeState.surfaceStateByKind.route.promptsLoaded,
    runtimeState,
    setAspectRatio,
    setSignedUrls,
    setFiles,
    setMediaTabCache,
    setPrompts,
    setPromptsLoaded,
  };
};
