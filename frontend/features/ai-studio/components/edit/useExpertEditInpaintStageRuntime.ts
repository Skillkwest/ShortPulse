import React from "react";

import { buildInpaintBrushReticleCursor } from "./expertEditCursorUtils";
import { runPointerStageTerminalAction } from "./expertEditInteractionUtils";

type UseExpertEditInpaintStageRuntimeArgs = {
  shouldShowInpaintBrushReticle: boolean;
  inpaintStrokeSize: number;
  activeStageRenderScale: number;
  lockGlobalCursor: (cursor: string) => void;
  unlockGlobalCursor: () => void;
  beginInpaintGestureHistory: () => void;
  finalizeInpaintGestureHistory: () => void;
  handleInpaintPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  handleInpaintPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  handleInpaintPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void;
  handleInpaintPointerCancel: (event: React.PointerEvent<HTMLDivElement>) => void;
  handleInpaintPointerLeave: (event: React.PointerEvent<HTMLDivElement>) => void;
};

export function useExpertEditInpaintStageRuntime({
  shouldShowInpaintBrushReticle,
  inpaintStrokeSize,
  activeStageRenderScale,
  lockGlobalCursor,
  unlockGlobalCursor,
  beginInpaintGestureHistory,
  finalizeInpaintGestureHistory,
  handleInpaintPointerDown,
  handleInpaintPointerMove,
  handleInpaintPointerUp,
  handleInpaintPointerCancel,
  handleInpaintPointerLeave,
}: UseExpertEditInpaintStageRuntimeArgs) {
  const handleInpaintStagePointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (shouldShowInpaintBrushReticle) {
        lockGlobalCursor(buildInpaintBrushReticleCursor(inpaintStrokeSize, activeStageRenderScale));
      }
      beginInpaintGestureHistory();
      handleInpaintPointerDown(event);
    },
    [
      activeStageRenderScale,
      beginInpaintGestureHistory,
      handleInpaintPointerDown,
      inpaintStrokeSize,
      lockGlobalCursor,
      shouldShowInpaintBrushReticle,
    ]
  );

  const handleInpaintStagePointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      handleInpaintPointerMove(event);
    },
    [handleInpaintPointerMove]
  );

  const handleInpaintStagePointerUp = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      runPointerStageTerminalAction({
        event,
        unlockCursor: unlockGlobalCursor,
        handlePointerEvent: handleInpaintPointerUp,
        finalizeGestureHistory: finalizeInpaintGestureHistory,
      });
    },
    [finalizeInpaintGestureHistory, handleInpaintPointerUp, unlockGlobalCursor]
  );

  const handleInpaintStagePointerCancel = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      runPointerStageTerminalAction({
        event,
        unlockCursor: unlockGlobalCursor,
        handlePointerEvent: handleInpaintPointerCancel,
        finalizeGestureHistory: finalizeInpaintGestureHistory,
      });
    },
    [finalizeInpaintGestureHistory, handleInpaintPointerCancel, unlockGlobalCursor]
  );

  const handleInpaintStagePointerLeave = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      runPointerStageTerminalAction({
        event,
        unlockCursor: unlockGlobalCursor,
        handlePointerEvent: handleInpaintPointerLeave,
        finalizeGestureHistory: finalizeInpaintGestureHistory,
      });
    },
    [finalizeInpaintGestureHistory, handleInpaintPointerLeave, unlockGlobalCursor]
  );

  return {
    handleInpaintStagePointerDown,
    handleInpaintStagePointerMove,
    handleInpaintStagePointerUp,
    handleInpaintStagePointerCancel,
    handleInpaintStagePointerLeave,
  };
}
