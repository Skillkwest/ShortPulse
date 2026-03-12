/**
 * Shared stage pointer/wheel router for Expert Edit inline + modal surfaces.
 * Keeps tool lifecycle routing in one place so both surfaces honor the same behavior contract.
 */
import React from "react";

export type ExpertEditStageScope = "inline" | "modal";
export type ExpertEditStageMode = "move" | "inpaint" | "markup";

type StageInteractionContext = {
  scope: ExpertEditStageScope;
  mode: ExpertEditStageMode;
};

type StagePointerHandler = (
  event: React.PointerEvent<HTMLDivElement>,
  context: StageInteractionContext
) => void;

type StageWheelHandler = (
  event: React.WheelEvent<HTMLDivElement>,
  context: StageInteractionContext
) => void;

export type ExpertEditStageHandlers = {
  onPointerDown: StagePointerHandler;
  onPointerMove: StagePointerHandler;
  onPointerUp: StagePointerHandler;
  onPointerCancel: StagePointerHandler;
  onPointerLeave: StagePointerHandler;
  onWheel?: StageWheelHandler;
};

type UseExpertEditStageInteractionRouterParams = {
  scope: ExpertEditStageScope;
  mode: ExpertEditStageMode;
  isBlocked?: boolean;
  moveHandlers: ExpertEditStageHandlers;
  inpaintHandlers: ExpertEditStageHandlers;
  markupHandlers: ExpertEditStageHandlers;
};

type UseExpertEditStageInteractionRouterResult = {
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerLeave: (event: React.PointerEvent<HTMLDivElement>) => void;
  onWheel: (event: React.WheelEvent<HTMLDivElement>) => void;
};

const resolveHandlersByMode = ({
  mode,
  moveHandlers,
  inpaintHandlers,
  markupHandlers,
}: Omit<
  UseExpertEditStageInteractionRouterParams,
  "scope" | "isBlocked"
>): ExpertEditStageHandlers => {
  if (mode === "move") return moveHandlers;
  if (mode === "inpaint") return inpaintHandlers;
  return markupHandlers;
};

/**
 * Routes stage pointer lifecycle by active tool mode while preserving surface scope context.
 */
export const useExpertEditStageInteractionRouter = ({
  scope,
  mode,
  isBlocked = false,
  moveHandlers,
  inpaintHandlers,
  markupHandlers,
}: UseExpertEditStageInteractionRouterParams): UseExpertEditStageInteractionRouterResult => {
  const activeHandlers = React.useMemo(
    () =>
      resolveHandlersByMode({
        mode,
        moveHandlers,
        inpaintHandlers,
        markupHandlers,
      }),
    [inpaintHandlers, markupHandlers, mode, moveHandlers]
  );

  const context = React.useMemo(
    () =>
      ({
        scope,
        mode,
      }) satisfies StageInteractionContext,
    [mode, scope]
  );

  const onPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isBlocked) return;
      activeHandlers.onPointerDown(event, context);
    },
    [activeHandlers, context, isBlocked]
  );

  const onPointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isBlocked) return;
      activeHandlers.onPointerMove(event, context);
    },
    [activeHandlers, context, isBlocked]
  );

  const onPointerUp = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isBlocked) return;
      activeHandlers.onPointerUp(event, context);
    },
    [activeHandlers, context, isBlocked]
  );

  const onPointerCancel = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isBlocked) return;
      activeHandlers.onPointerCancel(event, context);
    },
    [activeHandlers, context, isBlocked]
  );

  const onPointerLeave = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isBlocked) return;
      activeHandlers.onPointerLeave(event, context);
    },
    [activeHandlers, context, isBlocked]
  );

  const onWheel = React.useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (isBlocked) return;
      activeHandlers.onWheel?.(event, context);
    },
    [activeHandlers, context, isBlocked]
  );

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onPointerLeave,
    onWheel,
  };
};
