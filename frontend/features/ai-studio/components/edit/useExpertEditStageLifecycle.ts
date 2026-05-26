import React from "react";

import type { TransformHistoryEntry } from "./expertEditLayerTransformUtils";
import {
  clearWindowTimeoutRef,
  resolveInpaintCollapseToggleDecision,
  type ObjectUrlRevokeTimers,
} from "./expertEditInteractionUtils";
import { useExpertEditStageCleanup } from "./useExpertEditStageCleanup";
import { useExpertEditStageKeyboardBindings } from "./useExpertEditStageKeyboardBindings";

type UseExpertEditStageLifecycleArgs = {
  panelRootRef: React.RefObject<HTMLElement | null>;
  isMoveToolSelected: boolean;
  clearTransformPointerSession: () => void;
  isMarkupExpandSelected: boolean;
  isMorePresetsSurfaceOpen: boolean;
  setIsMarkupPanSpacePressed: React.Dispatch<React.SetStateAction<boolean>>;
  isMarkupToolSelected: boolean;
  clearMarkupDrawGestureSession: () => void;
  canUndoGeneralAction: boolean;
  canRedoGeneralAction: boolean;
  handleUndoGeneralAction: () => void;
  handleRedoGeneralAction: () => void;
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
  panelRootRef,
  isMoveToolSelected,
  clearTransformPointerSession,
  isMarkupExpandSelected,
  isMorePresetsSurfaceOpen,
  setIsMarkupPanSpacePressed,
  isMarkupToolSelected,
  clearMarkupDrawGestureSession,
  canUndoGeneralAction,
  canRedoGeneralAction,
  handleUndoGeneralAction,
  handleRedoGeneralAction,
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
  useExpertEditStageKeyboardBindings({
    panelRootRef,
    isMarkupExpandSelected,
    isMorePresetsSurfaceOpen,
    setIsMarkupPanSpacePressed,
    canUndoGeneralAction,
    canRedoGeneralAction,
    handleUndoGeneralAction,
    handleRedoGeneralAction,
  });

  useExpertEditStageCleanup({
    unlockGlobalCursor,
    queuePendingHistoryApplyEntry,
    clearHistoryEphemera,
    inpaintCollapseTimerRef,
    toastVisibleTimerRef,
    toastFadeTimerRef,
    transientRevokeTimersRef,
    revokeObjectUrlSafe,
  });

  React.useEffect(() => {
    if (!isMoveToolSelected) {
      clearTransformPointerSession();
    }
  }, [clearTransformPointerSession, isMoveToolSelected]);

  React.useEffect(() => {
    if (isMarkupToolSelected) return;
    clearMarkupDrawGestureSession();
  }, [clearMarkupDrawGestureSession, isMarkupToolSelected]);

  React.useEffect(() => {
    if (!shouldShowInpaintBrushReticle || isMorePresetsSurfaceOpen) {
      unlockGlobalCursor();
    }
  }, [isMorePresetsSurfaceOpen, shouldShowInpaintBrushReticle, unlockGlobalCursor]);

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

    setIsInpaintCollapsing(false);
    setIsInpaintCollapsed(true);
    inpaintCollapseTimerRef.current = null;
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
