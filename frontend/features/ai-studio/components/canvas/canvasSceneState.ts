/**
 * Canvas shared scene state.
 * Owns scene items, pending placeholders, selection, and text draft/edit mutation flows.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { randomId } from "../../logic/ids";
import { AI_STUDIO_CANVAS_ITEM_HARD_CAP } from "../../logic/sessionSnapshotCanvas";
import {
  CANVAS_AUDIO_ITEM_HEIGHT,
  CANVAS_AUDIO_ITEM_WIDTH,
  CANVAS_IMAGE_ITEM_HEIGHT,
  CANVAS_IMAGE_ITEM_WIDTH,
  CANVAS_TEXT_ITEM_MIN_HEIGHT,
  CANVAS_TEXT_ITEM_WIDTH,
  fitCanvasImageToProxyFrame,
} from "./canvasGeometry";
import type { CanvasDropResolution, CanvasSceneItem } from "./canvasTypes";

const CANVAS_PENDING_BASE_Z_INDEX = 1_000_000;

export type CanvasPendingSceneItem = {
  id: string;
  kind: CanvasSceneItem["kind"];
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
};

export type CanvasDraftTextEntry = {
  x: number;
  y: number;
  value: string;
};

export type CanvasTextEditSession = {
  itemId: string;
  value: string;
};

export type CanvasSharedSceneState = {
  items: CanvasSceneItem[];
  pendingItems: CanvasPendingSceneItem[];
  draftTextEntry: CanvasDraftTextEntry | null;
  textEditSession: CanvasTextEditSession | null;
  setItems: Dispatch<SetStateAction<CanvasSceneItem[]>>;
  setPendingItems: Dispatch<SetStateAction<CanvasPendingSceneItem[]>>;
  setDraftTextEntry: Dispatch<SetStateAction<CanvasDraftTextEntry | null>>;
  setTextEditSession: Dispatch<SetStateAction<CanvasTextEditSession | null>>;
  clearSelection: () => void;
  clearPendingItems: () => void;
  clearDraftTextEntry: () => void;
  clearTextEditSession: () => void;
  deleteSelection: () => void;
  addResolvedItem: (
    resolved: CanvasDropResolution,
    worldX: number,
    worldY: number,
    options?: { showLoadingPlaceholder?: boolean }
  ) => Promise<void>;
  replaceSessionSceneState: (next: {
    items: CanvasSceneItem[];
    draftTextEntry: CanvasDraftTextEntry | null;
    textEditSession: CanvasTextEditSession | null;
  }) => void;
  commitDraftTextEntry: () => void;
  commitTextItemEdit: () => void;
};

const getHighestCanvasZIndex = (items: CanvasSceneItem[]): number =>
  items.reduce((highest, item) => Math.max(highest, item.z), 0);

export const clearCanvasSceneSelection = (items: CanvasSceneItem[]): CanvasSceneItem[] => {
  let changed = false;
  const nextItems = items.map((item) => {
    if (!item.selected) return item;
    changed = true;
    return {
      ...item,
      selected: false,
    };
  });
  return changed ? nextItems : items;
};

export const deleteSelectedCanvasSceneItems = (items: CanvasSceneItem[]): CanvasSceneItem[] => {
  const nextItems = items.filter((item) => !item.selected);
  return nextItems.length === items.length ? items : nextItems;
};

export const deleteCanvasSceneItemById = (
  items: CanvasSceneItem[],
  itemId: string
): CanvasSceneItem[] => {
  const nextItems = items.filter((item) => item.id !== itemId);
  return nextItems.length === items.length ? items : nextItems;
};

export const selectCanvasSceneItem = (
  items: CanvasSceneItem[],
  itemId: string
): CanvasSceneItem[] => {
  const highestZ = getHighestCanvasZIndex(items);
  let changed = false;
  const nextItems = items.map((item) => {
    const isTarget = item.id === itemId;
    const nextSelected = isTarget;
    const nextZ = isTarget ? highestZ + 1 : item.z;
    if (item.selected === nextSelected && item.z === nextZ) return item;
    changed = true;
    return {
      ...item,
      selected: nextSelected,
      z: nextZ,
    };
  });
  return changed ? nextItems : items;
};

export const getSelectedCanvasSceneItemIds = (items: CanvasSceneItem[]): Set<string> => {
  const selectedIds = new Set<string>();
  items.forEach((item) => {
    if (item.selected) {
      selectedIds.add(item.id);
    }
  });
  return selectedIds;
};

export const setCanvasSceneSelectionByIds = (
  items: CanvasSceneItem[],
  selectedIds: Set<string>,
  options?: { mode?: "replace" | "add" }
): CanvasSceneItem[] => {
  const selectionMode = options?.mode ?? "replace";
  let changed = false;
  const nextItems = items.map((item) => {
    const shouldSelect = selectedIds.has(item.id) || (selectionMode === "add" && item.selected);
    if (item.selected === shouldSelect) return item;
    changed = true;
    return {
      ...item,
      selected: shouldSelect,
    };
  });
  return changed ? nextItems : items;
};

export const moveCanvasSceneItemsByIdSet = (
  items: CanvasSceneItem[],
  selectedIds: Set<string>,
  deltaX: number,
  deltaY: number
): CanvasSceneItem[] => {
  if (!selectedIds.size || (!deltaX && !deltaY)) return items;
  let changed = false;
  const nextItems = items.map((item) => {
    if (!selectedIds.has(item.id)) return item;
    changed = true;
    return {
      ...item,
      x: Math.round((item.x + deltaX) * 100) / 100,
      y: Math.round((item.y + deltaY) * 100) / 100,
    };
  });
  return changed ? nextItems : items;
};

const resolveCanvasImageDimensions = async (
  resolved: Extract<CanvasDropResolution, { kind: "image" }>
): Promise<{ width: number; height: number }> => {
  if (
    typeof resolved.width === "number" &&
    Number.isFinite(resolved.width) &&
    resolved.width > 0 &&
    typeof resolved.height === "number" &&
    Number.isFinite(resolved.height) &&
    resolved.height > 0
  ) {
    return fitCanvasImageToProxyFrame({
      width: resolved.width,
      height: resolved.height,
    });
  }
  if (typeof Image === "undefined") {
    return {
      width: CANVAS_IMAGE_ITEM_WIDTH,
      height: CANVAS_IMAGE_ITEM_HEIGHT,
    };
  }
  return await new Promise<{ width: number; height: number }>((resolve) => {
    const image = new Image();
    const finalize = (width: number, height: number) =>
      resolve({
        width,
        height,
      });
    image.onload = () => {
      if (image.naturalWidth > 0 && image.naturalHeight > 0) {
        const fitted = fitCanvasImageToProxyFrame({
          width: image.naturalWidth,
          height: image.naturalHeight,
        });
        finalize(fitted.width, fitted.height);
        return;
      }
      finalize(CANVAS_IMAGE_ITEM_WIDTH, CANVAS_IMAGE_ITEM_HEIGHT);
    };
    image.onerror = () => finalize(CANVAS_IMAGE_ITEM_WIDTH, CANVAS_IMAGE_ITEM_HEIGHT);
    image.src = resolved.src;
  });
};

const resolveCanvasImageDimensionsFromResolution = (
  resolved: Extract<CanvasDropResolution, { kind: "image" }>
): { width: number; height: number } | null => {
  if (
    typeof resolved.width === "number" &&
    Number.isFinite(resolved.width) &&
    resolved.width > 0 &&
    typeof resolved.height === "number" &&
    Number.isFinite(resolved.height) &&
    resolved.height > 0
  ) {
    return fitCanvasImageToProxyFrame({
      width: resolved.width,
      height: resolved.height,
    });
  }
  return null;
};

const resolveCanvasVideoDimensions = (
  resolved: Extract<CanvasDropResolution, { kind: "video" }>
): { width: number; height: number } => {
  if (
    typeof resolved.width === "number" &&
    Number.isFinite(resolved.width) &&
    resolved.width > 0 &&
    typeof resolved.height === "number" &&
    Number.isFinite(resolved.height) &&
    resolved.height > 0
  ) {
    return fitCanvasImageToProxyFrame({
      width: resolved.width,
      height: resolved.height,
    });
  }
  return {
    width: CANVAS_IMAGE_ITEM_WIDTH,
    height: CANVAS_IMAGE_ITEM_HEIGHT,
  };
};

const resolveCanvasAudioDimensions = (
  resolved: Extract<CanvasDropResolution, { kind: "audio" }>
): { width: number; height: number } => {
  const width =
    typeof resolved.width === "number" && Number.isFinite(resolved.width) && resolved.width > 0
      ? resolved.width
      : CANVAS_AUDIO_ITEM_WIDTH;
  const height =
    typeof resolved.height === "number" && Number.isFinite(resolved.height) && resolved.height > 0
      ? resolved.height
      : CANVAS_AUDIO_ITEM_HEIGHT;
  return {
    width: Math.round(width * 100) / 100,
    height: Math.round(height * 100) / 100,
  };
};

const waitForNextAnimationFrame = async (): Promise<void> => {
  if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") return;
  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
};

const buildCanvasSceneItem = ({
  resolved,
  x,
  y,
  z,
  width,
  height,
}: {
  resolved: CanvasDropResolution;
  x: number;
  y: number;
  z: number;
  width?: number;
  height?: number;
}): CanvasSceneItem =>
  resolved.kind === "image"
    ? {
        id: randomId(),
        kind: "image",
        x,
        y,
        z,
        selected: true,
        outputId: resolved.outputId,
        sourceSurface: resolved.sourceSurface ?? null,
        mediaId: resolved.mediaId,
        src: resolved.src,
        alt: resolved.alt,
        width: width ?? CANVAS_IMAGE_ITEM_WIDTH,
        height: height ?? CANVAS_IMAGE_ITEM_HEIGHT,
      }
    : resolved.kind === "video"
      ? {
          id: randomId(),
          kind: "video",
          x,
          y,
          z,
          selected: true,
          outputId: resolved.outputId,
          sourceSurface: resolved.sourceSurface ?? null,
          mediaId: resolved.mediaId,
          videoUrl: resolved.videoUrl,
          posterUrl: resolved.posterUrl?.trim() || null,
          title: resolved.title?.trim() || null,
          durationMs: resolved.durationMs ?? null,
          width: width ?? CANVAS_IMAGE_ITEM_WIDTH,
          height: height ?? CANVAS_IMAGE_ITEM_HEIGHT,
        }
      : resolved.kind === "audio"
        ? {
            id: randomId(),
            kind: "audio",
            x,
            y,
            z,
            selected: true,
            outputId: resolved.outputId,
            sourceSurface: resolved.sourceSurface ?? null,
            mediaId: resolved.mediaId,
            audioUrl: resolved.audioUrl,
            title: resolved.title?.trim() || null,
            companionArtUrl: resolved.companionArtUrl?.trim() || null,
            companionArtStoragePath: resolved.companionArtStoragePath?.trim() || null,
            audioSourceMode: resolved.audioSourceMode ?? null,
            durationMs: resolved.durationMs ?? null,
            waveformPeaks: Array.isArray(resolved.waveformPeaks) ? resolved.waveformPeaks : null,
            width: width ?? CANVAS_AUDIO_ITEM_WIDTH,
            height: height ?? CANVAS_AUDIO_ITEM_HEIGHT,
          }
        : {
            id: randomId(),
            kind: "text",
            x,
            y,
            z,
            selected: true,
            outputId: resolved.outputId,
            sourceSurface: resolved.sourceSurface ?? null,
            text: resolved.text,
            width: CANVAS_TEXT_ITEM_WIDTH,
            height: height ?? CANVAS_TEXT_ITEM_MIN_HEIGHT,
          };

/**
 * Returns the shared scene store used by both canvas instances.
 */
export const useCanvasSharedSceneState = ({
  onItemLimitReached,
}: {
  onItemLimitReached?: () => void;
} = {}): CanvasSharedSceneState => {
  const [items, setItems] = useState<CanvasSceneItem[]>([]);
  const [pendingItems, setPendingItems] = useState<CanvasPendingSceneItem[]>([]);
  const [draftTextEntry, setDraftTextEntry] = useState<CanvasDraftTextEntry | null>(null);
  const [textEditSession, setTextEditSession] = useState<CanvasTextEditSession | null>(null);
  const itemsRef = useRef<CanvasSceneItem[]>([]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const notifyItemLimitReached = useCallback(() => {
    onItemLimitReached?.();
  }, [onItemLimitReached]);

  const clearSelection = useCallback(() => {
    setItems((currentItems) => clearCanvasSceneSelection(currentItems));
  }, []);

  const clearPendingItems = useCallback(() => {
    setPendingItems([]);
  }, []);

  const clearDraftTextEntry = useCallback(() => {
    setDraftTextEntry(null);
  }, []);

  const clearTextEditSession = useCallback(() => {
    setTextEditSession(null);
  }, []);

  const deleteSelection = useCallback(() => {
    setItems((currentItems) => deleteSelectedCanvasSceneItems(currentItems));
    setTextEditSession(null);
  }, []);

  const addResolvedItem = useCallback(
    async (
      resolved: CanvasDropResolution,
      worldX: number,
      worldY: number,
      options: { showLoadingPlaceholder?: boolean } = {}
    ) => {
      if (itemsRef.current.length >= AI_STUDIO_CANVAS_ITEM_HARD_CAP) {
        notifyItemLimitReached();
        return;
      }

      const showLoadingPlaceholder = Boolean(options.showLoadingPlaceholder);
      const pendingId = showLoadingPlaceholder ? randomId() : null;
      const preResolvedImageDimensions =
        resolved.kind === "image" ? resolveCanvasImageDimensionsFromResolution(resolved) : null;
      const videoDimensions =
        resolved.kind === "video" ? resolveCanvasVideoDimensions(resolved) : null;
      const audioDimensions =
        resolved.kind === "audio" ? resolveCanvasAudioDimensions(resolved) : null;
      const imageDimensions =
        resolved.kind === "image"
          ? (preResolvedImageDimensions ?? (await resolveCanvasImageDimensions(resolved)))
          : null;
      const pendingWidth =
        resolved.kind === "image"
          ? (imageDimensions?.width ?? CANVAS_IMAGE_ITEM_WIDTH)
          : resolved.kind === "video"
            ? (videoDimensions?.width ?? CANVAS_IMAGE_ITEM_WIDTH)
            : resolved.kind === "audio"
              ? (audioDimensions?.width ?? CANVAS_AUDIO_ITEM_WIDTH)
              : CANVAS_TEXT_ITEM_WIDTH;
      const pendingHeight =
        resolved.kind === "image"
          ? (imageDimensions?.height ?? CANVAS_IMAGE_ITEM_HEIGHT)
          : resolved.kind === "video"
            ? (videoDimensions?.height ?? CANVAS_IMAGE_ITEM_HEIGHT)
            : resolved.kind === "audio"
              ? (audioDimensions?.height ?? CANVAS_AUDIO_ITEM_HEIGHT)
              : CANVAS_TEXT_ITEM_MIN_HEIGHT;
      const pendingX = Math.round((worldX - pendingWidth / 2) * 100) / 100;
      const pendingY =
        resolved.kind === "image" || resolved.kind === "video" || resolved.kind === "audio"
          ? Math.round((worldY - pendingHeight / 2) * 100) / 100
          : Math.round((worldY - 36) * 100) / 100;

      if (pendingId) {
        setPendingItems((currentPendingItems) => [
          ...currentPendingItems,
          {
            id: pendingId,
            kind: resolved.kind,
            x: pendingX,
            y: pendingY,
            z: CANVAS_PENDING_BASE_Z_INDEX + currentPendingItems.length + 1,
            width: pendingWidth,
            height: pendingHeight,
          },
        ]);
      }

      try {
        if (showLoadingPlaceholder && (resolved.kind === "text" || resolved.kind === "audio")) {
          await waitForNextAnimationFrame();
        }
        if (showLoadingPlaceholder && resolved.kind === "image" && !preResolvedImageDimensions) {
          await waitForNextAnimationFrame();
        }

        let blockedByCap = false;
        setItems((currentItems) => {
          if (currentItems.length >= AI_STUDIO_CANVAS_ITEM_HARD_CAP) {
            blockedByCap = true;
            return currentItems;
          }
          const highestZ = getHighestCanvasZIndex(currentItems) + 1;
          const nextItems = clearCanvasSceneSelection(currentItems);
          const offsetX =
            resolved.kind === "image"
              ? (imageDimensions?.width ?? CANVAS_IMAGE_ITEM_WIDTH) / 2
              : resolved.kind === "video"
                ? (videoDimensions?.width ?? CANVAS_IMAGE_ITEM_WIDTH) / 2
                : resolved.kind === "audio"
                  ? (audioDimensions?.width ?? CANVAS_AUDIO_ITEM_WIDTH) / 2
                  : CANVAS_TEXT_ITEM_WIDTH / 2;
          const offsetY =
            resolved.kind === "image"
              ? (imageDimensions?.height ?? CANVAS_IMAGE_ITEM_HEIGHT) / 2
              : resolved.kind === "video"
                ? (videoDimensions?.height ?? CANVAS_IMAGE_ITEM_HEIGHT) / 2
                : resolved.kind === "audio"
                  ? (audioDimensions?.height ?? CANVAS_AUDIO_ITEM_HEIGHT) / 2
                  : 36;
          return [
            ...nextItems,
            buildCanvasSceneItem({
              resolved,
              x: Math.round((worldX - offsetX) * 100) / 100,
              y: Math.round((worldY - offsetY) * 100) / 100,
              z: highestZ,
              width:
                resolved.kind === "audio"
                  ? audioDimensions?.width
                  : resolved.kind === "video"
                    ? videoDimensions?.width
                    : imageDimensions?.width,
              height:
                resolved.kind === "audio"
                  ? audioDimensions?.height
                  : resolved.kind === "video"
                    ? videoDimensions?.height
                    : imageDimensions?.height,
            }),
          ];
        });
        if (blockedByCap) {
          notifyItemLimitReached();
        }
      } finally {
        if (pendingId) {
          setPendingItems((currentPendingItems) =>
            currentPendingItems.filter((item) => item.id !== pendingId)
          );
        }
      }
    },
    [notifyItemLimitReached]
  );

  const commitDraftTextEntry = useCallback(() => {
    setDraftTextEntry((draft) => {
      const text = draft?.value.trim() ?? "";
      if (!draft || !text) return null;
      let blockedByCap = false;
      setItems((currentItems) => {
        if (currentItems.length >= AI_STUDIO_CANVAS_ITEM_HARD_CAP) {
          blockedByCap = true;
          return currentItems;
        }
        const highestZ = getHighestCanvasZIndex(currentItems) + 1;
        const nextItems = clearCanvasSceneSelection(currentItems);
        return [
          ...nextItems,
          buildCanvasSceneItem({
            resolved: {
              kind: "text",
              outputId: null,
              text,
            },
            x: draft.x,
            y: draft.y,
            z: highestZ,
          }),
        ];
      });
      if (blockedByCap) {
        notifyItemLimitReached();
      }
      return null;
    });
  }, [notifyItemLimitReached]);

  const commitTextItemEdit = useCallback(() => {
    setTextEditSession((session) => {
      if (!session) return null;
      const nextText = session.value.trim();
      if (!nextText) return null;
      setItems((currentItems) =>
        currentItems.map((item) =>
          item.id === session.itemId && item.kind === "text"
            ? {
                ...item,
                text: nextText,
              }
            : item
        )
      );
      return null;
    });
  }, []);

  const replaceSessionSceneState = useCallback(
    (next: {
      items: CanvasSceneItem[];
      draftTextEntry: CanvasDraftTextEntry | null;
      textEditSession: CanvasTextEditSession | null;
    }) => {
      setPendingItems([]);
      setItems(next.items);
      setDraftTextEntry(next.draftTextEntry);
      setTextEditSession(next.textEditSession);
    },
    []
  );

  return {
    items,
    pendingItems,
    draftTextEntry,
    textEditSession,
    setItems,
    setPendingItems,
    setDraftTextEntry,
    setTextEditSession,
    clearSelection,
    clearPendingItems,
    clearDraftTextEntry,
    clearTextEditSession,
    deleteSelection,
    addResolvedItem,
    replaceSessionSceneState,
    commitDraftTextEntry,
    commitTextItemEdit,
  };
};
