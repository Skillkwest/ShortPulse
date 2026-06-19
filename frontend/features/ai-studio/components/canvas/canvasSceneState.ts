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
  resolveCanvasAudioItemDimensions,
} from "./canvasGeometry";
import type { CanvasDropResolution, CanvasInsertResult, CanvasSceneItem } from "./canvasTypes";

const CANVAS_PENDING_BASE_Z_INDEX = 1_000_000;
const CANVAS_VIDEO_FALLBACK_DIMENSIONS = fitCanvasImageToProxyFrame({
  width: 16,
  height: 9,
});

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

export type CanvasCommittedTextDraft = {
  itemId: string;
  text: string;
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
  ) => Promise<CanvasInsertResult>;
  replaceSessionSceneState: (next: {
    items: CanvasSceneItem[];
    draftTextEntry: CanvasDraftTextEntry | null;
    textEditSession: CanvasTextEditSession | null;
  }) => void;
  commitDraftTextEntry: (
    valueOverride?: string | null,
    draftOverride?: CanvasDraftTextEntry | null
  ) => CanvasCommittedTextDraft | null;
  commitTextItemEdit: () => void;
};

const getHighestCanvasZIndex = (items: CanvasSceneItem[]): number =>
  items.reduce((highest, item) => Math.max(highest, item.z), 0);

const roundCanvasSceneCoordinate = (value: number): number => Math.round(value * 100) / 100;

const resolveCanvasDropInsertionPoint = ({
  kind,
  worldX,
  worldY,
  width,
  height,
}: {
  kind: CanvasDropResolution["kind"];
  worldX: number;
  worldY: number;
  width: number;
  height: number;
}): { x: number; y: number } => {
  if (kind === "text") {
    return {
      x: roundCanvasSceneCoordinate(worldX),
      y: roundCanvasSceneCoordinate(worldY),
    };
  }
  return {
    x: roundCanvasSceneCoordinate(worldX - width / 2),
    y: roundCanvasSceneCoordinate(worldY - height / 2),
  };
};

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

const normalizeCanvasSceneItemDimensions = (item: CanvasSceneItem): CanvasSceneItem => {
  if (item.kind !== "audio") return item;
  const dimensions = resolveCanvasAudioItemDimensions({
    width: item.width,
    height: item.height,
  });
  if (item.width === dimensions.width && item.height === dimensions.height) return item;
  return {
    ...item,
    width: dimensions.width,
    height: dimensions.height,
  };
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

const resolveCanvasImageDimensionsFromSize = ({
  width,
  height,
}: {
  width?: number;
  height?: number;
}): { width: number; height: number } | null => {
  if (
    typeof width === "number" &&
    Number.isFinite(width) &&
    width > 0 &&
    typeof height === "number" &&
    Number.isFinite(height) &&
    height > 0
  ) {
    return fitCanvasImageToProxyFrame({
      width,
      height,
    });
  }
  return null;
};

const resolveCanvasImageDimensionsFromUrl = async ({
  src,
  fallback,
}: {
  src: string | null | undefined;
  fallback: { width: number; height: number };
}): Promise<{ width: number; height: number }> => {
  const normalizedSrc = src?.trim();
  if (typeof Image === "undefined") {
    return fallback;
  }
  if (!normalizedSrc) return fallback;
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
      finalize(fallback.width, fallback.height);
    };
    image.onerror = () => finalize(fallback.width, fallback.height);
    image.src = normalizedSrc;
  });
};

const resolveCanvasImageDimensions = async (
  resolved: Extract<CanvasDropResolution, { kind: "image" }>
): Promise<{ width: number; height: number }> => {
  const explicitDimensions = resolveCanvasImageDimensionsFromSize({
    width: resolved.width,
    height: resolved.height,
  });
  if (explicitDimensions) return explicitDimensions;
  return await resolveCanvasImageDimensionsFromUrl({
    src: resolved.src,
    fallback: {
      width: CANVAS_IMAGE_ITEM_WIDTH,
      height: CANVAS_IMAGE_ITEM_HEIGHT,
    },
  });
};

const resolveCanvasImageDimensionsFromResolution = (
  resolved: Extract<CanvasDropResolution, { kind: "image" }>
): { width: number; height: number } | null => {
  return resolveCanvasImageDimensionsFromSize({
    width: resolved.width,
    height: resolved.height,
  });
};

const resolveCanvasVideoDimensionsFromResolution = (
  resolved: Extract<CanvasDropResolution, { kind: "video" }>
): { width: number; height: number } | null => {
  return resolveCanvasImageDimensionsFromSize({
    width: resolved.width,
    height: resolved.height,
  });
};

const resolveCanvasVideoDimensions = async (
  resolved: Extract<CanvasDropResolution, { kind: "video" }>
): Promise<{ width: number; height: number }> => {
  const explicitDimensions = resolveCanvasVideoDimensionsFromResolution(resolved);
  if (explicitDimensions) return explicitDimensions;
  return await resolveCanvasImageDimensionsFromUrl({
    src: resolved.posterUrl,
    fallback: CANVAS_VIDEO_FALLBACK_DIMENSIONS,
  });
};

const resolveCanvasAudioDimensions = (
  resolved: Extract<CanvasDropResolution, { kind: "audio" }>
): { width: number; height: number } => {
  return resolveCanvasAudioItemDimensions({
    width: resolved.width,
    height: resolved.height,
  });
};

const waitForNextAnimationFrame = async (): Promise<void> => {
  if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") return;
  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
};

const buildCanvasSceneItem = ({
  itemId,
  resolved,
  x,
  y,
  z,
  width,
  height,
}: {
  itemId?: string;
  resolved: CanvasDropResolution;
  x: number;
  y: number;
  z: number;
  width?: number;
  height?: number;
}): CanvasSceneItem =>
  resolved.kind === "image"
    ? {
        id: (itemId ?? resolved.preferredItemId?.trim()) || randomId(),
        kind: "image",
        x,
        y,
        z,
        selected: true,
        outputId: resolved.outputId,
        sourceSurface: resolved.sourceSurface ?? null,
        mediaId: resolved.mediaId,
        src: resolved.src,
        srcStoragePath: resolved.srcStoragePath ?? null,
        alt: resolved.alt,
        width: width ?? CANVAS_IMAGE_ITEM_WIDTH,
        height: height ?? CANVAS_IMAGE_ITEM_HEIGHT,
      }
    : resolved.kind === "video"
      ? {
          id: (itemId ?? resolved.preferredItemId?.trim()) || randomId(),
          kind: "video",
          x,
          y,
          z,
          selected: true,
          outputId: resolved.outputId,
          sourceSurface: resolved.sourceSurface ?? null,
          mediaId: resolved.mediaId,
          videoUrl: resolved.videoUrl,
          videoStoragePath: resolved.videoStoragePath ?? null,
          posterUrl: resolved.posterUrl?.trim() || null,
          posterStoragePath: resolved.posterStoragePath ?? null,
          title: resolved.title?.trim() || null,
          durationMs: resolved.durationMs ?? null,
          width: width ?? CANVAS_IMAGE_ITEM_WIDTH,
          height: height ?? CANVAS_IMAGE_ITEM_HEIGHT,
        }
      : resolved.kind === "audio"
        ? {
            id: (itemId ?? resolved.preferredItemId?.trim()) || randomId(),
            kind: "audio",
            x,
            y,
            z,
            selected: true,
            outputId: resolved.outputId,
            sourceSurface: resolved.sourceSurface ?? null,
            mediaId: resolved.mediaId,
            audioUrl: resolved.audioUrl,
            audioStoragePath: resolved.audioStoragePath ?? null,
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
            id: (itemId ?? resolved.preferredItemId?.trim()) || randomId(),
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
  const [draftTextEntry, setDraftTextEntryState] = useState<CanvasDraftTextEntry | null>(null);
  const [textEditSession, setTextEditSession] = useState<CanvasTextEditSession | null>(null);
  const itemsRef = useRef<CanvasSceneItem[]>([]);
  const draftTextEntryRef = useRef<CanvasDraftTextEntry | null>(null);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const setDraftTextEntry = useCallback<Dispatch<SetStateAction<CanvasDraftTextEntry | null>>>(
    (nextDraft) => {
      const resolvedDraft =
        typeof nextDraft === "function"
          ? (
              nextDraft as (
                currentDraft: CanvasDraftTextEntry | null
              ) => CanvasDraftTextEntry | null
            )(draftTextEntryRef.current)
          : nextDraft;
      draftTextEntryRef.current = resolvedDraft;
      setDraftTextEntryState(resolvedDraft);
    },
    []
  );

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
  }, [setDraftTextEntry]);

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
    ): Promise<CanvasInsertResult> => {
      if (itemsRef.current.length >= AI_STUDIO_CANVAS_ITEM_HARD_CAP) {
        notifyItemLimitReached();
        return {
          status: "blocked_by_cap",
          resolved,
        };
      }

      const showLoadingPlaceholder = Boolean(options.showLoadingPlaceholder);
      const pendingId = showLoadingPlaceholder ? randomId() : null;
      const preResolvedImageDimensions =
        resolved.kind === "image" ? resolveCanvasImageDimensionsFromResolution(resolved) : null;
      const preResolvedVideoDimensions =
        resolved.kind === "video" ? resolveCanvasVideoDimensionsFromResolution(resolved) : null;
      const videoDimensions =
        resolved.kind === "video"
          ? (preResolvedVideoDimensions ?? (await resolveCanvasVideoDimensions(resolved)))
          : null;
      const audioDimensions =
        resolved.kind === "audio" ? resolveCanvasAudioDimensions(resolved) : null;
      const textDimensions =
        resolved.kind === "text"
          ? {
              width: CANVAS_TEXT_ITEM_WIDTH,
              height: CANVAS_TEXT_ITEM_MIN_HEIGHT,
            }
          : null;
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
              : (textDimensions?.width ?? CANVAS_TEXT_ITEM_WIDTH);
      const pendingHeight =
        resolved.kind === "image"
          ? (imageDimensions?.height ?? CANVAS_IMAGE_ITEM_HEIGHT)
          : resolved.kind === "video"
            ? (videoDimensions?.height ?? CANVAS_IMAGE_ITEM_HEIGHT)
            : resolved.kind === "audio"
              ? (audioDimensions?.height ?? CANVAS_AUDIO_ITEM_HEIGHT)
              : (textDimensions?.height ?? CANVAS_TEXT_ITEM_MIN_HEIGHT);
      const insertionPoint = resolveCanvasDropInsertionPoint({
        kind: resolved.kind,
        worldX,
        worldY,
        width: pendingWidth,
        height: pendingHeight,
      });

      if (pendingId) {
        setPendingItems((currentPendingItems) => [
          ...currentPendingItems,
          {
            id: pendingId,
            kind: resolved.kind,
            x: insertionPoint.x,
            y: insertionPoint.y,
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
        let insertedItemId: string | null = null;
        let reusedExistingItem = false;
        let previousItemSnapshot: CanvasSceneItem | null = null;
        const preferredItemId = resolved.preferredItemId?.trim() || null;
        const candidateItemId = preferredItemId || randomId();
        setItems((currentItems) => {
          if (currentItems.length >= AI_STUDIO_CANVAS_ITEM_HARD_CAP) {
            blockedByCap = true;
            return currentItems;
          }
          const highestZ = getHighestCanvasZIndex(currentItems) + 1;
          const nextItems = clearCanvasSceneSelection(currentItems);
          const builtItem = buildCanvasSceneItem({
            itemId: candidateItemId,
            resolved,
            x: insertionPoint.x,
            y: insertionPoint.y,
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
          });
          if (preferredItemId) {
            const existingIndex = nextItems.findIndex((item) => item.id === preferredItemId);
            if (existingIndex >= 0) {
              reusedExistingItem = true;
              insertedItemId = preferredItemId;
              previousItemSnapshot = nextItems[existingIndex] ?? null;
              const updatedItems = [...nextItems];
              updatedItems[existingIndex] = builtItem;
              return updatedItems;
            }
          }
          insertedItemId = builtItem.id;
          return [...nextItems, builtItem];
        });
        if (blockedByCap) {
          notifyItemLimitReached();
          return {
            status: "blocked_by_cap",
            resolved,
          };
        }
        const itemId = insertedItemId ?? candidateItemId;
        return {
          status: "inserted",
          itemId,
          reusedExistingItem,
          resolved,
          removeInsertedItem: () => {
            if (reusedExistingItem) {
              if (!previousItemSnapshot) return;
              setItems((currentItems) =>
                currentItems.map((item) =>
                  item.id === itemId ? (previousItemSnapshot ?? item) : item
                )
              );
              return;
            }
            setItems((currentItems) => deleteCanvasSceneItemById(currentItems, itemId));
          },
        };
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

  const commitDraftTextEntry = useCallback(
    (
      valueOverride?: string | null,
      draftOverride?: CanvasDraftTextEntry | null
    ): CanvasCommittedTextDraft | null => {
      const draft = draftOverride ?? draftTextEntryRef.current;
      const text = (valueOverride ?? draft?.value ?? "").trim();
      if (!draft || !text) {
        setDraftTextEntry(null);
        draftTextEntryRef.current = null;
        return null;
      }

      if (itemsRef.current.length >= AI_STUDIO_CANVAS_ITEM_HARD_CAP) {
        setDraftTextEntry(null);
        draftTextEntryRef.current = null;
        notifyItemLimitReached();
        return null;
      }

      const itemId = randomId();
      setItems((currentItems) => {
        if (currentItems.length >= AI_STUDIO_CANVAS_ITEM_HARD_CAP) {
          return currentItems;
        }
        const highestZ = getHighestCanvasZIndex(currentItems) + 1;
        const nextItems = clearCanvasSceneSelection(currentItems);
        return [
          ...nextItems,
          buildCanvasSceneItem({
            itemId,
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
      setDraftTextEntry(null);
      draftTextEntryRef.current = null;
      return {
        itemId,
        text,
      };
    },
    [notifyItemLimitReached, setDraftTextEntry]
  );

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
      setItems(next.items.map(normalizeCanvasSceneItemDimensions));
      setDraftTextEntry(next.draftTextEntry);
      setTextEditSession(next.textEditSession);
    },
    [setDraftTextEntry]
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
