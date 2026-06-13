import React from "react";

import {
  type ExpertEditStageMode,
  useExpertEditStageInteractionRouter,
} from "./useExpertEditStageInteractionRouter";
import type { NonPassiveStageWheelEvent } from "./useNonPassiveWheelCapture";

type UseExpertEditStageInteractionsParams = {
  activeStageInteractionMode: ExpertEditStageMode;
  isMorePresetsSurfaceOpen: boolean;
  transformEditingEnabled: boolean;
  beginMarkupPanGesture: (
    event: React.PointerEvent<HTMLDivElement>,
    scope: "inline" | "modal"
  ) => boolean;
  continueMarkupPanGesture: (event: React.PointerEvent<HTMLDivElement>) => boolean;
  endMarkupPanGesture: (event: React.PointerEvent<HTMLDivElement>) => boolean;
  endMarkupPanGestureOnLeave: (event: React.PointerEvent<HTMLDivElement>) => boolean;
  handleStageViewportWheel: (event: NonPassiveStageWheelEvent, scope: "inline" | "modal") => void;
  handleMovePointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  handleMovePointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  handleMovePointerLeave: (event: React.PointerEvent<HTMLDivElement>) => void;
  endTransformPointerSession: (event: React.PointerEvent<HTMLDivElement>) => void;
  beginMarkupDrawGesture: (event: React.PointerEvent<HTMLDivElement>) => boolean;
  continueMarkupDrawGesture: (event: React.PointerEvent<HTMLDivElement>) => boolean;
  endMarkupDrawGesture: (event: React.PointerEvent<HTMLDivElement>) => boolean;
  endMarkupDrawGestureOnLeave: (event: React.PointerEvent<HTMLDivElement>) => boolean;
  handleInpaintStagePointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  handleInpaintStagePointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  handleInpaintStagePointerUp: (event: React.PointerEvent<HTMLDivElement>) => void;
  handleInpaintStagePointerCancel: (event: React.PointerEvent<HTMLDivElement>) => void;
  handleInpaintStagePointerLeave: (event: React.PointerEvent<HTMLDivElement>) => void;
};

export const useExpertEditStageInteractions = ({
  activeStageInteractionMode,
  isMorePresetsSurfaceOpen,
  transformEditingEnabled,
  beginMarkupPanGesture,
  continueMarkupPanGesture,
  endMarkupPanGesture,
  endMarkupPanGestureOnLeave,
  handleStageViewportWheel,
  handleMovePointerDown,
  handleMovePointerMove,
  handleMovePointerLeave,
  endTransformPointerSession,
  beginMarkupDrawGesture,
  continueMarkupDrawGesture,
  endMarkupDrawGesture,
  endMarkupDrawGestureOnLeave,
  handleInpaintStagePointerDown,
  handleInpaintStagePointerMove,
  handleInpaintStagePointerUp,
  handleInpaintStagePointerCancel,
  handleInpaintStagePointerLeave,
}: UseExpertEditStageInteractionsParams) => {
  const handleMarkupStagePointerTerminal = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (endMarkupPanGesture(event)) return;
      endMarkupDrawGesture(event);
    },
    [endMarkupDrawGesture, endMarkupPanGesture]
  );

  const shouldHandlePanGesture = React.useCallback(
    (
      event: React.PointerEvent<HTMLDivElement>,
      context: { scope: "inline" | "modal" },
      handler: (event: React.PointerEvent<HTMLDivElement>, scope: "inline" | "modal") => boolean
    ) => handler(event, context.scope),
    []
  );

  const shouldContinuePanGesture = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => continueMarkupPanGesture(event),
    [continueMarkupPanGesture]
  );

  const shouldEndPanGesture = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => endMarkupPanGesture(event),
    [endMarkupPanGesture]
  );

  const shouldEndPanGestureOnLeave = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => endMarkupPanGestureOnLeave(event),
    [endMarkupPanGestureOnLeave]
  );

  const moveStageHandlers = React.useMemo(
    () => ({
      onPointerDown: (
        event: React.PointerEvent<HTMLDivElement>,
        context: { scope: "inline" | "modal" }
      ) => {
        if (shouldHandlePanGesture(event, context, beginMarkupPanGesture)) return;
        if (!transformEditingEnabled) return;
        handleMovePointerDown(event);
      },
      onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => {
        if (shouldContinuePanGesture(event)) return;
        if (!transformEditingEnabled) return;
        handleMovePointerMove(event);
      },
      onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => {
        if (shouldEndPanGesture(event)) return;
        if (!transformEditingEnabled) return;
        endTransformPointerSession(event);
      },
      onPointerCancel: (event: React.PointerEvent<HTMLDivElement>) => {
        if (shouldEndPanGesture(event)) return;
        if (!transformEditingEnabled) return;
        endTransformPointerSession(event);
      },
      onPointerLeave: (event: React.PointerEvent<HTMLDivElement>) => {
        if (shouldEndPanGestureOnLeave(event)) return;
        if (!transformEditingEnabled) return;
        handleMovePointerLeave(event);
      },
      onWheel: (event: NonPassiveStageWheelEvent, context: { scope: "inline" | "modal" }) => {
        handleStageViewportWheel(event, context.scope);
      },
    }),
    [
      beginMarkupPanGesture,
      endTransformPointerSession,
      handleStageViewportWheel,
      handleMovePointerDown,
      handleMovePointerLeave,
      handleMovePointerMove,
      shouldContinuePanGesture,
      shouldEndPanGesture,
      shouldEndPanGestureOnLeave,
      shouldHandlePanGesture,
      transformEditingEnabled,
    ]
  );

  const inpaintStageHandlers = React.useMemo(
    () => ({
      onPointerDown: (
        event: React.PointerEvent<HTMLDivElement>,
        context: { scope: "inline" | "modal" }
      ) => {
        if (shouldHandlePanGesture(event, context, beginMarkupPanGesture)) return;
        handleInpaintStagePointerDown(event);
      },
      onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => {
        if (shouldContinuePanGesture(event)) return;
        handleInpaintStagePointerMove(event);
      },
      onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => {
        if (shouldEndPanGesture(event)) return;
        handleInpaintStagePointerUp(event);
      },
      onPointerCancel: (event: React.PointerEvent<HTMLDivElement>) => {
        if (shouldEndPanGesture(event)) return;
        handleInpaintStagePointerCancel(event);
      },
      onPointerLeave: (event: React.PointerEvent<HTMLDivElement>) => {
        if (shouldEndPanGestureOnLeave(event)) return;
        handleInpaintStagePointerLeave(event);
      },
      onWheel: (event: NonPassiveStageWheelEvent, context: { scope: "inline" | "modal" }) => {
        handleStageViewportWheel(event, context.scope);
      },
    }),
    [
      beginMarkupPanGesture,
      handleInpaintStagePointerCancel,
      handleInpaintStagePointerDown,
      handleInpaintStagePointerLeave,
      handleInpaintStagePointerMove,
      handleInpaintStagePointerUp,
      handleStageViewportWheel,
      shouldContinuePanGesture,
      shouldEndPanGesture,
      shouldEndPanGestureOnLeave,
      shouldHandlePanGesture,
    ]
  );

  const markupStageHandlers = React.useMemo(
    () => ({
      onPointerDown: (
        event: React.PointerEvent<HTMLDivElement>,
        context: { scope: "inline" | "modal" }
      ) => {
        if (shouldHandlePanGesture(event, context, beginMarkupPanGesture)) return;
        beginMarkupDrawGesture(event);
      },
      onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => {
        if (shouldContinuePanGesture(event)) return;
        continueMarkupDrawGesture(event);
      },
      onPointerUp: handleMarkupStagePointerTerminal,
      onPointerCancel: handleMarkupStagePointerTerminal,
      onPointerLeave: (event: React.PointerEvent<HTMLDivElement>) => {
        if (shouldEndPanGestureOnLeave(event)) return;
        endMarkupDrawGestureOnLeave(event);
      },
      onWheel: (event: NonPassiveStageWheelEvent, context: { scope: "inline" | "modal" }) => {
        handleStageViewportWheel(event, context.scope);
      },
    }),
    [
      beginMarkupPanGesture,
      beginMarkupDrawGesture,
      continueMarkupDrawGesture,
      endMarkupDrawGestureOnLeave,
      handleMarkupStagePointerTerminal,
      handleStageViewportWheel,
      shouldContinuePanGesture,
      shouldEndPanGestureOnLeave,
      shouldHandlePanGesture,
    ]
  );

  const inlineStageInteractionRouter = useExpertEditStageInteractionRouter({
    scope: "inline",
    mode: activeStageInteractionMode,
    isBlocked: isMorePresetsSurfaceOpen,
    moveHandlers: moveStageHandlers,
    inpaintHandlers: inpaintStageHandlers,
    markupHandlers: markupStageHandlers,
  });

  const modalStageInteractionRouter = useExpertEditStageInteractionRouter({
    scope: "modal",
    mode: activeStageInteractionMode,
    moveHandlers: moveStageHandlers,
    inpaintHandlers: inpaintStageHandlers,
    markupHandlers: markupStageHandlers,
  });

  return {
    inlineStageInteractionRouter,
    modalStageInteractionRouter,
  };
};
