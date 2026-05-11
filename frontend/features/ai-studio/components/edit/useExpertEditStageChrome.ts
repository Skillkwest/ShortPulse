import React from "react";

import type { RailTool } from "./expertEditPanelViewContract";
import {
  clearWindowTimeoutRef,
  isEventTargetInsideElement,
  resolveStageContextMenuPosition,
} from "./expertEditInteractionUtils";

type UseExpertEditStageChromeArgs = {
  hasPrimaryCompositePreview: boolean;
  isMarkupExpandSelected: boolean;
  isMorePresetsSurfaceOpen: boolean;
  isMoveToolSelected: boolean;
  selectedRailTool: RailTool;
  shouldOpenMarkupModalFromCollapsedTools: boolean;
  beginMarkupPanGesture: (
    event: React.PointerEvent<HTMLDivElement>,
    scope: "inline" | "modal"
  ) => boolean;
  continueMarkupPanGesture: (event: React.PointerEvent<HTMLDivElement>) => boolean;
  endMarkupPanGesture: (event: React.PointerEvent<HTMLDivElement>) => boolean;
  handleRecenterMoveAction: () => void;
  handleResetGeneralAction: () => void;
  handleRemoveSelectedLayerImage: () => void;
  setSelectedRailTool: React.Dispatch<React.SetStateAction<RailTool>>;
  setIsMarkupExpandSelected: React.Dispatch<React.SetStateAction<boolean>>;
  setIsInpaintCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  setIsInpaintCollapsing: React.Dispatch<React.SetStateAction<boolean>>;
  primaryInputRef: React.RefObject<HTMLInputElement | null>;
  stageContextMenuRef: React.RefObject<HTMLDivElement | null>;
  markupModalRef: React.RefObject<HTMLDivElement | null>;
  inpaintCollapseTimerRef: React.RefObject<number | null>;
};

export function useExpertEditStageChrome({
  hasPrimaryCompositePreview,
  isMarkupExpandSelected,
  isMorePresetsSurfaceOpen,
  isMoveToolSelected,
  selectedRailTool,
  shouldOpenMarkupModalFromCollapsedTools,
  beginMarkupPanGesture,
  continueMarkupPanGesture,
  endMarkupPanGesture,
  handleRecenterMoveAction,
  handleResetGeneralAction,
  handleRemoveSelectedLayerImage,
  setSelectedRailTool,
  setIsMarkupExpandSelected,
  setIsInpaintCollapsed,
  setIsInpaintCollapsing,
  primaryInputRef,
  stageContextMenuRef,
  markupModalRef,
  inpaintCollapseTimerRef,
}: UseExpertEditStageChromeArgs) {
  const [stageContextMenuState, setStageContextMenuState] = React.useState<{
    isOpen: boolean;
    x: number;
    y: number;
  }>({
    isOpen: false,
    x: 0,
    y: 0,
  });

  const shouldRenderInlineInteractiveStage = hasPrimaryCompositePreview && !isMarkupExpandSelected;

  const shouldIgnoreInlineCaptureEvent = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) =>
      isMarkupExpandSelected ||
      isMorePresetsSurfaceOpen ||
      (event.target instanceof Element &&
        Boolean(event.target.closest(".edit-expert-stage-overlay-ui"))),
    [isMarkupExpandSelected, isMorePresetsSurfaceOpen]
  );

  const handleInlineStagePointerDownCapture = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (shouldIgnoreInlineCaptureEvent(event)) return;
      if (!beginMarkupPanGesture(event, "inline")) return;
      event.stopPropagation();
    },
    [beginMarkupPanGesture, shouldIgnoreInlineCaptureEvent]
  );

  const handleInlineStagePointerMoveCapture = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (shouldIgnoreInlineCaptureEvent(event)) return;
      if (!continueMarkupPanGesture(event)) return;
      event.stopPropagation();
    },
    [continueMarkupPanGesture, shouldIgnoreInlineCaptureEvent]
  );

  const handleInlineStagePointerUpCapture = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (shouldIgnoreInlineCaptureEvent(event)) return;
      if (!endMarkupPanGesture(event)) return;
      event.stopPropagation();
    },
    [endMarkupPanGesture, shouldIgnoreInlineCaptureEvent]
  );

  const handleInlineStagePointerCancelCapture = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (shouldIgnoreInlineCaptureEvent(event)) return;
      if (!endMarkupPanGesture(event)) return;
      event.stopPropagation();
    },
    [endMarkupPanGesture, shouldIgnoreInlineCaptureEvent]
  );

  const closeStageContextMenu = React.useCallback(() => {
    setStageContextMenuState((previous) =>
      previous.isOpen ? { ...previous, isOpen: false } : previous
    );
  }, []);

  const openStageContextMenu = React.useCallback((clientX: number, clientY: number) => {
    if (typeof window === "undefined") return;
    const { x, y } = resolveStageContextMenuPosition({
      clientX,
      clientY,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    });
    setStageContextMenuState({
      isOpen: true,
      x,
      y,
    });
  }, []);

  const openMarkupModal = React.useCallback(
    (tool?: RailTool) => {
      if (tool && tool !== selectedRailTool) {
        setSelectedRailTool(tool);
      }
      if (shouldOpenMarkupModalFromCollapsedTools) {
        clearWindowTimeoutRef(inpaintCollapseTimerRef);
        setIsInpaintCollapsed(true);
        setIsInpaintCollapsing(false);
      }
      setIsMarkupExpandSelected(true);
    },
    [
      inpaintCollapseTimerRef,
      selectedRailTool,
      setIsMarkupExpandSelected,
      setIsInpaintCollapsed,
      setIsInpaintCollapsing,
      setSelectedRailTool,
      shouldOpenMarkupModalFromCollapsedTools,
    ]
  );

  const closeMarkupModal = React.useCallback(() => {
    setIsMarkupExpandSelected(false);
    if (shouldOpenMarkupModalFromCollapsedTools) {
      clearWindowTimeoutRef(inpaintCollapseTimerRef);
      setIsInpaintCollapsed(true);
      setIsInpaintCollapsing(false);
    }
  }, [
    inpaintCollapseTimerRef,
    setIsMarkupExpandSelected,
    setIsInpaintCollapsed,
    setIsInpaintCollapsing,
    shouldOpenMarkupModalFromCollapsedTools,
  ]);

  const handlePrimaryDropzoneContextMenu = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (isMorePresetsSurfaceOpen) return;
      if (!hasPrimaryCompositePreview) {
        event.preventDefault();
        return;
      }
      event.preventDefault();
      openStageContextMenu(event.clientX, event.clientY);
    },
    [hasPrimaryCompositePreview, isMorePresetsSurfaceOpen, openStageContextMenu]
  );

  const handleStageContextMenuRecenter = React.useCallback(() => {
    handleRecenterMoveAction();
    closeStageContextMenu();
  }, [closeStageContextMenu, handleRecenterMoveAction]);

  const handleStageContextMenuExpand = React.useCallback(() => {
    openMarkupModal("markup");
    closeStageContextMenu();
  }, [closeStageContextMenu, openMarkupModal]);

  const handleStageContextMenuAddImage = React.useCallback(() => {
    closeStageContextMenu();
    primaryInputRef.current?.click();
  }, [closeStageContextMenu, primaryInputRef]);

  const handleStageContextMenuReset = React.useCallback(() => {
    handleResetGeneralAction();
    closeStageContextMenu();
  }, [closeStageContextMenu, handleResetGeneralAction]);

  const handleStageContextMenuRemoveImage = React.useCallback(() => {
    handleRemoveSelectedLayerImage();
    closeStageContextMenu();
  }, [closeStageContextMenu, handleRemoveSelectedLayerImage]);

  const handlePrimaryDropzoneClick = React.useCallback(() => {
    if (isMorePresetsSurfaceOpen || !hasPrimaryCompositePreview) return;
  }, [hasPrimaryCompositePreview, isMorePresetsSurfaceOpen]);

  const handlePrimaryDropzoneDoubleClick = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (isMorePresetsSurfaceOpen || !hasPrimaryCompositePreview) return;
      if (!isMoveToolSelected) return;
      event.preventDefault();
      handleRecenterMoveAction();
    },
    [
      handleRecenterMoveAction,
      hasPrimaryCompositePreview,
      isMorePresetsSurfaceOpen,
      isMoveToolSelected,
    ]
  );

  const handleMarkupModalDragShield = React.useCallback((event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const isDragTargetInsideMarkupModal = React.useCallback(
    (target: EventTarget | null) => isEventTargetInsideElement(markupModalRef.current, target),
    [markupModalRef]
  );

  const handleMarkupModalRootDragCapture = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!isMarkupExpandSelected) return;
      if (isDragTargetInsideMarkupModal(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
    },
    [isDragTargetInsideMarkupModal, isMarkupExpandSelected]
  );

  React.useEffect(() => {
    if (!isMarkupExpandSelected || typeof document === "undefined") return;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [isMarkupExpandSelected]);

  React.useEffect(() => {
    if (!isMarkupExpandSelected || typeof window === "undefined") return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      closeMarkupModal();
    };
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [closeMarkupModal, isMarkupExpandSelected]);

  React.useEffect(() => {
    if (!stageContextMenuState.isOpen || typeof document === "undefined") return;
    const handlePointerDown = (event: PointerEvent) => {
      if (isEventTargetInsideElement(stageContextMenuRef.current, event.target)) return;
      closeStageContextMenu();
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      closeStageContextMenu();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [closeStageContextMenu, stageContextMenuRef, stageContextMenuState.isOpen]);

  React.useEffect(() => {
    if (!isMorePresetsSurfaceOpen && !isMarkupExpandSelected) return;
    closeStageContextMenu();
  }, [closeStageContextMenu, isMarkupExpandSelected, isMorePresetsSurfaceOpen]);

  return {
    isMarkupExpandSelected,
    stageContextMenuState,
    shouldRenderInlineInteractiveStage,
    openMarkupModal,
    closeMarkupModal,
    closeStageContextMenu,
    handleInlineStagePointerDownCapture,
    handleInlineStagePointerMoveCapture,
    handleInlineStagePointerUpCapture,
    handleInlineStagePointerCancelCapture,
    handlePrimaryDropzoneContextMenu,
    handlePrimaryDropzoneClick,
    handlePrimaryDropzoneDoubleClick,
    handleStageContextMenuRecenter,
    handleStageContextMenuExpand,
    handleStageContextMenuAddImage,
    handleStageContextMenuReset,
    handleStageContextMenuRemoveImage,
    handleMarkupModalDragShield,
    handleMarkupModalRootDragCapture,
  };
}
