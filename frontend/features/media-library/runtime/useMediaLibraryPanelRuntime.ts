/**
 * Transitional panel adapter for the shared Media Library runtime store.
 * Keeps the AI Studio panel on the same normalized media/prompt substrate as route/modal
 * while its pagination controller is converged in follow-up work.
 */
import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  getMediaDataTabForRow,
  isAudioFile,
  isImageFile,
  isVideoFile,
  type MediaFileRow,
  type PromptRow,
} from "../../ai-studio/logic/mediaLibraryModalModel";
import {
  createMediaLibraryRuntimeState,
  replaceSurfaceMediaRowsByTabs,
  replaceSurfaceMediaTabRows,
  replaceSurfacePromptRows,
  selectSurfaceAggregateScopeCache,
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

const selectPanelMediaRows = ({
  mediaById,
  mediaIdsByTab,
  signedUrlById,
}: {
  mediaById: MediaLibraryRuntimeState<MediaFileRow, PromptRow>["mediaById"];
  mediaIdsByTab: MediaLibraryRuntimeState<
    MediaFileRow,
    PromptRow
  >["surfaceStateByKind"]["panel"]["orderedViews"]["mediaIdsByTab"];
  signedUrlById: MediaLibraryRuntimeState<
    MediaFileRow,
    PromptRow
  >["surfaceStateByKind"]["panel"]["preview"]["signedUrlById"];
}) =>
  panelTabOrder.flatMap((tab) =>
    mediaIdsByTab[tab]
      .map((id) => {
        const row = mediaById[id];
        if (!row) return null;
        const signedUrl = signedUrlById[id];
        if (!signedUrl || row.signedUrl === signedUrl) return row;
        return {
          ...row,
          signedUrl,
        };
      })
      .filter((row): row is MediaFileRow => Boolean(row))
  );

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
  const panelSurfaceState = runtimeState.surfaceStateByKind.panel;
  const panelMediaIdsByTab = panelSurfaceState.orderedViews.mediaIdsByTab;
  const panelPromptIds = panelSurfaceState.orderedViews.promptIds;
  const panelSignedUrlById = panelSurfaceState.preview.signedUrlById;

  const mediaRows = useMemo(() => {
    const panelRows = selectPanelMediaRows({
      mediaById: runtimeState.mediaById,
      mediaIdsByTab: panelMediaIdsByTab,
      signedUrlById: panelSignedUrlById,
    });
    if (itemType === "images") {
      return sortByCreatedAtDesc(panelRows.filter((row) => isImageFile(row.file_type)));
    }
    if (itemType === "videos") {
      return sortByCreatedAtDesc(panelRows.filter((row) => isVideoFile(row.file_type)));
    }
    if (itemType === "audio") {
      return sortByCreatedAtDesc(panelRows.filter((row) => isAudioFile(row.file_type)));
    }
    if (itemType === "prompts") {
      return [];
    }
    return sortByCreatedAtDesc(panelRows);
  }, [itemType, panelMediaIdsByTab, panelSignedUrlById, runtimeState.mediaById]);

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
      const currentRows = selectPanelMediaRows({
        mediaById: prev.mediaById,
        mediaIdsByTab: prev.surfaceStateByKind.panel.orderedViews.mediaIdsByTab,
        signedUrlById: prev.surfaceStateByKind.panel.preview.signedUrlById,
      });
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
        cacheByTab: {
          uploaded_images: prev.surfaceStateByKind.panel.cacheByTab.uploaded_images,
          uploaded_videos: prev.surfaceStateByKind.panel.cacheByTab.uploaded_videos,
          private: prev.surfaceStateByKind.panel.cacheByTab.private,
          ai_generations: prev.surfaceStateByKind.panel.cacheByTab.ai_generations,
        },
      });
    });
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
