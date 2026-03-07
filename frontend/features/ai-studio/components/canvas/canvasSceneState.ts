/**
 * Canvas shared scene state.
 * Owns scene items, pending placeholders, selection, and text draft/edit mutation flows.
 */
import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import { randomId } from "../../logic/ids";
import {
  CANVAS_IMAGE_ITEM_HEIGHT,
  CANVAS_IMAGE_ITEM_WIDTH,
  CANVAS_TEXT_ITEM_WIDTH,
  fitCanvasImageToProxyFrame,
} from "./canvasGeometry";
import type { CanvasDropResolution, CanvasSceneItem } from "./canvasTypes";

const CANVAS_TEXT_ITEM_HEIGHT = 120;
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
  setDraftTextEntry: Dispatch<SetStateAction<CanvasDraftTextEntry | null>>;
  setTextEditSession: Dispatch<SetStateAction<CanvasTextEditSession | null>>;
  clearSelection: () => void;
  clearDraftTextEntry: () => void;
  clearTextEditSession: () => void;
  deleteSelection: () => void;
  addResolvedItem: (
    resolved: CanvasDropResolution,
    worldX: number,
    worldY: number,
    options?: { showLoadingPlaceholder?: boolean }
  ) => Promise<void>;
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
      };

/**
 * Returns the shared scene store used by both canvas instances.
 */
export const useCanvasSharedSceneState = (): CanvasSharedSceneState => {
  const [items, setItems] = useState<CanvasSceneItem[]>([]);
  const [pendingItems, setPendingItems] = useState<CanvasPendingSceneItem[]>([]);
  const [draftTextEntry, setDraftTextEntry] = useState<CanvasDraftTextEntry | null>(null);
  const [textEditSession, setTextEditSession] = useState<CanvasTextEditSession | null>(null);

  const clearSelection = useCallback(() => {
    setItems((currentItems) => clearCanvasSceneSelection(currentItems));
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
      const showLoadingPlaceholder = Boolean(options.showLoadingPlaceholder);
      const pendingId = showLoadingPlaceholder ? randomId() : null;
      const preResolvedImageDimensions =
        resolved.kind === "image" ? resolveCanvasImageDimensionsFromResolution(resolved) : null;
      const imageDimensions =
        resolved.kind === "image"
          ? (preResolvedImageDimensions ?? (await resolveCanvasImageDimensions(resolved)))
          : null;
      const pendingWidth =
        resolved.kind === "image"
          ? (imageDimensions?.width ?? CANVAS_IMAGE_ITEM_WIDTH)
          : CANVAS_TEXT_ITEM_WIDTH;
      const pendingHeight =
        resolved.kind === "image"
          ? (imageDimensions?.height ?? CANVAS_IMAGE_ITEM_HEIGHT)
          : CANVAS_TEXT_ITEM_HEIGHT;
      const pendingX = Math.round((worldX - pendingWidth / 2) * 100) / 100;
      const pendingY =
        resolved.kind === "image"
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
        if (showLoadingPlaceholder && resolved.kind === "text") {
          await waitForNextAnimationFrame();
        }
        if (showLoadingPlaceholder && resolved.kind === "image" && !preResolvedImageDimensions) {
          await waitForNextAnimationFrame();
        }

        setItems((currentItems) => {
          const highestZ = getHighestCanvasZIndex(currentItems) + 1;
          const nextItems = clearCanvasSceneSelection(currentItems);
          const offsetX =
            resolved.kind === "image"
              ? (imageDimensions?.width ?? CANVAS_IMAGE_ITEM_WIDTH) / 2
              : CANVAS_TEXT_ITEM_WIDTH / 2;
          const offsetY =
            resolved.kind === "image"
              ? (imageDimensions?.height ?? CANVAS_IMAGE_ITEM_HEIGHT) / 2
              : 36;
          return [
            ...nextItems,
            buildCanvasSceneItem({
              resolved,
              x: Math.round((worldX - offsetX) * 100) / 100,
              y: Math.round((worldY - offsetY) * 100) / 100,
              z: highestZ,
              width: imageDimensions?.width,
              height: imageDimensions?.height,
            }),
          ];
        });
      } finally {
        if (pendingId) {
          setPendingItems((currentPendingItems) =>
            currentPendingItems.filter((item) => item.id !== pendingId)
          );
        }
      }
    },
    []
  );

  const commitDraftTextEntry = useCallback(() => {
    setDraftTextEntry((draft) => {
      const text = draft?.value.trim() ?? "";
      if (!draft || !text) return null;
      setItems((currentItems) => {
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
      return null;
    });
  }, []);

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

  return {
    items,
    pendingItems,
    draftTextEntry,
    textEditSession,
    setItems,
    setDraftTextEntry,
    setTextEditSession,
    clearSelection,
    clearDraftTextEntry,
    clearTextEditSession,
    deleteSelection,
    addResolvedItem,
    commitDraftTextEntry,
    commitTextItemEdit,
  };
};
