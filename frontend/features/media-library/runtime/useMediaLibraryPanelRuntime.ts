/**
 * Transitional panel adapter for the shared Media Library runtime store.
 * Keeps the AI Studio panel on the same normalized media/prompt substrate as modal/panel
 * while its pagination controller is converged in follow-up work.
 */
import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { resolveMediaRowKind } from "../../../lib/mediaRowKind";
import {
  getMediaDataTabForRow,
  type MediaFileRow,
  type PromptRow,
} from "../../ai-studio/logic/mediaLibraryModalModel";
import {
  appendSurfaceMediaRows,
  createMediaLibraryRuntimeState,
  replaceSurfaceMediaRowsByTabs,
  replaceSurfacePromptRows,
  resolveMediaRowsForOrderedIds,
  selectSurfaceAggregateScopeCache,
  selectSurfaceAggregateMediaRows,
  setSurfaceAggregateScopeCache,
  setSurfaceError,
  setSurfaceSignedUrls,
} from "./store";
import type { MediaLibraryAggregateScopeCacheState, MediaLibraryRuntimeState } from "./types";

type MediaLibraryPanelItemType = "all" | "images" | "videos" | "audio" | "prompts";

type UseMediaLibraryPanelRuntimeArgs = {
  itemType: MediaLibraryPanelItemType;
};

type UseMediaLibraryPanelRuntimeResult = {
  error: string | null;
  mediaRows: MediaFileRow[];
  mediaScopeCache: MediaLibraryAggregateScopeCacheState;
  appendMediaRows: (rows: MediaFileRow[]) => void;
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

export const useMediaLibraryPanelRuntime = ({
  itemType,
}: UseMediaLibraryPanelRuntimeArgs): UseMediaLibraryPanelRuntimeResult => {
  const [runtimeState, setRuntimeState] = useState(() =>
    createMediaLibraryRuntimeState<MediaFileRow, PromptRow>()
  );
  const panelSurfaceState = runtimeState.surfaceStateByKind.panel;
  const panelMediaIds = panelSurfaceState.orderedViews.mediaIds;
  const panelPromptIds = panelSurfaceState.orderedViews.promptIds;
  const panelSignedUrlById = panelSurfaceState.preview.signedUrlById;

  const mediaRows = useMemo(() => {
    const panelRows = resolveMediaRowsForOrderedIds({
      mediaById: runtimeState.mediaById,
      mediaIds: panelMediaIds,
      signedUrlById: panelSignedUrlById,
    });
    if (itemType === "images") {
      return panelRows.filter((row) => resolveMediaRowKind(row) === "image");
    }
    if (itemType === "videos") {
      return panelRows.filter((row) => resolveMediaRowKind(row) === "video");
    }
    if (itemType === "audio") {
      return panelRows.filter((row) => resolveMediaRowKind(row) === "audio");
    }
    if (itemType === "prompts") {
      return [];
    }
    return panelRows;
  }, [itemType, panelMediaIds, panelSignedUrlById, runtimeState.mediaById]);

  const promptRows = useMemo(
    () =>
      panelPromptIds
        .map((id) => runtimeState.promptById[id])
        .filter((row): row is PromptRow => Boolean(row)),
    [panelPromptIds, runtimeState.promptById]
  );
  const mediaScopeCache = useMemo(
    () => selectSurfaceAggregateScopeCache(runtimeState, { surface: "panel", kind: "media" }),
    [runtimeState]
  );
  const promptScopeCache = useMemo(
    () => selectSurfaceAggregateScopeCache(runtimeState, { surface: "panel", kind: "prompts" }),
    [runtimeState]
  );
  const error = panelSurfaceState.error;

  const setMediaRows = useCallback<Dispatch<SetStateAction<MediaFileRow[]>>>((updater) => {
    setRuntimeState((prev) => {
      const currentRows = selectSurfaceAggregateMediaRows(prev, "panel");
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

      return replaceSurfaceMediaRowsByTabs(prev, {
        surface: "panel",
        rowsByTab,
        mediaIds: nextRows.map((row) => row.id),
        cacheByTab: {
          uploaded_images: prev.surfaceStateByKind.panel.cacheByTab.uploaded_images,
          uploaded_videos: prev.surfaceStateByKind.panel.cacheByTab.uploaded_videos,
          private: prev.surfaceStateByKind.panel.cacheByTab.private,
          ai_generations: prev.surfaceStateByKind.panel.cacheByTab.ai_generations,
        },
      });
    });
  }, []);

  const appendMediaRows = useCallback((rows: MediaFileRow[]) => {
    setRuntimeState((prev) =>
      appendSurfaceMediaRows(prev, {
        surface: "panel",
        rows,
      })
    );
  }, []);

  const setPromptRows = useCallback<Dispatch<SetStateAction<PromptRow[]>>>((updater) => {
    setRuntimeState((prev) => {
      const currentRows = prev.surfaceStateByKind.panel.orderedViews.promptIds
        .map((id) => prev.promptById[id])
        .filter((row): row is PromptRow => Boolean(row));
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
    appendMediaRows,
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
