/**
 * Page-scoped state controller for the AI Studio Canvas workspace.
 * Owns ephemeral scene state, camera transforms, drop intake, and pointer interactions.
 */
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
  type WheelEvent,
} from "react";
import { randomId } from "../../logic/ids";
import {
  extractInternalReferenceDragPayload,
  type InternalReferenceDragPayload,
} from "../../utils/dragDrop";
import {
  CANVAS_DEFAULT_CAMERA,
  CANVAS_IMAGE_ITEM_HEIGHT,
  CANVAS_IMAGE_ITEM_WIDTH,
  CANVAS_TEXT_ITEM_WIDTH,
  fitCanvasImageToProxyFrame,
  resolveCanvasWheelZoomDelta,
  viewportPointToCanvasWorld,
  zoomCanvasCameraAtViewportPoint,
} from "./canvasGeometry";
import type {
  CanvasCamera,
  CanvasDropResolution,
  CanvasSceneItem,
  ResolveCanvasDropReference,
} from "./canvasTypes";

type CanvasDropSession =
  | { kind: "none" }
  | {
      kind: "item-drag";
      pointerId: number;
      itemId: string;
      lastClientX: number;
      lastClientY: number;
    }
  | {
      kind: "pan";
      pointerId: number;
      cameraX: number;
      cameraY: number;
      startClientX: number;
      startClientY: number;
    };

export type CanvasPropertiesPanelProps = {
  camera: CanvasCamera;
  items: CanvasSceneItem[];
  viewportRef: RefObject<HTMLDivElement>;
  isDropActive: boolean;
  draftTextEntry: { x: number; y: number; value: string } | null;
  editingTextItemId: string | null;
  editingTextValue: string;
  onViewportKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  onViewportDoubleClick: (event: MouseEvent<HTMLDivElement>) => void;
  onViewportPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onViewportPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onViewportPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
  onViewportPointerCancel: (event: PointerEvent<HTMLDivElement>) => void;
  onViewportDragEnter: (event: DragEvent<HTMLDivElement>) => void;
  onViewportDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onViewportDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  onViewportDrop: (event: DragEvent<HTMLDivElement>) => void;
  onViewportWheel: (event: WheelEvent<HTMLDivElement>) => void;
  onItemPointerDown: (id: string, event: PointerEvent<HTMLElement>) => void;
  onItemPointerMove: (id: string, event: PointerEvent<HTMLElement>) => void;
  onItemPointerUp: (id: string, event: PointerEvent<HTMLElement>) => void;
  onItemPointerCancel: (id: string, event: PointerEvent<HTMLElement>) => void;
  onItemContextMenu: (id: string, event: MouseEvent<HTMLElement>) => void;
  onItemDoubleClick: (id: string, event: MouseEvent<HTMLElement>) => void;
  onPinTextItem: (id: string) => void;
  onDraftTextChange: (value: string) => void;
  onDraftTextKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onDraftTextBlur: () => void;
  onTextItemEditChange: (value: string) => void;
  onTextItemEditKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onTextItemEditBlur: () => void;
};

const DRAG_TEXT_HINT_PATTERN =
  /^text\/(?:plain|prompt|x-moz-url|html|uri-list)|application\/json$/i;

const getHighestCanvasZIndex = (items: CanvasSceneItem[]): number =>
  items.reduce((highest, item) => Math.max(highest, item.z), 0);

const clearCanvasSelection = (items: CanvasSceneItem[]): CanvasSceneItem[] => {
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

const deleteSelectedCanvasItems = (items: CanvasSceneItem[]): CanvasSceneItem[] => {
  const nextItems = items.filter((item) => !item.selected);
  return nextItems.length === items.length ? items : nextItems;
};

const deleteCanvasItemById = (items: CanvasSceneItem[], itemId: string): CanvasSceneItem[] => {
  const nextItems = items.filter((item) => item.id !== itemId);
  return nextItems.length === items.length ? items : nextItems;
};

const selectCanvasItem = (items: CanvasSceneItem[], itemId: string): CanvasSceneItem[] => {
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

const canAcceptCanvasDrop = (transfer: DataTransfer | null | undefined): boolean => {
  if (!transfer) return false;
  if (extractInternalReferenceDragPayload(transfer)) return true;
  return Array.from(transfer.types || []).some((type) => DRAG_TEXT_HINT_PATTERN.test(type));
};

const normalizeDroppedText = (transfer: DataTransfer): string | null => {
  const text = (
    transfer.getData("text/prompt") ||
    transfer.getData("text/plain") ||
    transfer.getData("text")
  ).trim();
  return text.length ? text : null;
};

const resolveDropClientPoint = ({
  clientX,
  clientY,
  rect,
}: {
  clientX: number;
  clientY: number;
  rect: DOMRect;
}): { clientX: number; clientY: number } => ({
  clientX: Number.isFinite(clientX) ? clientX : rect.left + rect.width / 2,
  clientY: Number.isFinite(clientY) ? clientY : rect.top + rect.height / 2,
});

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
 * Returns the Canvas workspace state and handlers used by the panel renderer.
 */
export const useAiStudioCanvasWorkspaceState = ({
  resolveCanvasDropReference,
  onPinTextReference,
}: {
  resolveCanvasDropReference?: ResolveCanvasDropReference;
  onPinTextReference?: (text: string) => void;
} = {}): CanvasPropertiesPanelProps => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const interactionRef = useRef<CanvasDropSession>({ kind: "none" });
  const dragDepthRef = useRef(0);
  const [camera, setCamera] = useState<CanvasCamera>(CANVAS_DEFAULT_CAMERA);
  const [items, setItems] = useState<CanvasSceneItem[]>([]);
  const [isDropActive, setIsDropActive] = useState(false);
  const [draftTextEntry, setDraftTextEntry] = useState<{
    x: number;
    y: number;
    value: string;
  } | null>(null);
  const [textEditSession, setTextEditSession] = useState<{ itemId: string; value: string } | null>(
    null
  );

  const clearSelection = useCallback(() => {
    setItems((currentItems) => clearCanvasSelection(currentItems));
  }, []);

  const clearDraftTextEntry = useCallback(() => {
    setDraftTextEntry(null);
  }, []);

  const clearTextEditSession = useCallback(() => {
    setTextEditSession(null);
  }, []);

  const deleteSelection = useCallback(() => {
    setItems((currentItems) => deleteSelectedCanvasItems(currentItems));
    setTextEditSession(null);
  }, []);

  const addResolvedItem = useCallback(
    async (resolved: CanvasDropResolution, worldX: number, worldY: number) => {
      const dimensions =
        resolved.kind === "image" ? await resolveCanvasImageDimensions(resolved) : null;
      setItems((currentItems) => {
        const highestZ = getHighestCanvasZIndex(currentItems) + 1;
        const nextItems = clearCanvasSelection(currentItems);
        const offsetX =
          resolved.kind === "image"
            ? (dimensions?.width ?? CANVAS_IMAGE_ITEM_WIDTH) / 2
            : CANVAS_TEXT_ITEM_WIDTH / 2;
        const offsetY =
          resolved.kind === "image" ? (dimensions?.height ?? CANVAS_IMAGE_ITEM_HEIGHT) / 2 : 36;
        return [
          ...nextItems,
          buildCanvasSceneItem({
            resolved,
            x: Math.round((worldX - offsetX) * 100) / 100,
            y: Math.round((worldY - offsetY) * 100) / 100,
            z: highestZ,
            width: dimensions?.width,
            height: dimensions?.height,
          }),
        ];
      });
    },
    []
  );

  const commitDraftTextEntry = useCallback(() => {
    setDraftTextEntry((draft) => {
      const text = draft?.value.trim() ?? "";
      if (!draft || !text) return null;
      setItems((currentItems) => {
        const highestZ = getHighestCanvasZIndex(currentItems) + 1;
        const nextItems = clearCanvasSelection(currentItems);
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

  const handleResolvedInternalDrop = useCallback(
    async (
      payload: InternalReferenceDragPayload,
      clientX: number,
      clientY: number
    ): Promise<boolean> => {
      if (!resolveCanvasDropReference || !viewportRef.current) return false;
      const resolved = resolveCanvasDropReference(payload);
      if (!resolved) return false;
      const rect = viewportRef.current.getBoundingClientRect();
      const normalizedPoint = resolveDropClientPoint({ clientX, clientY, rect });
      const point = viewportPointToCanvasWorld({
        clientX: normalizedPoint.clientX,
        clientY: normalizedPoint.clientY,
        rect,
        camera,
      });
      await addResolvedItem(resolved, point.x, point.y);
      return true;
    },
    [addResolvedItem, camera, resolveCanvasDropReference]
  );

  const handleViewportPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      clearSelection();
      clearDraftTextEntry();
      clearTextEditSession();
      event.currentTarget.focus();
      if (typeof event.currentTarget.setPointerCapture === "function") {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      interactionRef.current = {
        kind: "pan",
        pointerId: event.pointerId,
        cameraX: camera.x,
        cameraY: camera.y,
        startClientX: event.clientX,
        startClientY: event.clientY,
      };
    },
    [camera.x, camera.y, clearDraftTextEntry, clearSelection, clearTextEditSession]
  );

  const handleViewportDoubleClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (!viewportRef.current) return;
      const rect = viewportRef.current.getBoundingClientRect();
      const normalizedPoint = resolveDropClientPoint({
        clientX: event.clientX,
        clientY: event.clientY,
        rect,
      });
      const point = viewportPointToCanvasWorld({
        clientX: normalizedPoint.clientX,
        clientY: normalizedPoint.clientY,
        rect,
        camera,
      });
      clearSelection();
      clearTextEditSession();
      setDraftTextEntry({
        x: Math.round((point.x - CANVAS_TEXT_ITEM_WIDTH / 2) * 100) / 100,
        y: Math.round((point.y - 36) * 100) / 100,
        value: "",
      });
    },
    [camera, clearSelection, clearTextEditSession]
  );

  const handleViewportPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const interaction = interactionRef.current;
    if (interaction.kind !== "pan" || interaction.pointerId !== event.pointerId) return;
    setCamera((currentCamera) => ({
      ...currentCamera,
      x: Math.round((interaction.cameraX + event.clientX - interaction.startClientX) * 100) / 100,
      y: Math.round((interaction.cameraY + event.clientY - interaction.startClientY) * 100) / 100,
    }));
  }, []);

  const handleViewportPointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const interaction = interactionRef.current;
    if (interaction.kind === "pan" && interaction.pointerId === event.pointerId) {
      interactionRef.current = { kind: "none" };
      if (typeof event.currentTarget.releasePointerCapture === "function") {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }
  }, []);

  const handleViewportPointerCancel = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const interaction = interactionRef.current;
    if (interaction.kind === "pan" && interaction.pointerId === event.pointerId) {
      interactionRef.current = { kind: "none" };
      if (typeof event.currentTarget.releasePointerCapture === "function") {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }
  }, []);

  const handleItemPointerDown = useCallback(
    (itemId: string, event: PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      if (textEditSession?.itemId === itemId) return;
      event.preventDefault();
      event.stopPropagation();
      clearTextEditSession();
      viewportRef.current?.focus();
      if (typeof event.currentTarget.setPointerCapture === "function") {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      setItems((currentItems) => {
        const selectedItems = selectCanvasItem(currentItems, itemId);
        const draggedItem = selectedItems.find((item) => item.id === itemId);
        interactionRef.current = {
          kind: "item-drag",
          pointerId: event.pointerId,
          itemId,
          lastClientX: event.clientX,
          lastClientY: event.clientY,
        };
        return selectedItems;
      });
    },
    [clearTextEditSession, textEditSession?.itemId]
  );

  const handleItemPointerMove = useCallback(
    (itemId: string, event: PointerEvent<HTMLElement>) => {
      const interaction = interactionRef.current;
      if (
        interaction.kind !== "item-drag" ||
        interaction.pointerId !== event.pointerId ||
        interaction.itemId !== itemId
      ) {
        return;
      }
      const deltaX = (event.clientX - interaction.lastClientX) / camera.zoom;
      const deltaY = (event.clientY - interaction.lastClientY) / camera.zoom;
      if (!deltaX && !deltaY) return;
      interactionRef.current = {
        ...interaction,
        lastClientX: event.clientX,
        lastClientY: event.clientY,
      };
      setItems((currentItems) =>
        currentItems.map((item) =>
          item.id === itemId
            ? {
                ...item,
                x: Math.round((item.x + deltaX) * 100) / 100,
                y: Math.round((item.y + deltaY) * 100) / 100,
              }
            : item
        )
      );
    },
    [camera.zoom]
  );

  const handleItemPointerUp = useCallback((itemId: string, event: PointerEvent<HTMLElement>) => {
    const interaction = interactionRef.current;
    if (
      interaction.kind === "item-drag" &&
      interaction.pointerId === event.pointerId &&
      interaction.itemId === itemId
    ) {
      interactionRef.current = { kind: "none" };
      if (typeof event.currentTarget.releasePointerCapture === "function") {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }
  }, []);

  const handleItemPointerCancel = useCallback(
    (itemId: string, event: PointerEvent<HTMLElement>) => {
      const interaction = interactionRef.current;
      if (
        interaction.kind === "item-drag" &&
        interaction.pointerId === event.pointerId &&
        interaction.itemId === itemId
      ) {
        interactionRef.current = { kind: "none" };
        if (typeof event.currentTarget.releasePointerCapture === "function") {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }
    },
    []
  );

  const handleViewportDragEnter = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (!canAcceptCanvasDrop(event.dataTransfer)) return;
    event.preventDefault();
    dragDepthRef.current += 1;
    setIsDropActive(true);
  }, []);

  const handleViewportDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!canAcceptCanvasDrop(event.dataTransfer)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      if (!isDropActive) {
        setIsDropActive(true);
      }
    },
    [isDropActive]
  );

  const handleViewportDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (!canAcceptCanvasDrop(event.dataTransfer)) return;
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDropActive(false);
    }
  }, []);

  const handleViewportDrop = useCallback(
    async (event: DragEvent<HTMLDivElement>) => {
      dragDepthRef.current = 0;
      setIsDropActive(false);
      const internalPayload = extractInternalReferenceDragPayload(event.dataTransfer);
      if (internalPayload) {
        const didHandle = await handleResolvedInternalDrop(
          internalPayload,
          event.clientX,
          event.clientY
        );
        if (didHandle) {
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }
      const droppedText = normalizeDroppedText(event.dataTransfer);
      if (!droppedText || !viewportRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      const rect = viewportRef.current.getBoundingClientRect();
      const normalizedPoint = resolveDropClientPoint({
        clientX: event.clientX,
        clientY: event.clientY,
        rect,
      });
      const point = viewportPointToCanvasWorld({
        clientX: normalizedPoint.clientX,
        clientY: normalizedPoint.clientY,
        rect,
        camera,
      });
      void addResolvedItem(
        {
          kind: "text",
          outputId: null,
          text: droppedText,
        },
        point.x,
        point.y
      );
    },
    [addResolvedItem, camera, handleResolvedInternalDrop]
  );

  const handleViewportWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    if (!viewportRef.current) return;
    event.preventDefault();
    const rect = viewportRef.current.getBoundingClientRect();
    const delta = resolveCanvasWheelZoomDelta({
      deltaY: event.deltaY,
      deltaMode: event.deltaMode,
    });
    if (!delta) return;
    setCamera((currentCamera) =>
      zoomCanvasCameraAtViewportPoint({
        camera: currentCamera,
        clientX: event.clientX,
        clientY: event.clientY,
        rect,
        nextZoom: currentCamera.zoom + delta,
      })
    );
  }, []);

  const handleViewportKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (draftTextEntry || textEditSession) return;
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      event.preventDefault();
      deleteSelection();
    },
    [deleteSelection, draftTextEntry, textEditSession]
  );

  const handleDraftTextChange = useCallback((value: string) => {
    setDraftTextEntry((currentDraft) =>
      currentDraft
        ? {
            ...currentDraft,
            value,
          }
        : currentDraft
    );
  }, []);

  const handleDraftTextKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commitDraftTextEntry();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        clearDraftTextEntry();
      }
    },
    [clearDraftTextEntry, commitDraftTextEntry]
  );

  const handleItemDoubleClick = useCallback(
    (id: string, event: MouseEvent<HTMLElement>) => {
      event.stopPropagation();
      const item = items.find((candidate) => candidate.id === id);
      if (!item || item.kind !== "text") return;
      clearDraftTextEntry();
      setItems((currentItems) => selectCanvasItem(currentItems, id));
      setTextEditSession({
        itemId: id,
        value: item.text,
      });
    },
    [clearDraftTextEntry, items]
  );

  const handleItemContextMenu = useCallback((id: string, event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setItems((currentItems) => deleteCanvasItemById(currentItems, id));
    setTextEditSession((currentSession) => (currentSession?.itemId === id ? null : currentSession));
  }, []);

  const handleTextItemEditChange = useCallback((value: string) => {
    setTextEditSession((currentSession) =>
      currentSession
        ? {
            ...currentSession,
            value,
          }
        : currentSession
    );
  }, []);

  const handleTextItemEditKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commitTextItemEdit();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        clearTextEditSession();
      }
    },
    [clearTextEditSession, commitTextItemEdit]
  );

  const handleTextItemEditBlur = useCallback(() => {
    commitTextItemEdit();
  }, [commitTextItemEdit]);

  const handlePinTextItem = useCallback(
    (id: string) => {
      if (!onPinTextReference) return;
      const item = items.find((candidate) => candidate.id === id);
      if (!item || item.kind !== "text") return;
      if (!item.text.trim()) return;
      onPinTextReference(item.text);
    },
    [items, onPinTextReference]
  );

  return useMemo(
    () => ({
      camera,
      items,
      viewportRef,
      isDropActive,
      draftTextEntry,
      editingTextItemId: textEditSession?.itemId ?? null,
      editingTextValue: textEditSession?.value ?? "",
      onViewportKeyDown: handleViewportKeyDown,
      onViewportDoubleClick: handleViewportDoubleClick,
      onViewportPointerDown: handleViewportPointerDown,
      onViewportPointerMove: handleViewportPointerMove,
      onViewportPointerUp: handleViewportPointerUp,
      onViewportPointerCancel: handleViewportPointerCancel,
      onViewportDragEnter: handleViewportDragEnter,
      onViewportDragOver: handleViewportDragOver,
      onViewportDragLeave: handleViewportDragLeave,
      onViewportDrop: handleViewportDrop,
      onViewportWheel: handleViewportWheel,
      onItemPointerDown: handleItemPointerDown,
      onItemPointerMove: handleItemPointerMove,
      onItemPointerUp: handleItemPointerUp,
      onItemPointerCancel: handleItemPointerCancel,
      onItemContextMenu: handleItemContextMenu,
      onItemDoubleClick: handleItemDoubleClick,
      onPinTextItem: handlePinTextItem,
      onDraftTextChange: handleDraftTextChange,
      onDraftTextKeyDown: handleDraftTextKeyDown,
      onDraftTextBlur: clearDraftTextEntry,
      onTextItemEditChange: handleTextItemEditChange,
      onTextItemEditKeyDown: handleTextItemEditKeyDown,
      onTextItemEditBlur: handleTextItemEditBlur,
    }),
    [
      camera,
      clearDraftTextEntry,
      draftTextEntry,
      handleItemDoubleClick,
      handleDraftTextChange,
      handleDraftTextKeyDown,
      handleItemPointerCancel,
      handleItemPointerDown,
      handleItemPointerMove,
      handleItemPointerUp,
      handleItemContextMenu,
      handlePinTextItem,
      handleViewportDoubleClick,
      handleViewportKeyDown,
      handleViewportDragEnter,
      handleViewportDragLeave,
      handleViewportDragOver,
      handleViewportDrop,
      handleViewportPointerCancel,
      handleViewportPointerDown,
      handleViewportPointerMove,
      handleViewportPointerUp,
      handleViewportWheel,
      handleTextItemEditBlur,
      handleTextItemEditChange,
      handleTextItemEditKeyDown,
      isDropActive,
      items,
      textEditSession,
    ]
  );
};
