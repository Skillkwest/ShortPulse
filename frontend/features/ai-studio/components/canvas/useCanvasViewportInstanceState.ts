/**
 * Per-viewport Canvas controller that owns camera state and pointer/drop interactions.
 */
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type MouseEvent,
  type PointerEvent,
  type SetStateAction,
  type WheelEvent,
} from "react";
import {
  CANVAS_DEFAULT_CAMERA,
  CANVAS_TEXT_ITEM_WIDTH,
  resolveCanvasWheelZoomDelta,
  viewportPointToCanvasWorld,
  zoomCanvasCameraAtViewportPoint,
} from "./canvasGeometry";
import { resolveCanvasDropClientPoint } from "./canvasDropController";
import {
  CANVAS_DOUBLE_TAP_MAX_DISTANCE_PX,
  shouldCreateDraftFromPointerDetail,
  shouldSuppressDraftCreation,
  resolveViewportTapState,
  type CanvasInteractionPoint,
} from "./canvasInteractionController";
import { selectCanvasSceneItem, type CanvasSharedSceneState } from "./canvasSceneState";
import type { ResolveCanvasDropReference } from "./canvasTypes";
import {
  shouldStartCanvasPanFromPointerDown,
  type CanvasPointerSession,
} from "./canvasViewportPointerTypes";
import type {
  CanvasPropertiesPanelProps,
  CanvasWorkspaceInstanceId,
} from "./canvasWorkspaceContracts";
import { useCanvasViewportDropHandlers } from "./useCanvasViewportDropHandlers";
import { useCanvasViewportTextHandlers } from "./useCanvasViewportTextHandlers";

const VIEWPORT_PAN_ACTIVATION_DISTANCE_PX = 6;

const setPointerCaptureIfAvailable = ({
  target,
  pointerId,
}: {
  target: HTMLElement;
  pointerId: number;
}) => {
  if (typeof target.setPointerCapture !== "function") return;
  try {
    target.setPointerCapture(pointerId);
  } catch {
    // Ignore sporadic pointer-capture errors during rapid gesture transitions.
  }
};

const releasePointerCaptureIfHeld = ({
  target,
  pointerId,
}: {
  target: HTMLElement;
  pointerId: number;
}) => {
  if (typeof target.releasePointerCapture !== "function") return;
  if (typeof target.hasPointerCapture === "function" && !target.hasPointerCapture(pointerId)) {
    return;
  }
  try {
    target.releasePointerCapture(pointerId);
  } catch {
    // Ignore release errors if capture was already lost.
  }
};

type UseCanvasViewportInstanceStateParams = {
  instanceId: CanvasWorkspaceInstanceId;
  sharedScene: CanvasSharedSceneState;
  resolveCanvasDropReference?: ResolveCanvasDropReference;
  onPinTextReference?: (text: string) => void;
  isSpacePanActiveRef: MutableRefObject<boolean>;
  draftOwnerInstanceId: CanvasWorkspaceInstanceId | null;
  textEditOwnerInstanceId: CanvasWorkspaceInstanceId | null;
  setDraftOwnerInstanceId: Dispatch<SetStateAction<CanvasWorkspaceInstanceId | null>>;
  setTextEditOwnerInstanceId: Dispatch<SetStateAction<CanvasWorkspaceInstanceId | null>>;
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
  draftOwnerInstanceId,
  textEditOwnerInstanceId,
  setDraftOwnerInstanceId,
  setTextEditOwnerInstanceId,
}: UseCanvasViewportInstanceStateParams): CanvasPropertiesPanelProps => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const interactionRef = useRef<CanvasPointerSession>({ kind: "none" });
  const lastViewportTapRef = useRef<CanvasInteractionPoint | null>(null);
  const lastViewportDraftCreationRef = useRef<CanvasInteractionPoint | null>(null);
  const [camera, setCamera] = useState(CANVAS_DEFAULT_CAMERA);
  const {
    items,
    pendingItems,
    draftTextEntry,
    textEditSession,
    setItems,
    setDraftTextEntry,
    setTextEditSession,
    clearSelection,
    clearDraftTextEntry: clearDraftTextEntryState,
    clearTextEditSession: clearTextEditSessionState,
    deleteSelection,
    addResolvedItem,
    commitDraftTextEntry: commitDraftTextEntryState,
    commitTextItemEdit: commitTextItemEditState,
  } = sharedScene;

  const clearDraftTextEntry = useCallback(() => {
    clearDraftTextEntryState();
    setDraftOwnerInstanceId(null);
  }, [clearDraftTextEntryState, setDraftOwnerInstanceId]);

  const clearTextEditSession = useCallback(() => {
    clearTextEditSessionState();
    setTextEditOwnerInstanceId(null);
  }, [clearTextEditSessionState, setTextEditOwnerInstanceId]);

  const commitDraftTextEntry = useCallback(() => {
    commitDraftTextEntryState();
    setDraftOwnerInstanceId(null);
  }, [commitDraftTextEntryState, setDraftOwnerInstanceId]);

  const commitTextItemEdit = useCallback(() => {
    commitTextItemEditState();
    setTextEditOwnerInstanceId(null);
  }, [commitTextItemEditState, setTextEditOwnerInstanceId]);
  const {
    isDropActive,
    onViewportDragEnter,
    onViewportDragOver,
    onViewportDragLeave,
    onViewportDrop,
  } = useCanvasViewportDropHandlers({
    viewportRef,
    camera,
    resolveCanvasDropReference,
    addResolvedItem,
  });

  const {
    onViewportKeyDown,
    onDraftTextChange,
    onDraftTextKeyDown,
    onItemDoubleClick: onItemDoubleClickBase,
    onItemContextMenu,
    onTextItemEditChange,
    onTextItemEditKeyDown,
    onTextItemEditBlur,
    onPinTextItem,
  } = useCanvasViewportTextHandlers({
    items,
    draftTextEntry,
    textEditSession,
    onPinTextReference,
    scene: {
      setItems,
      setDraftTextEntry,
      setTextEditSession,
      clearDraftTextEntry,
      clearTextEditSession,
      deleteSelection,
      commitDraftTextEntry,
      commitTextItemEdit,
    },
  });

  const onItemDoubleClick = useCallback(
    (id: string, event: MouseEvent<HTMLElement>) => {
      setDraftOwnerInstanceId(null);
      setTextEditOwnerInstanceId(instanceId);
      onItemDoubleClickBase(id, event);
    },
    [instanceId, onItemDoubleClickBase, setDraftOwnerInstanceId, setTextEditOwnerInstanceId]
  );

  const isDraftTextEditable =
    draftOwnerInstanceId == null ? instanceId === "main" : draftOwnerInstanceId === instanceId;
  const isTextEditEditable =
    textEditOwnerInstanceId == null
      ? instanceId === "main"
      : textEditOwnerInstanceId === instanceId;

  const logCanvasGesture = useCallback(
    (eventName: string, payload?: Record<string, unknown>) => {
      if (typeof window === "undefined") return;
      if (!(window as { __shortpulseCanvasDebug?: boolean }).__shortpulseCanvasDebug) return;
      if (payload) {
        console.log(`[canvas:${instanceId}] ${eventName}`, payload);
        return;
      }
      console.log(`[canvas:${instanceId}] ${eventName}`);
    },
    [instanceId]
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
      setDraftOwnerInstanceId(instanceId);
      setTextEditOwnerInstanceId(null);
      setDraftTextEntry({
        x: Math.round((point.x - CANVAS_TEXT_ITEM_WIDTH / 2) * 100) / 100,
        y: Math.round((point.y - 36) * 100) / 100,
        value: "",
      });
    },
    [
      camera,
      clearSelection,
      clearTextEditSession,
      instanceId,
      setDraftOwnerInstanceId,
      setDraftTextEntry,
      setTextEditOwnerInstanceId,
    ]
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
        logCanvasGesture("pointerdown.detail-fallback.create-draft", {
          detail: event.detail,
          clientX: event.clientX,
          clientY: event.clientY,
        });
        createDraftTextAtClientPoint(event.clientX, event.clientY);
        return;
      }

      const shouldPan =
        event.button === 0 ||
        shouldStartCanvasPanFromPointerDown({
          button: event.button,
          isSpacePanActive: isSpacePanActiveRef.current,
        });
      if (!shouldPan) return;
      clearSelection();
      clearDraftTextEntry();
      clearTextEditSession();
      event.currentTarget.focus();
      const isImmediatePan =
        event.button !== 0 ||
        shouldStartCanvasPanFromPointerDown({
          button: event.button,
          isSpacePanActive: isSpacePanActiveRef.current,
        });
      if (isImmediatePan) {
        event.preventDefault();
        setPointerCaptureIfAvailable({
          target: event.currentTarget,
          pointerId: event.pointerId,
        });
      }
      interactionRef.current = {
        kind: "pan",
        pointerId: event.pointerId,
        cameraX: camera.x,
        cameraY: camera.y,
        startClientX: event.clientX,
        startClientY: event.clientY,
        isActive: isImmediatePan,
      };
      logCanvasGesture("pointerdown.pan-candidate", {
        isImmediatePan,
        button: event.button,
        clientX: event.clientX,
        clientY: event.clientY,
      });
    },
    [
      camera.x,
      camera.y,
      clearDraftTextEntry,
      clearSelection,
      clearTextEditSession,
      createDraftTextAtClientPoint,
      isSpacePanActiveRef,
      logCanvasGesture,
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
        logCanvasGesture("dblclick.suppressed", nextPoint);
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      lastViewportTapRef.current = null;
      lastViewportDraftCreationRef.current = nextPoint;
      logCanvasGesture("dblclick.create-draft", nextPoint);
      createDraftTextAtClientPoint(event.clientX, event.clientY);
    },
    [createDraftTextAtClientPoint, logCanvasGesture]
  );

  const handleViewportClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (event.button !== 0 || event.detail < 2) return;
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
        logCanvasGesture("click.detail-fallback.suppressed", {
          detail: event.detail,
          ...nextPoint,
        });
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      lastViewportTapRef.current = null;
      lastViewportDraftCreationRef.current = nextPoint;
      logCanvasGesture("click.detail-fallback.create-draft", {
        detail: event.detail,
        ...nextPoint,
      });
      createDraftTextAtClientPoint(event.clientX, event.clientY);
    },
    [createDraftTextAtClientPoint, logCanvasGesture]
  );

  const handleViewportPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const interaction = interactionRef.current;
      if (interaction.kind !== "pan" || interaction.pointerId !== event.pointerId) return;
      const travelDistance = Math.hypot(
        event.clientX - interaction.startClientX,
        event.clientY - interaction.startClientY
      );
      const shouldActivatePan =
        interaction.isActive || travelDistance >= VIEWPORT_PAN_ACTIVATION_DISTANCE_PX;
      if (!shouldActivatePan) return;
      if (!interaction.isActive) {
        setPointerCaptureIfAvailable({
          target: event.currentTarget,
          pointerId: event.pointerId,
        });
        interactionRef.current = {
          ...interaction,
          isActive: true,
        };
        logCanvasGesture("pointermove.activate-pan", {
          clientX: event.clientX,
          clientY: event.clientY,
          travelDistance,
        });
      }
      event.preventDefault();
      setCamera((currentCamera) => ({
        ...currentCamera,
        x: Math.round((interaction.cameraX + event.clientX - interaction.startClientX) * 100) / 100,
        y: Math.round((interaction.cameraY + event.clientY - interaction.startClientY) * 100) / 100,
      }));
    },
    [logCanvasGesture]
  );

  const handleViewportPointerUp = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const interaction = interactionRef.current;
      if (interaction.kind === "pan" && interaction.pointerId === event.pointerId) {
        const currentTap = {
          timeStamp: event.timeStamp,
          clientX: event.clientX,
          clientY: event.clientY,
        };
        if (!interaction.isActive) {
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
            logCanvasGesture("pointerup.double-tap.create-draft", {
              ...currentTap,
              travelDistance,
            });
            createDraftTextAtClientPoint(event.clientX, event.clientY);
          } else {
            logCanvasGesture("pointerup.double-tap.no-draft", {
              ...currentTap,
              travelDistance,
            });
          }
        } else {
          const travelDistance = Math.hypot(
            event.clientX - interaction.startClientX,
            event.clientY - interaction.startClientY
          );
          const shouldTreatPanAsTap =
            event.button === 0 &&
            !isSpacePanActiveRef.current &&
            travelDistance <= CANVAS_DOUBLE_TAP_MAX_DISTANCE_PX;
          if (shouldTreatPanAsTap) {
            setCamera((currentCamera) => ({
              ...currentCamera,
              x: interaction.cameraX,
              y: interaction.cameraY,
            }));
            const tapResolution = resolveViewportTapState({
              previousTap: lastViewportTapRef.current,
              nextTap: currentTap,
              isSpacePanActive: false,
              travelDistance,
            });
            lastViewportTapRef.current = tapResolution.nextStoredTap;
            if (tapResolution.shouldCreateDraft) {
              lastViewportDraftCreationRef.current = currentTap;
              logCanvasGesture("pointerup.reclassified-pan.double-tap.create-draft", {
                ...currentTap,
                travelDistance,
              });
              createDraftTextAtClientPoint(event.clientX, event.clientY);
            } else {
              logCanvasGesture("pointerup.reclassified-pan.double-tap.no-draft", {
                ...currentTap,
                travelDistance,
              });
            }
          } else {
            lastViewportTapRef.current = null;
            logCanvasGesture("pointerup.end-pan", currentTap);
          }
        }
        interactionRef.current = { kind: "none" };
        releasePointerCaptureIfHeld({
          target: event.currentTarget,
          pointerId: event.pointerId,
        });
      }
    },
    [createDraftTextAtClientPoint, isSpacePanActiveRef, logCanvasGesture]
  );

  const handleViewportPointerCancel = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const interaction = interactionRef.current;
      if (interaction.kind === "pan" && interaction.pointerId === event.pointerId) {
        lastViewportTapRef.current = null;
        interactionRef.current = { kind: "none" };
        releasePointerCaptureIfHeld({
          target: event.currentTarget,
          pointerId: event.pointerId,
        });
        logCanvasGesture("pointercancel.reset-pan");
      }
    },
    [logCanvasGesture]
  );

  const handleItemPointerDown = useCallback(
    (itemId: string, event: PointerEvent<HTMLElement>) => {
      const shouldPan = shouldStartCanvasPanFromPointerDown({
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
          isActive: true,
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
      releasePointerCaptureIfHeld({
        target: event.currentTarget,
        pointerId: event.pointerId,
      });
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
        releasePointerCaptureIfHeld({
          target: event.currentTarget,
          pointerId: event.pointerId,
        });
      }
    },
    []
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

  return useMemo(
    () => ({
      instanceId,
      camera,
      items,
      pendingItems,
      viewportRef,
      isDropActive,
      draftTextEntry,
      isDraftTextEditable,
      editingTextItemId: textEditSession?.itemId ?? null,
      editingTextValue: textEditSession?.value ?? "",
      isTextEditEditable,
      onViewportKeyDown,
      onViewportDoubleClick: handleViewportDoubleClick,
      onViewportClick: handleViewportClick,
      onViewportPointerDown: handleViewportPointerDown,
      onViewportPointerMove: handleViewportPointerMove,
      onViewportPointerUp: handleViewportPointerUp,
      onViewportPointerCancel: handleViewportPointerCancel,
      onViewportDragEnter,
      onViewportDragOver,
      onViewportDragLeave,
      onViewportDrop,
      onViewportWheel: handleViewportWheel,
      onItemPointerDown: handleItemPointerDown,
      onItemPointerMove: handleItemPointerMove,
      onItemPointerUp: handleItemPointerUp,
      onItemPointerCancel: handleItemPointerCancel,
      onItemContextMenu,
      onItemDoubleClick,
      onPinTextItem,
      onDraftTextChange,
      onDraftTextKeyDown,
      onDraftTextBlur: clearDraftTextEntry,
      onTextItemEditChange,
      onTextItemEditKeyDown,
      onTextItemEditBlur,
    }),
    [
      camera,
      clearDraftTextEntry,
      draftTextEntry,
      handleItemPointerCancel,
      handleItemPointerDown,
      handleItemPointerMove,
      handleItemPointerUp,
      handleViewportClick,
      handleViewportDoubleClick,
      handleViewportPointerCancel,
      handleViewportPointerDown,
      handleViewportPointerMove,
      handleViewportPointerUp,
      handleViewportWheel,
      instanceId,
      isDraftTextEditable,
      isDropActive,
      isTextEditEditable,
      items,
      onDraftTextChange,
      onDraftTextKeyDown,
      onItemContextMenu,
      onItemDoubleClick,
      onPinTextItem,
      onTextItemEditBlur,
      onTextItemEditChange,
      onTextItemEditKeyDown,
      onViewportDragEnter,
      onViewportDragLeave,
      onViewportDragOver,
      onViewportDrop,
      onViewportKeyDown,
      pendingItems,
      textEditSession,
    ]
  );
};
