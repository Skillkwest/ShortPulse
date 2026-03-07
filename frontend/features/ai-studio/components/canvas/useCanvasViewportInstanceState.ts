/**
 * Per-viewport Canvas controller that owns camera state and pointer/drop interactions.
 */
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type MutableRefObject,
  type MouseEvent,
  type PointerEvent,
  type WheelEvent,
} from "react";
import {
  extractInternalReferenceDragPayload,
  type InternalReferenceDragPayload,
} from "../../utils/dragDrop";
import {
  canAcceptCanvasDropTransfer,
  extractCanvasDroppedText,
  resolveCanvasDropClientPoint,
} from "./canvasDropController";
import {
  CANVAS_DEFAULT_CAMERA,
  CANVAS_TEXT_ITEM_WIDTH,
  resolveCanvasWheelZoomDelta,
  viewportPointToCanvasWorld,
  zoomCanvasCameraAtViewportPoint,
} from "./canvasGeometry";
import {
  shouldCreateDraftFromPointerDetail,
  shouldSuppressDraftCreation,
  resolveViewportTapState,
  type CanvasInteractionPoint,
} from "./canvasInteractionController";
import {
  deleteCanvasSceneItemById,
  selectCanvasSceneItem,
  type CanvasSharedSceneState,
} from "./canvasSceneState";
import type { ResolveCanvasDropReference } from "./canvasTypes";
import type {
  CanvasPropertiesPanelProps,
  CanvasWorkspaceInstanceId,
} from "./canvasWorkspaceContracts";

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

const shouldStartPanFromPointerDown = ({
  button,
  isSpacePanActive,
}: {
  button: number;
  isSpacePanActive: boolean;
}): boolean => button === 1 || (button === 0 && isSpacePanActive);

type UseCanvasViewportInstanceStateParams = {
  instanceId: CanvasWorkspaceInstanceId;
  sharedScene: CanvasSharedSceneState;
  resolveCanvasDropReference?: ResolveCanvasDropReference;
  onPinTextReference?: (text: string) => void;
  isSpacePanActiveRef: MutableRefObject<boolean>;
};

/**
 * Builds a single Canvas viewport contract over shared scene state.
 */
export const useCanvasViewportInstanceState = ({
  instanceId,
  sharedScene,
  resolveCanvasDropReference,
  onPinTextReference,
  isSpacePanActiveRef,
}: UseCanvasViewportInstanceStateParams): CanvasPropertiesPanelProps => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const interactionRef = useRef<CanvasDropSession>({ kind: "none" });
  const dragDepthRef = useRef(0);
  const lastViewportTapRef = useRef<CanvasInteractionPoint | null>(null);
  const lastViewportDraftCreationRef = useRef<CanvasInteractionPoint | null>(null);
  const [camera, setCamera] = useState(CANVAS_DEFAULT_CAMERA);
  const [isDropActive, setIsDropActive] = useState(false);

  const {
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
  } = sharedScene;

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
      const normalizedPoint = resolveCanvasDropClientPoint({ clientX, clientY, rect });
      const point = viewportPointToCanvasWorld({
        clientX: normalizedPoint.clientX,
        clientY: normalizedPoint.clientY,
        rect,
        camera,
      });
      await addResolvedItem(resolved, point.x, point.y, {
        showLoadingPlaceholder: true,
      });
      return true;
    },
    [addResolvedItem, camera, resolveCanvasDropReference]
  );

  const createDraftTextAtClientPoint = useCallback(
    (clientX: number, clientY: number) => {
      if (!viewportRef.current) return;
      const rect = viewportRef.current.getBoundingClientRect();
      const normalizedPoint = resolveCanvasDropClientPoint({
        clientX,
        clientY,
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
    [camera, clearSelection, clearTextEditSession, setDraftTextEntry]
  );

  const handleViewportPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (
        shouldCreateDraftFromPointerDetail({
          button: event.button,
          detail: event.detail,
          isSpacePanActive: isSpacePanActiveRef.current,
        })
      ) {
        event.preventDefault();
        event.stopPropagation();
        interactionRef.current = { kind: "none" };
        lastViewportTapRef.current = null;
        lastViewportDraftCreationRef.current = {
          timeStamp: event.timeStamp,
          clientX: event.clientX,
          clientY: event.clientY,
        };
        createDraftTextAtClientPoint(event.clientX, event.clientY);
        return;
      }

      const shouldPan =
        event.button === 0 ||
        shouldStartPanFromPointerDown({
          button: event.button,
          isSpacePanActive: isSpacePanActiveRef.current,
        });
      if (!shouldPan) return;
      event.preventDefault();
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
    [
      camera.x,
      camera.y,
      clearDraftTextEntry,
      clearSelection,
      clearTextEditSession,
      createDraftTextAtClientPoint,
      isSpacePanActiveRef,
    ]
  );

  const handleViewportDoubleClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const nextPoint = {
        timeStamp: event.timeStamp,
        clientX: event.clientX,
        clientY: event.clientY,
      };
      if (
        shouldSuppressDraftCreation({
          lastCreation: lastViewportDraftCreationRef.current,
          nextPoint,
        })
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      lastViewportTapRef.current = null;
      lastViewportDraftCreationRef.current = nextPoint;
      createDraftTextAtClientPoint(event.clientX, event.clientY);
    },
    [createDraftTextAtClientPoint]
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

  const handleViewportPointerUp = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const interaction = interactionRef.current;
      if (interaction.kind === "pan" && interaction.pointerId === event.pointerId) {
        const currentTap = {
          timeStamp: event.timeStamp,
          clientX: event.clientX,
          clientY: event.clientY,
        };
        const travelDistance = Math.hypot(
          event.clientX - interaction.startClientX,
          event.clientY - interaction.startClientY
        );
        const tapResolution = resolveViewportTapState({
          previousTap: lastViewportTapRef.current,
          nextTap: currentTap,
          isSpacePanActive: isSpacePanActiveRef.current,
          travelDistance,
        });
        lastViewportTapRef.current = tapResolution.nextStoredTap;
        if (tapResolution.shouldCreateDraft) {
          lastViewportDraftCreationRef.current = currentTap;
          createDraftTextAtClientPoint(event.clientX, event.clientY);
        }
        interactionRef.current = { kind: "none" };
        if (typeof event.currentTarget.releasePointerCapture === "function") {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }
    },
    [createDraftTextAtClientPoint, isSpacePanActiveRef]
  );

  const handleViewportPointerCancel = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const interaction = interactionRef.current;
    if (interaction.kind === "pan" && interaction.pointerId === event.pointerId) {
      lastViewportTapRef.current = null;
      interactionRef.current = { kind: "none" };
      if (typeof event.currentTarget.releasePointerCapture === "function") {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }
  }, []);

  const handleItemPointerDown = useCallback(
    (itemId: string, event: PointerEvent<HTMLElement>) => {
      const shouldPan = shouldStartPanFromPointerDown({
        button: event.button,
        isSpacePanActive: isSpacePanActiveRef.current,
      });
      if (!shouldPan && event.button !== 0) return;
      if (textEditSession?.itemId === itemId && !shouldPan) return;
      event.preventDefault();
      event.stopPropagation();
      clearTextEditSession();
      viewportRef.current?.focus();
      if (typeof event.currentTarget.setPointerCapture === "function") {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      if (shouldPan) {
        interactionRef.current = {
          kind: "pan",
          pointerId: event.pointerId,
          cameraX: camera.x,
          cameraY: camera.y,
          startClientX: event.clientX,
          startClientY: event.clientY,
        };
        return;
      }
      setItems((currentItems) => {
        const selectedItems = selectCanvasSceneItem(currentItems, itemId);
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
    [
      camera.x,
      camera.y,
      clearTextEditSession,
      isSpacePanActiveRef,
      setItems,
      textEditSession?.itemId,
    ]
  );

  const handleItemPointerMove = useCallback(
    (itemId: string, event: PointerEvent<HTMLElement>) => {
      const interaction = interactionRef.current;
      if (interaction.kind === "pan" && interaction.pointerId === event.pointerId) {
        setCamera((currentCamera) => ({
          ...currentCamera,
          x:
            Math.round((interaction.cameraX + event.clientX - interaction.startClientX) * 100) /
            100,
          y:
            Math.round((interaction.cameraY + event.clientY - interaction.startClientY) * 100) /
            100,
        }));
        return;
      }
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
    [camera.zoom, setItems]
  );

  const handleItemPointerUp = useCallback((itemId: string, event: PointerEvent<HTMLElement>) => {
    const interaction = interactionRef.current;
    const isMatchingPanInteraction =
      interaction.kind === "pan" && interaction.pointerId === event.pointerId;
    const isMatchingDragInteraction =
      interaction.kind === "item-drag" &&
      interaction.pointerId === event.pointerId &&
      interaction.itemId === itemId;
    if (isMatchingPanInteraction || isMatchingDragInteraction) {
      interactionRef.current = { kind: "none" };
      if (typeof event.currentTarget.releasePointerCapture === "function") {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }
  }, []);

  const handleItemPointerCancel = useCallback(
    (itemId: string, event: PointerEvent<HTMLElement>) => {
      const interaction = interactionRef.current;
      const isMatchingPanInteraction =
        interaction.kind === "pan" && interaction.pointerId === event.pointerId;
      const isMatchingDragInteraction =
        interaction.kind === "item-drag" &&
        interaction.pointerId === event.pointerId &&
        interaction.itemId === itemId;
      if (isMatchingPanInteraction || isMatchingDragInteraction) {
        interactionRef.current = { kind: "none" };
        if (typeof event.currentTarget.releasePointerCapture === "function") {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }
    },
    []
  );

  const handleViewportDragEnter = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (!canAcceptCanvasDropTransfer(event.dataTransfer)) return;
    event.preventDefault();
    dragDepthRef.current += 1;
    setIsDropActive(true);
  }, []);

  const handleViewportDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!canAcceptCanvasDropTransfer(event.dataTransfer)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      if (!isDropActive) {
        setIsDropActive(true);
      }
    },
    [isDropActive]
  );

  const handleViewportDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (!canAcceptCanvasDropTransfer(event.dataTransfer)) return;
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
        event.preventDefault();
        event.stopPropagation();
        void handleResolvedInternalDrop(internalPayload, event.clientX, event.clientY);
        return;
      }
      const droppedText = extractCanvasDroppedText(event.dataTransfer);
      if (!droppedText || !viewportRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      const rect = viewportRef.current.getBoundingClientRect();
      const normalizedPoint = resolveCanvasDropClientPoint({
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
        point.y,
        {
          showLoadingPlaceholder: true,
        }
      );
    },
    [addResolvedItem, camera, handleResolvedInternalDrop]
  );

  const handleViewportWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    if (!viewportRef.current) return;
    event.preventDefault();
    event.stopPropagation();
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

  const handleDraftTextChange = useCallback(
    (value: string) => {
      setDraftTextEntry((currentDraft) =>
        currentDraft
          ? {
              ...currentDraft,
              value,
            }
          : currentDraft
      );
    },
    [setDraftTextEntry]
  );

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
      setItems((currentItems) => selectCanvasSceneItem(currentItems, id));
      setTextEditSession({
        itemId: id,
        value: item.text,
      });
    },
    [clearDraftTextEntry, items, setItems, setTextEditSession]
  );

  const handleItemContextMenu = useCallback(
    (id: string, event: MouseEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setItems((currentItems) => deleteCanvasSceneItemById(currentItems, id));
      setTextEditSession((currentSession) =>
        currentSession?.itemId === id ? null : currentSession
      );
    },
    [setItems, setTextEditSession]
  );

  const handleTextItemEditChange = useCallback(
    (value: string) => {
      setTextEditSession((currentSession) =>
        currentSession
          ? {
              ...currentSession,
              value,
            }
          : currentSession
      );
    },
    [setTextEditSession]
  );

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
      instanceId,
      camera,
      items,
      pendingItems,
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
      handleDraftTextChange,
      handleDraftTextKeyDown,
      handleItemContextMenu,
      handleItemDoubleClick,
      handleItemPointerCancel,
      handleItemPointerDown,
      handleItemPointerMove,
      handleItemPointerUp,
      handlePinTextItem,
      handleTextItemEditBlur,
      handleTextItemEditChange,
      handleTextItemEditKeyDown,
      handleViewportDoubleClick,
      handleViewportDragEnter,
      handleViewportDragLeave,
      handleViewportDragOver,
      handleViewportDrop,
      handleViewportKeyDown,
      handleViewportPointerCancel,
      handleViewportPointerDown,
      handleViewportPointerMove,
      handleViewportPointerUp,
      handleViewportWheel,
      instanceId,
      isDropActive,
      items,
      pendingItems,
      textEditSession,
    ]
  );
};
