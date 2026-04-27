/**
 * Transitional panel adapter for the shared Media Library runtime store.
 * Keeps the AI Studio panel on the same normalized media/prompt substrate as route/modal
 * while its pagination controller is converged in follow-up work.
 */
import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  getMediaDataTabForRow,
  isImageFile,
  type MediaFileRow,
  type PromptRow,
} from "../../ai-studio/logic/mediaLibraryModalModel";
import {
  createMediaLibraryRuntimeState,
  replaceSurfaceMediaTabRows,
  replaceSurfacePromptRows,
  selectSurfaceAggregateScopeCache,
  selectSurfaceMediaRows,
  selectSurfacePromptRows,
  setSurfaceAggregateScopeCache,
  setSurfaceError,
  setSurfaceSignedUrls,
} from "./store";
import type { MediaLibraryAggregateScopeCacheState, MediaLibraryRuntimeState } from "./types";

type MediaLibraryPanelItemType = "all" | "images" | "videos" | "prompts";

type UseMediaLibraryPanelRuntimeArgs = {
  itemType: MediaLibraryPanelItemType;
};

type UseMediaLibraryPanelRuntimeResult = {
  error: string | null;
  mediaRows: MediaFileRow[];
  mediaScopeCache: MediaLibraryAggregateScopeCacheState;
  setMediaRows: Dispatch<SetStateAction<MediaFileRow[]>>;
  setMediaScopeCache: Dispatch<SetStateAction<MediaLibraryAggregateScopeCacheState>>;
  setError: Dispatch<SetStateAction<string | null>>;
  promptRows: PromptRow[];
  promptScopeCache: MediaLibraryAggregateScopeCacheState;
  setPromptRows: Dispatch<SetStateAction<PromptRow[]>>;
  setPromptScopeCache: Dispatch<SetStateAction<MediaLibraryAggregateScopeCacheState>>;
  setSignedUrls: (signedUrlById: Map<string, string>) => void;
  runtimeState: MediaLibraryRuntimeState<MediaFileRow, PromptRow>;
};

const panelTabOrder = ["uploaded_images", "uploaded_videos", "private", "ai_generations"] as const;

const selectPanelMediaRows = (runtimeState: MediaLibraryRuntimeState<MediaFileRow, PromptRow>) =>
  panelTabOrder.flatMap((tab) => selectSurfaceMediaRows(runtimeState, { surface: "panel", tab }));

const sortByCreatedAtDesc = (rows: MediaFileRow[]): MediaFileRow[] =>
  [...rows].sort((left, right) => {
    const leftTime = Date.parse(left.created_at ?? "");
    const rightTime = Date.parse(right.created_at ?? "");
    if (!Number.isNaN(rightTime) || !Number.isNaN(leftTime)) {
      const delta =
        (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
      if (delta !== 0) return delta;
    }
    return right.id.localeCompare(left.id);
  });

export const useMediaLibraryPanelRuntime = ({
  itemType,
}: UseMediaLibraryPanelRuntimeArgs): UseMediaLibraryPanelRuntimeResult => {
  const [runtimeState, setRuntimeState] = useState(() =>
    createMediaLibraryRuntimeState<MediaFileRow, PromptRow>()
  );

  const mediaRows = useMemo(() => {
    const panelRows = selectPanelMediaRows(runtimeState);
    if (itemType === "images") {
      return sortByCreatedAtDesc(panelRows.filter((row) => isImageFile(row.file_type)));
    }
    if (itemType === "videos") {
      return sortByCreatedAtDesc(
        panelRows.filter((row) => row.file_type.toLowerCase().startsWith("video"))
      );
    }
    if (itemType === "prompts") {
      return [];
    }
    return sortByCreatedAtDesc(panelRows);
  }, [itemType, runtimeState]);

  const promptRows = useMemo(() => selectSurfacePromptRows(runtimeState, "panel"), [runtimeState]);
  const mediaScopeCache = useMemo(
    () => selectSurfaceAggregateScopeCache(runtimeState, { surface: "panel", kind: "media" }),
    [runtimeState]
  );
  const promptScopeCache = useMemo(
    () => selectSurfaceAggregateScopeCache(runtimeState, { surface: "panel", kind: "prompts" }),
    [runtimeState]
  );
  const error = runtimeState.surfaceStateByKind.panel.error;

  const setMediaRows = useCallback<Dispatch<SetStateAction<MediaFileRow[]>>>((updater) => {
    setRuntimeState((prev) => {
      const currentRows = selectPanelMediaRows(prev);
      const nextRows = typeof updater === "function" ? updater(currentRows) : updater;
      if (nextRows === currentRows) return prev;

      const rowsByTab = {
        uploaded_images: [] as MediaFileRow[],
        uploaded_videos: [] as MediaFileRow[],
        private: [] as MediaFileRow[],
        ai_generations: [] as MediaFileRow[],
      };

      for (const row of nextRows) {
        rowsByTab[getMediaDataTabForRow(row)].push(row);
      }

      let nextState = prev;
      nextState = replaceSurfaceMediaTabRows(nextState, {
        surface: "panel",
        tab: "uploaded_images",
        rows: rowsByTab.uploaded_images,
        cache: prev.surfaceStateByKind.panel.cacheByTab.uploaded_images,
      });
      nextState = replaceSurfaceMediaTabRows(nextState, {
        surface: "panel",
        tab: "uploaded_videos",
        rows: rowsByTab.uploaded_videos,
        cache: prev.surfaceStateByKind.panel.cacheByTab.uploaded_videos,
      });
      nextState = replaceSurfaceMediaTabRows(nextState, {
        surface: "panel",
        tab: "private",
        rows: rowsByTab.private,
        cache: prev.surfaceStateByKind.panel.cacheByTab.private,
      });
      nextState = replaceSurfaceMediaTabRows(nextState, {
        surface: "panel",
        tab: "ai_generations",
        rows: rowsByTab.ai_generations,
        cache: prev.surfaceStateByKind.panel.cacheByTab.ai_generations,
      });
      return nextState;
    });
  }, []);

  const setPromptRows = useCallback<Dispatch<SetStateAction<PromptRow[]>>>((updater) => {
    setRuntimeState((prev) => {
      const currentRows = selectSurfacePromptRows(prev, "panel");
      const nextRows = typeof updater === "function" ? updater(currentRows) : updater;
      if (nextRows === currentRows) return prev;
      return replaceSurfacePromptRows(prev, {
        surface: "panel",
        rows: nextRows,
      });
    });
  }, []);

  const setMediaScopeCache = useCallback<
    Dispatch<SetStateAction<MediaLibraryAggregateScopeCacheState>>
  >((updater) => {
    setRuntimeState((prev) => {
      const currentCache = selectSurfaceAggregateScopeCache(prev, {
        surface: "panel",
        kind: "media",
      });
      const nextCache = typeof updater === "function" ? updater(currentCache) : updater;
      if (nextCache === currentCache) return prev;
      return setSurfaceAggregateScopeCache(prev, {
        surface: "panel",
        kind: "media",
        cache: nextCache,
      });
    });
  }, []);

  const setPromptScopeCache = useCallback<
    Dispatch<SetStateAction<MediaLibraryAggregateScopeCacheState>>
  >((updater) => {
    setRuntimeState((prev) => {
      const currentCache = selectSurfaceAggregateScopeCache(prev, {
        surface: "panel",
        kind: "prompts",
      });
      const nextCache = typeof updater === "function" ? updater(currentCache) : updater;
      if (nextCache === currentCache) return prev;
      return setSurfaceAggregateScopeCache(prev, {
        surface: "panel",
        kind: "prompts",
        cache: nextCache,
      });
    });
  }, []);

  const setError = useCallback<Dispatch<SetStateAction<string | null>>>((updater) => {
    setRuntimeState((prev) => {
      const currentError = prev.surfaceStateByKind.panel.error;
      const nextError = typeof updater === "function" ? updater(currentError) : updater;
      if (nextError === currentError) return prev;
      return setSurfaceError(prev, { surface: "panel", error: nextError });
    });
  }, []);

  const setSignedUrls = useCallback((signedUrlById: Map<string, string>) => {
    setRuntimeState((prev) =>
      setSurfaceSignedUrls(prev, {
        surface: "panel",
        signedUrlById,
      })
    );
  }, []);

  return {
    error,
    mediaRows,
    mediaScopeCache,
    setMediaRows,
    setMediaScopeCache,
    setError,
    promptRows,
    promptScopeCache,
    setPromptRows,
    setPromptScopeCache,
    setSignedUrls,
    runtimeState,
  };
};
