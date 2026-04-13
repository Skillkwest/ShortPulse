import React from "react";

import type { TransformHistoryEntry } from "./expertEditLayerTransformUtils";
import { INPAINT_COLLAPSE_ANIMATION_MS } from "./expertEditPanelViewContract";
import type { StageViewportSize } from "./expertEditViewportUtils";
import {
  clearTransientObjectUrlRevokeTimers,
  clearWindowTimeoutRef,
  isKeyboardEventFromEditableTarget,
  resolveInpaintCollapseToggleDecision,
  type ObjectUrlRevokeTimers,
} from "./expertEditInteractionUtils";
import { isSpaceActivationKey } from "./expertEditPanelViewContract";

type UseExpertEditStageLifecycleArgs = {
  isMoveToolSelected: boolean;
  clearTransformPointerSession: () => void;
  isMarkupExpandSelected: boolean;
  isMorePresetsSurfaceOpen: boolean;
  setIsMarkupPanSpacePressed: React.Dispatch<React.SetStateAction<boolean>>;
  isVideoToolSelected: boolean;
  clearMarkupDrawGestureSession: () => void;
  canUndoGeneralAction: boolean;
  canRedoGeneralAction: boolean;
  handleUndoGeneralAction: () => void;
  handleRedoGeneralAction: () => void;
  inlineStageWrapperRef: React.RefObject<HTMLDivElement | null>;
  handleNativeMarkupViewportWheel: (
    event: WheelEvent,
    scope: "inline" | "modal",
    currentTarget: HTMLDivElement
  ) => void;
  markupModalStageRef: React.RefObject<HTMLDivElement | null>;
  markupModalStageSize: StageViewportSize | null;
  shouldShowInpaintBrushReticle: boolean;
  unlockGlobalCursor: () => void;
  queuePendingHistoryApplyEntry: (entry: TransformHistoryEntry | null) => void;
  clearHistoryEphemera: () => void;
  inpaintCollapseTimerRef: React.MutableRefObject<number | null>;
  toastVisibleTimerRef: React.MutableRefObject<number | null>;
  toastFadeTimerRef: React.MutableRefObject<number | null>;
  transientRevokeTimersRef: React.MutableRefObject<ObjectUrlRevokeTimers>;
  revokeObjectUrlSafe: (url: string) => void;
  isInpaintCollapsed: boolean;
  shouldOpenMarkupModalFromCollapsedTools: boolean;
  openMarkupModal: () => void;
  setIsInpaintCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  setIsInpaintCollapsing: React.Dispatch<React.SetStateAction<boolean>>;
};

export function useExpertEditStageLifecycle({
  isMoveToolSelected,
  clearTransformPointerSession,
  isMarkupExpandSelected,
  isMorePresetsSurfaceOpen,
  setIsMarkupPanSpacePressed,
  isVideoToolSelected,
  clearMarkupDrawGestureSession,
  canUndoGeneralAction,
  canRedoGeneralAction,
  handleUndoGeneralAction,
  handleRedoGeneralAction,
  inlineStageWrapperRef,
  handleNativeMarkupViewportWheel,
  markupModalStageRef,
  markupModalStageSize,
  shouldShowInpaintBrushReticle,
  unlockGlobalCursor,
  queuePendingHistoryApplyEntry,
  clearHistoryEphemera,
  inpaintCollapseTimerRef,
  toastVisibleTimerRef,
  toastFadeTimerRef,
  transientRevokeTimersRef,
  revokeObjectUrlSafe,
  isInpaintCollapsed,
  shouldOpenMarkupModalFromCollapsedTools,
  openMarkupModal,
  setIsInpaintCollapsed,
  setIsInpaintCollapsing,
}: UseExpertEditStageLifecycleArgs) {
  React.useEffect(() => {
    if (!isMoveToolSelected) {
      clearTransformPointerSession();
    }
  }, [clearTransformPointerSession, isMoveToolSelected]);

  React.useEffect(() => {
    const isMarkupPanKeyboardListeningEnabled = isMarkupExpandSelected || !isMorePresetsSurfaceOpen;
    if (!isMarkupPanKeyboardListeningEnabled) {
      setIsMarkupPanSpacePressed(false);
      return;
    }
    if (typeof window === "undefined") return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isSpaceActivationKey(event)) return;
      setIsMarkupPanSpacePressed(true);
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (!isSpaceActivationKey(event)) return;
      setIsMarkupPanSpacePressed(false);
    };
    const handleWindowBlur = () => {
      setIsMarkupPanSpacePressed(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [isMarkupExpandSelected, isMorePresetsSurfaceOpen, setIsMarkupPanSpacePressed]);

  React.useEffect(() => {
    if (isVideoToolSelected) return;
    clearMarkupDrawGestureSession();
  }, [clearMarkupDrawGestureSession, isVideoToolSelected]);

  React.useEffect(() => {
    if (!isMarkupExpandSelected || typeof window === "undefined") return;
    const handleHistoryHotkey = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.altKey) return;
      if (isKeyboardEventFromEditableTarget(event)) return;
      const hasModifier = event.metaKey || event.ctrlKey;
      if (!hasModifier) return;
      const key = event.key.toLowerCase();
      const isUndo = key === "z" && !event.shiftKey;
      const isRedo = (key === "z" && event.shiftKey) || key === "y";
      if (!isUndo && !isRedo) return;
      event.preventDefault();
      if (isUndo) {
        if (!canUndoGeneralAction) return;
        handleUndoGeneralAction();
        return;
      }
      if (!canRedoGeneralAction) return;
      handleRedoGeneralAction();
    };
    window.addEventListener("keydown", handleHistoryHotkey);
    return () => {
      window.removeEventListener("keydown", handleHistoryHotkey);
    };
  }, [
    canRedoGeneralAction,
    canUndoGeneralAction,
    handleRedoGeneralAction,
    handleUndoGeneralAction,
    isMarkupExpandSelected,
  ]);

  React.useEffect(() => {
    if (isMarkupExpandSelected) return;
    const inlineStageElement = inlineStageWrapperRef.current;
    if (!inlineStageElement) return;

    const handleInlineStageWheel = (event: WheelEvent) => {
      if (isMorePresetsSurfaceOpen) return;
      handleNativeMarkupViewportWheel(event, "inline", inlineStageElement);
      if (event.defaultPrevented) {
        event.stopPropagation();
      }
    };

    inlineStageElement.addEventListener("wheel", handleInlineStageWheel, { passive: false });
    return () => {
      inlineStageElement.removeEventListener("wheel", handleInlineStageWheel);
    };
  }, [
    handleNativeMarkupViewportWheel,
    inlineStageWrapperRef,
    isMarkupExpandSelected,
    isMorePresetsSurfaceOpen,
  ]);

  React.useEffect(() => {
    if (!isMarkupExpandSelected) return;
    const modalStageElement = markupModalStageRef.current;
    if (!modalStageElement) return;

    const handleModalStageWheel = (event: WheelEvent) => {
      handleNativeMarkupViewportWheel(event, "modal", modalStageElement);
      if (event.defaultPrevented) {
        event.stopPropagation();
      }
    };

    modalStageElement.addEventListener("wheel", handleModalStageWheel, {
      passive: false,
    });
    return () => {
      modalStageElement.removeEventListener("wheel", handleModalStageWheel);
    };
  }, [
    handleNativeMarkupViewportWheel,
    isMarkupExpandSelected,
    markupModalStageRef,
    markupModalStageSize,
  ]);

  React.useEffect(() => {
    if (!shouldShowInpaintBrushReticle || isMorePresetsSurfaceOpen) {
      unlockGlobalCursor();
    }
  }, [isMorePresetsSurfaceOpen, shouldShowInpaintBrushReticle, unlockGlobalCursor]);

  React.useEffect(
    () => () => {
      unlockGlobalCursor();
      queuePendingHistoryApplyEntry(null);
      clearHistoryEphemera();
      clearWindowTimeoutRef(inpaintCollapseTimerRef);
      clearWindowTimeoutRef(toastVisibleTimerRef);
      clearWindowTimeoutRef(toastFadeTimerRef);
      clearTransientObjectUrlRevokeTimers({
        timersByUrl: transientRevokeTimersRef.current,
        revokeObjectUrl: revokeObjectUrlSafe,
      });
    },
    [
      clearHistoryEphemera,
      inpaintCollapseTimerRef,
      queuePendingHistoryApplyEntry,
      revokeObjectUrlSafe,
      toastFadeTimerRef,
      toastVisibleTimerRef,
      transientRevokeTimersRef,
      unlockGlobalCursor,
    ]
  );

  const handleInpaintCollapseToggle = React.useCallback(() => {
    const collapseDecision = resolveInpaintCollapseToggleDecision({
      isInpaintCollapsed,
      shouldOpenMarkupModalFromCollapsedTools,
    });
    if (collapseDecision === "open_markup_modal") {
      openMarkupModal();
      return;
    }

    clearWindowTimeoutRef(inpaintCollapseTimerRef);

    if (collapseDecision === "expand_inpaint") {
      setIsInpaintCollapsed(false);
      setIsInpaintCollapsing(false);
      return;
    }

    setIsInpaintCollapsing(true);
    inpaintCollapseTimerRef.current = window.setTimeout(() => {
      setIsInpaintCollapsed(true);
      setIsInpaintCollapsing(false);
      inpaintCollapseTimerRef.current = null;
    }, INPAINT_COLLAPSE_ANIMATION_MS);
  }, [
    inpaintCollapseTimerRef,
    isInpaintCollapsed,
    openMarkupModal,
    setIsInpaintCollapsed,
    setIsInpaintCollapsing,
    shouldOpenMarkupModalFromCollapsedTools,
  ]);

  return {
    handleInpaintCollapseToggle,
  };
}
