/**
 * Native non-passive wheel capture binding for stage-like surfaces.
 * Lets zoom/pan controllers legally call preventDefault without relying on
 * React's synthetic wheel listener passiveness.
 */
import React from "react";

export type NonPassiveStageWheelEvent = WheelEvent & {
  currentTarget: HTMLDivElement;
};

export type NonPassiveStageWheelHandler = (event: NonPassiveStageWheelEvent) => void;

/**
 * Attaches a capture-phase wheel listener with passive disabled.
 */
export const useNonPassiveWheelCapture = ({
  targetRef,
  onWheel,
}: {
  targetRef: React.RefObject<HTMLDivElement | null>;
  onWheel?: NonPassiveStageWheelHandler;
}): void => {
  React.useEffect(() => {
    const target = targetRef.current;
    if (!target || !onWheel) return;

    const handleWheel = (event: WheelEvent) => {
      onWheel(event as NonPassiveStageWheelEvent);
    };

    target.addEventListener("wheel", handleWheel, {
      capture: true,
      passive: false,
    });
    return () => {
      target.removeEventListener("wheel", handleWheel, {
        capture: true,
      });
    };
  }, [onWheel, targetRef]);
};
