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
  clampCanvasTextItemHeight,
  clampCanvasTextItemWidth,
  CANVAS_TEXT_ITEM_MIN_HEIGHT,
  CANVAS_TEXT_ITEM_WIDTH,
  resolveCanvasWheelZoomDelta,
  viewportPointToCanvasWorld,
  zoomCanvasCameraAtViewportPoint,
} from "./canvasGeometry";
import {
  normalizeCanvasRectFromPoints,
  resolveCanvasMarqueeSelectionIds,
} from "./canvasMarqueeSelection";
import { resolveCanvasDropClientPoint } from "./canvasDropController";
import {
  CANVAS_DOUBLE_TAP_MAX_DISTANCE_PX,
  shouldCreateDraftFromPointerDetail,
  shouldSuppressDraftCreation,
  resolveViewportTapState,
  type CanvasInteractionPoint,
} from "./canvasInteractionController";
import {
  getSelectedCanvasSceneItemIds,
  moveCanvasSceneItemsByIdSet,
  selectCanvasSceneItem,
  setCanvasSceneSelectionByIds,
  type CanvasSharedSceneState,
} from "./canvasSceneState";
import type {
  CanvasCamera,
  CanvasResizeHandle,
  PrepareCanvasMediaLibraryDrop,
  PrepareResolvedInternalCanvasDrop,
  ResolveCanvasDroppedMediaReference,
  ResolveCanvasDropFiles,
  ResolveCanvasDropReference,
} from "./canvasTypes";
import {
  shouldStartCanvasPanFromPointerDown,
  type CanvasPointerSession,
} from "./canvasViewportPointerTypes";
import { AI_STUDIO_CANVAS_TEXT_RESIZE_ENABLED } from "./canvasFeatureFlags";
import type {
  CanvasMarqueeSelectionBox,
  CanvasPropertiesPanelProps,
  CanvasWorkspaceInstanceId,
} from "./canvasWorkspaceContracts";
import { useCanvasViewportDropHandlers } from "./useCanvasViewportDropHandlers";
import { useCanvasViewportTextHandlers } from "./useCanvasViewportTextHandlers";
import { PERF_FLAG_AUDIT_RUNTIME } from "../../logic/perfProfileFlags";

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
  prepareResolvedInternalCanvasDrop?: PrepareResolvedInternalCanvasDrop;
  prepareCanvasMediaLibraryDrop?: PrepareCanvasMediaLibraryDrop;
  resolveCanvasDroppedMediaReference?: ResolveCanvasDroppedMediaReference;
  resolveCanvasDropFiles?: ResolveCanvasDropFiles;
  onPinTextReference?: (text: string) => void;
  isSpacePanActiveRef: MutableRefObject<boolean>;
  draftOwnerInstanceId: CanvasWorkspaceInstanceId | null;
  textEditOwnerInstanceId: CanvasWorkspaceInstanceId | null;
  setDraftOwnerInstanceId: Dispatch<SetStateAction<CanvasWorkspaceInstanceId | null>>;
  setTextEditOwnerInstanceId: Dispatch<SetStateAction<CanvasWorkspaceInstanceId | null>>;
  cameraState?: {
    camera: CanvasCamera;
    setCamera: Dispatch<SetStateAction<CanvasCamera>>;
  };
};
/**
 * Builds a single Canvas viewport contract over shared scene state.
 */
export const useCanvasViewportInstanceState = ({
  instanceId,
  sharedScene,
  resolveCanvasDropReference,
  prepareResolvedInternalCanvasDrop,
  prepareCanvasMediaLibraryDrop,
  resolveCanvasDroppedMediaReference,
  resolveCanvasDropFiles,
  onPinTextReference,
  isSpacePanActiveRef,
  draftOwnerInstanceId,
  textEditOwnerInstanceId,
  setDraftOwnerInstanceId,
  setTextEditOwnerInstanceId,
  cameraState,
}: UseCanvasViewportInstanceStateParams): CanvasPropertiesPanelProps => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const interactionRef = useRef<CanvasPointerSession>({ kind: "none" });
  const lastViewportTapRef = useRef<CanvasInteractionPoint | null>(null);
  const lastViewportDraftCreationRef = useRef<CanvasInteractionPoint | null>(null);
  const [isTextResizeActive, setIsTextResizeActive] = useState(false);
  const [internalCamera, setInternalCamera] = useState(CANVAS_DEFAULT_CAMERA);
  const [marqueeSelectionBox, setMarqueeSelectionBox] = useState<CanvasMarqueeSelectionBox | null>(
    null
  );
  const camera = cameraState?.camera ?? internalCamera;
  const setCamera = cameraState?.setCamera ?? setInternalCamera;
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
    prepareResolvedInternalCanvasDrop,
    prepareCanvasMediaLibraryDrop,
    resolveCanvasDroppedMediaReference,
    resolveCanvasDropFiles,
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
      if (!PERF_FLAG_AUDIT_RUNTIME) return;
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

      const shouldPan = shouldStartCanvasPanFromPointerDown({
        button: event.button,
        isSpacePanActive: isSpacePanActiveRef.current,
      });
      if (shouldPan) {
        clearSelection();
        clearDraftTextEntry();
        clearTextEditSession();
        setMarqueeSelectionBox(null);
        event.currentTarget.focus();
        event.preventDefault();
        setPointerCaptureIfAvailable({
          target: event.currentTarget,
          pointerId: event.pointerId,
        });
        interactionRef.current = {
          kind: "pan",
          pointerId: event.pointerId,
          cameraX: camera.x,
          cameraY: camera.y,
          startClientX: event.clientX,
          startClientY: event.clientY,
          isActive: true,
        };
        logCanvasGesture("pointerdown.pan", {
          button: event.button,
          clientX: event.clientX,
          clientY: event.clientY,
        });
        return;
      }
      if (event.button !== 0) return;

      if (!viewportRef.current) return;
      const rect = viewportRef.current.getBoundingClientRect();
      const localX = Math.round((event.clientX - rect.left) * 100) / 100;
      const localY = Math.round((event.clientY - rect.top) * 100) / 100;
      const worldPoint = viewportPointToCanvasWorld({
        clientX: event.clientX,
        clientY: event.clientY,
        rect,
        camera,
      });
      clearDraftTextEntry();
      clearTextEditSession();
      setMarqueeSelectionBox(null);
      if (!event.shiftKey) {
        clearSelection();
      }
      event.currentTarget.focus();
      interactionRef.current = {
        kind: "marquee",
        pointerId: event.pointerId,
        isAdditive: event.shiftKey,
        isActive: false,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startLocalX: localX,
        startLocalY: localY,
        startWorldX: worldPoint.x,
        startWorldY: worldPoint.y,
      };
      logCanvasGesture("pointerdown.marquee-candidate", {
        isAdditive: event.shiftKey,
        button: event.button,
        clientX: event.clientX,
        clientY: event.clientY,
      });
    },
    [
      camera,
      clearDraftTextEntry,
      clearSelection,
      clearTextEditSession,
      createDraftTextAtClientPoint,
      isSpacePanActiveRef,
      logCanvasGesture,
      setMarqueeSelectionBox,
      viewportRef,
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
      if (interaction.kind === "none") return;
      if (interaction.pointerId !== event.pointerId) return;
      if (interaction.kind === "pan") {
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
          x:
            Math.round((interaction.cameraX + event.clientX - interaction.startClientX) * 100) /
            100,
          y:
            Math.round((interaction.cameraY + event.clientY - interaction.startClientY) * 100) /
            100,
        }));
        return;
      }
      if (interaction.kind === "text-resize") {
        event.preventDefault();
        const deltaWorldX = (event.clientX - interaction.startClientX) / camera.zoom;
        const deltaWorldY = (event.clientY - interaction.startClientY) / camera.zoom;
        setItems((currentItems) =>
          currentItems.map((item) => {
            if (item.id !== interaction.itemId || item.kind !== "text") return item;
            const isWestHandle = interaction.handle === "nw" || interaction.handle === "sw";
            const isNorthHandle = interaction.handle === "nw" || interaction.handle === "ne";
            const nextWidth = clampCanvasTextItemWidth(
              isWestHandle
                ? interaction.startWidth - deltaWorldX
                : interaction.startWidth + deltaWorldX
            );
            const nextHeight = clampCanvasTextItemHeight(
              isNorthHandle
                ? interaction.startHeight - deltaWorldY
                : interaction.startHeight + deltaWorldY
            );
            const nextX = isWestHandle
              ? Math.round((interaction.startRightX - nextWidth) * 100) / 100
              : interaction.startX;
            const nextY = isNorthHandle
              ? Math.round((interaction.startBottomY - nextHeight) * 100) / 100
              : interaction.startY;
            if (
              item.width === nextWidth &&
              item.height === nextHeight &&
              item.x === nextX &&
              item.y === nextY
            ) {
              return item;
            }
            return {
              ...item,
              x: nextX,
              y: nextY,
              width: nextWidth,
              height: nextHeight,
            };
          })
        );
        return;
      }
      if (interaction.kind !== "marquee") return;

      const travelDistance = Math.hypot(
        event.clientX - interaction.startClientX,
        event.clientY - interaction.startClientY
      );
      const shouldActivateMarquee =
        interaction.isActive || travelDistance >= VIEWPORT_PAN_ACTIVATION_DISTANCE_PX;
      if (!shouldActivateMarquee) return;
      if (!interaction.isActive) {
        setPointerCaptureIfAvailable({
          target: event.currentTarget,
          pointerId: event.pointerId,
        });
        interactionRef.current = {
          ...interaction,
          isActive: true,
        };
      }
      if (!viewportRef.current) return;
      const rect = viewportRef.current.getBoundingClientRect();
      const currentLocalX = Math.round((event.clientX - rect.left) * 100) / 100;
      const currentLocalY = Math.round((event.clientY - rect.top) * 100) / 100;
      const viewportMarqueeRect = normalizeCanvasRectFromPoints({
        startX: interaction.startLocalX,
        startY: interaction.startLocalY,
        endX: currentLocalX,
        endY: currentLocalY,
      });
      const worldPoint = viewportPointToCanvasWorld({
        clientX: event.clientX,
        clientY: event.clientY,
        rect,
        camera,
      });
      const worldMarqueeRect = normalizeCanvasRectFromPoints({
        startX: interaction.startWorldX,
        startY: interaction.startWorldY,
        endX: worldPoint.x,
        endY: worldPoint.y,
      });
      setMarqueeSelectionBox(viewportMarqueeRect);
      setItems((currentItems) => {
        const selectedIds = resolveCanvasMarqueeSelectionIds({
          items: currentItems,
          marqueeRect: worldMarqueeRect,
        });
        return setCanvasSceneSelectionByIds(currentItems, selectedIds, {
          mode: interaction.isAdditive ? "add" : "replace",
        });
      });
    },
    [camera, logCanvasGesture, setCamera, setItems, viewportRef]
  );

  const handleViewportPointerUp = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const interaction = interactionRef.current;
      if (interaction.kind === "none") return;
      if (interaction.pointerId !== event.pointerId) return;

      const currentTap = {
        timeStamp: event.timeStamp,
        clientX: event.clientX,
        clientY: event.clientY,
      };

      if (interaction.kind === "pan") {
        const travelDistance = Math.hypot(
          event.clientX - interaction.startClientX,
          event.clientY - interaction.startClientY
        );
        if (!interaction.isActive) {
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
      } else if (interaction.kind === "marquee") {
        const travelDistance = Math.hypot(
          event.clientX - interaction.startClientX,
          event.clientY - interaction.startClientY
        );
        setMarqueeSelectionBox(null);
        const shouldTreatMarqueeAsTap =
          event.button === 0 &&
          travelDistance <= CANVAS_DOUBLE_TAP_MAX_DISTANCE_PX &&
          !interaction.isAdditive;
        if (shouldTreatMarqueeAsTap) {
          const tapResolution = resolveViewportTapState({
            previousTap: lastViewportTapRef.current,
            nextTap: currentTap,
            isSpacePanActive: false,
            travelDistance,
          });
          lastViewportTapRef.current = tapResolution.nextStoredTap;
          if (tapResolution.shouldCreateDraft) {
            lastViewportDraftCreationRef.current = currentTap;
            logCanvasGesture("pointerup.reclassified-marquee.double-tap.create-draft", {
              ...currentTap,
              travelDistance,
            });
            createDraftTextAtClientPoint(event.clientX, event.clientY);
          } else {
            logCanvasGesture("pointerup.reclassified-marquee.double-tap.no-draft", {
              ...currentTap,
              travelDistance,
            });
          }
        } else {
          lastViewportTapRef.current = null;
          logCanvasGesture("pointerup.end-marquee", {
            ...currentTap,
            travelDistance,
          });
        }
      } else if (interaction.kind === "text-resize") {
        lastViewportTapRef.current = null;
        setIsTextResizeActive(false);
      }

      interactionRef.current = { kind: "none" };
      releasePointerCaptureIfHeld({
        target: event.currentTarget,
        pointerId: event.pointerId,
      });
    },
    [
      createDraftTextAtClientPoint,
      isSpacePanActiveRef,
      logCanvasGesture,
      setCamera,
      setMarqueeSelectionBox,
    ]
  );

  const handleViewportPointerCancel = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const interaction = interactionRef.current;
      if (interaction.kind === "none") return;
      if (interaction.pointerId !== event.pointerId) return;
      if (
        interaction.kind === "pan" ||
        interaction.kind === "marquee" ||
        interaction.kind === "text-resize"
      ) {
        lastViewportTapRef.current = null;
        setMarqueeSelectionBox(null);
        interactionRef.current = { kind: "none" };
        releasePointerCaptureIfHeld({
          target: event.currentTarget,
          pointerId: event.pointerId,
        });
        logCanvasGesture(
          interaction.kind === "pan"
            ? "pointercancel.reset-pan"
            : interaction.kind === "marquee"
              ? "pointercancel.reset-marquee"
              : "pointercancel.reset-text-resize"
        );
        if (interaction.kind === "text-resize") {
          setIsTextResizeActive(false);
        }
      }
    },
    [logCanvasGesture, setMarqueeSelectionBox]
  );

  const handleTextResizeHandlePointerDown = useCallback(
    (itemId: string, handle: CanvasResizeHandle, event: PointerEvent<HTMLElement>) => {
      if (!AI_STUDIO_CANVAS_TEXT_RESIZE_ENABLED) return;
      if (event.button !== 0) return;
      const item = items.find((candidate) => candidate.id === itemId);
      if (!item || item.kind !== "text" || !item.selected) return;
      event.preventDefault();
      event.stopPropagation();
      clearDraftTextEntry();
      clearTextEditSession();
      setMarqueeSelectionBox(null);
      viewportRef.current?.focus();
      const pointerTarget = viewportRef.current ?? event.currentTarget;
      setPointerCaptureIfAvailable({
        target: pointerTarget,
        pointerId: event.pointerId,
      });
      setIsTextResizeActive(true);
      interactionRef.current = {
        kind: "text-resize",
        pointerId: event.pointerId,
        itemId,
        handle,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startX: item.x,
        startY: item.y,
        startWidth: item.width,
        startHeight: item.height ?? CANVAS_TEXT_ITEM_MIN_HEIGHT,
        startRightX: item.x + item.width,
        startBottomY: item.y + (item.height ?? CANVAS_TEXT_ITEM_MIN_HEIGHT),
      };
    },
    [clearDraftTextEntry, clearTextEditSession, items]
  );

  const handleItemPointerDown = useCallback(
    (itemId: string, event: PointerEvent<HTMLElement>) => {
      const shouldPan = shouldStartCanvasPanFromPointerDown({
        button: event.button,
        isSpacePanActive: isSpacePanActiveRef.current,
      });
      // On macOS, ctrl+primary click is treated as secondary-click context intent.
      if (!shouldPan && event.button === 0 && event.ctrlKey) return;
      if (!shouldPan && event.button !== 0) return;
      if (textEditSession?.itemId === itemId && !shouldPan) return;
      event.preventDefault();
      event.stopPropagation();
      setMarqueeSelectionBox(null);
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
        const targetItem = currentItems.find((item) => item.id === itemId);
        const selectedItems =
          targetItem?.selected === true
            ? currentItems
            : selectCanvasSceneItem(currentItems, itemId);
        const selectedIds = Array.from(getSelectedCanvasSceneItemIds(selectedItems));
        interactionRef.current = {
          kind: "item-drag",
          pointerId: event.pointerId,
          itemId,
          selectedItemIds: selectedIds,
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
      setMarqueeSelectionBox,
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
        moveCanvasSceneItemsByIdSet(
          currentItems,
          new Set(interaction.selectedItemIds),
          deltaX,
          deltaY
        )
      );
    },
    [camera.zoom, setCamera, setItems]
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

  const handleViewportWheel = useCallback(
    (event: WheelEvent<HTMLDivElement>) => {
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
    },
    [setCamera]
  );

  return useMemo(
    () => ({
      instanceId,
      camera,
      items,
      pendingItems,
      marqueeSelectionBox,
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
      isTextResizeEnabled: AI_STUDIO_CANVAS_TEXT_RESIZE_ENABLED,
      isTextResizeActive,
      onTextResizeHandlePointerDown: handleTextResizeHandlePointerDown,
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
      handleTextResizeHandlePointerDown,
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
      isTextResizeActive,
      isTextEditEditable,
      items,
      marqueeSelectionBox,
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
