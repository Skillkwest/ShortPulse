import React from "react";

import {
  type ExpertEditStageMode,
  useExpertEditStageInteractionRouter,
} from "./useExpertEditStageInteractionRouter";

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
  handleMarkupViewportWheel: (
    event: React.WheelEvent<HTMLDivElement>,
    scope: "inline" | "modal"
  ) => void;
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
  handleMarkupViewportWheel,
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

  const moveStageHandlers = React.useMemo(
    () => ({
      onPointerDown: (
        event: React.PointerEvent<HTMLDivElement>,
        context: { scope: "inline" | "modal" }
      ) => {
        if (context.scope === "modal" && beginMarkupPanGesture(event, context.scope)) return;
        if (!transformEditingEnabled) return;
        handleMovePointerDown(event);
      },
      onPointerMove: (
        event: React.PointerEvent<HTMLDivElement>,
        context: { scope: "inline" | "modal" }
      ) => {
        if (context.scope === "modal" && continueMarkupPanGesture(event)) return;
        if (!transformEditingEnabled) return;
        handleMovePointerMove(event);
      },
      onPointerUp: (
        event: React.PointerEvent<HTMLDivElement>,
        context: { scope: "inline" | "modal" }
      ) => {
        if (context.scope === "modal" && endMarkupPanGesture(event)) return;
        if (!transformEditingEnabled) return;
        endTransformPointerSession(event);
      },
      onPointerCancel: (
        event: React.PointerEvent<HTMLDivElement>,
        context: { scope: "inline" | "modal" }
      ) => {
        if (context.scope === "modal" && endMarkupPanGesture(event)) return;
        if (!transformEditingEnabled) return;
        endTransformPointerSession(event);
      },
      onPointerLeave: (
        event: React.PointerEvent<HTMLDivElement>,
        context: { scope: "inline" | "modal" }
      ) => {
        if (context.scope === "modal" && endMarkupPanGestureOnLeave(event)) return;
        if (!transformEditingEnabled) return;
        handleMovePointerLeave(event);
      },
      onWheel: (
        event: React.WheelEvent<HTMLDivElement>,
        context: { scope: "inline" | "modal" }
      ) => {
        if (context.scope !== "modal") return;
        handleMarkupViewportWheel(event, context.scope);
      },
    }),
    [
      beginMarkupPanGesture,
      continueMarkupPanGesture,
      endMarkupPanGesture,
      endMarkupPanGestureOnLeave,
      endTransformPointerSession,
      handleMarkupViewportWheel,
      handleMovePointerDown,
      handleMovePointerLeave,
      handleMovePointerMove,
      transformEditingEnabled,
    ]
  );

  const inpaintStageHandlers = React.useMemo(
    () => ({
      onPointerDown: (
        event: React.PointerEvent<HTMLDivElement>,
        context: { scope: "inline" | "modal" }
      ) => {
        if (context.scope === "modal" && beginMarkupPanGesture(event, context.scope)) return;
        handleInpaintStagePointerDown(event);
      },
      onPointerMove: (
        event: React.PointerEvent<HTMLDivElement>,
        context: { scope: "inline" | "modal" }
      ) => {
        if (context.scope === "modal" && continueMarkupPanGesture(event)) return;
        handleInpaintStagePointerMove(event);
      },
      onPointerUp: (
        event: React.PointerEvent<HTMLDivElement>,
        context: { scope: "inline" | "modal" }
      ) => {
        if (context.scope === "modal" && endMarkupPanGesture(event)) return;
        handleInpaintStagePointerUp(event);
      },
      onPointerCancel: (
        event: React.PointerEvent<HTMLDivElement>,
        context: { scope: "inline" | "modal" }
      ) => {
        if (context.scope === "modal" && endMarkupPanGesture(event)) return;
        handleInpaintStagePointerCancel(event);
      },
      onPointerLeave: (
        event: React.PointerEvent<HTMLDivElement>,
        context: { scope: "inline" | "modal" }
      ) => {
        if (context.scope === "modal" && endMarkupPanGestureOnLeave(event)) return;
        handleInpaintStagePointerLeave(event);
      },
      onWheel: (
        event: React.WheelEvent<HTMLDivElement>,
        context: { scope: "inline" | "modal" }
      ) => {
        if (context.scope !== "modal") return;
        handleMarkupViewportWheel(event, context.scope);
      },
    }),
    [
      beginMarkupPanGesture,
      continueMarkupPanGesture,
      endMarkupPanGesture,
      endMarkupPanGestureOnLeave,
      handleInpaintStagePointerCancel,
      handleInpaintStagePointerDown,
      handleInpaintStagePointerLeave,
      handleInpaintStagePointerMove,
      handleInpaintStagePointerUp,
      handleMarkupViewportWheel,
    ]
  );

  const markupStageHandlers = React.useMemo(
    () => ({
      onPointerDown: (
        event: React.PointerEvent<HTMLDivElement>,
        context: { scope: "inline" | "modal" }
      ) => {
        if (context.scope === "modal" && beginMarkupPanGesture(event, context.scope)) return;
        beginMarkupDrawGesture(event);
      },
      onPointerMove: (
        event: React.PointerEvent<HTMLDivElement>,
        context: { scope: "inline" | "modal" }
      ) => {
        if (context.scope === "modal" && continueMarkupPanGesture(event)) return;
        continueMarkupDrawGesture(event);
      },
      onPointerUp: handleMarkupStagePointerTerminal,
      onPointerCancel: handleMarkupStagePointerTerminal,
      onPointerLeave: (
        event: React.PointerEvent<HTMLDivElement>,
        context: { scope: "inline" | "modal" }
      ) => {
        if (context.scope === "modal" && endMarkupPanGestureOnLeave(event)) return;
        endMarkupDrawGestureOnLeave(event);
      },
      onWheel: (
        event: React.WheelEvent<HTMLDivElement>,
        context: { scope: "inline" | "modal" }
      ) => {
        if (context.scope !== "modal") return;
        handleMarkupViewportWheel(event, context.scope);
      },
    }),
    [
      beginMarkupDrawGesture,
      beginMarkupPanGesture,
      continueMarkupDrawGesture,
      continueMarkupPanGesture,
      endMarkupDrawGestureOnLeave,
      endMarkupPanGestureOnLeave,
      handleMarkupStagePointerTerminal,
      handleMarkupViewportWheel,
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
