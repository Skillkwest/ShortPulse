/**
 * Transitional route adapter for the shared Media Library runtime store.
 * Keeps current route hooks working while moving rows, cache metadata, and aspect ratios under the shared runtime substrate.
 */
import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { MediaDataTab, MediaTabCache } from "../logic/mediaLibraryPageHelpers";
import {
  createMediaLibraryRuntimeState,
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

const tabOrder: MediaDataTab[] = [
  "uploaded_images",
  "uploaded_videos",
  "private",
  "ai_generations",
];

export const useMediaLibraryRouteRuntime = <
  TMedia extends MediaLibraryMediaRow,
  TPrompt extends MediaLibraryPromptRow,
>({
  activeMediaTab,
}: UseMediaLibraryRouteRuntimeArgs): UseMediaLibraryRouteRuntimeResult<TMedia, TPrompt> => {
  const [runtimeState, setRuntimeState] = useState(() =>
    createMediaLibraryRuntimeState<TMedia, TPrompt>()
  );

  const mediaTabCache = useMemo(
    () => selectSurfaceMediaTabCacheRecord(runtimeState, "route"),
    [runtimeState]
  );

  const files = useMemo(() => {
    if (!activeMediaTab) return [];
    return mediaTabCache[activeMediaTab].rows;
  }, [activeMediaTab, mediaTabCache]);

  const prompts = useMemo(() => selectSurfacePromptRows(runtimeState, "route"), [runtimeState]);

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
      let nextState = prev;
      for (const tab of tabOrder) {
        nextState = replaceSurfaceMediaTabRows(nextState, {
          surface: "route",
          tab,
          rows: nextCache[tab].rows,
          cache: {
            nextCursor: nextCache[tab].nextCursor,
            pagesLoaded: nextCache[tab].pagesLoaded,
            query: nextCache[tab].query,
            loadedAtMs: nextCache[tab].loadedAtMs,
            hasMore: nextCache[tab].hasMore,
            loading: nextCache[tab].loading,
            loaded: nextCache[tab].loaded,
            error: nextCache[tab].error,
          },
        });
      }
      return nextState;
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
    activeMediaCache: activeMediaTab ? mediaTabCache[activeMediaTab] : null,
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
