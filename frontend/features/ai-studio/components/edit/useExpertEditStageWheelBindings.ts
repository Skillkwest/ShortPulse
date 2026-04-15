import React from "react";

import type { StageViewportSize } from "./expertEditViewportUtils";

type UseExpertEditStageWheelBindingsArgs = {
  isMarkupExpandSelected: boolean;
  isMorePresetsSurfaceOpen: boolean;
  inlineStageWrapperRef: React.RefObject<HTMLDivElement | null>;
  handleNativeStageViewportWheel: (
    event: WheelEvent,
    scope: "inline" | "modal",
    currentTarget: HTMLDivElement
  ) => void;
  markupModalStageRef: React.RefObject<HTMLDivElement | null>;
  markupModalStageSize: StageViewportSize | null;
};

export function useExpertEditStageWheelBindings({
  isMarkupExpandSelected,
  isMorePresetsSurfaceOpen,
  inlineStageWrapperRef,
  handleNativeStageViewportWheel,
  markupModalStageRef,
  markupModalStageSize,
}: UseExpertEditStageWheelBindingsArgs) {
  React.useEffect(() => {
    if (isMarkupExpandSelected) return;
    const inlineStageElement = inlineStageWrapperRef.current;
    if (!inlineStageElement) return;

    const handleInlineStageWheel = (event: WheelEvent) => {
      if (isMorePresetsSurfaceOpen) return;
      handleNativeStageViewportWheel(event, "inline", inlineStageElement);
      if (event.defaultPrevented) {
        event.stopPropagation();
      }
    };

    inlineStageElement.addEventListener("wheel", handleInlineStageWheel, { passive: false });
    return () => {
      inlineStageElement.removeEventListener("wheel", handleInlineStageWheel);
    };
  }, [
    handleNativeStageViewportWheel,
    inlineStageWrapperRef,
    isMarkupExpandSelected,
    isMorePresetsSurfaceOpen,
  ]);

  React.useEffect(() => {
    if (!isMarkupExpandSelected) return;
    const modalStageElement = markupModalStageRef.current;
    if (!modalStageElement) return;

    const handleModalStageWheel = (event: WheelEvent) => {
      handleNativeStageViewportWheel(event, "modal", modalStageElement);
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
    handleNativeStageViewportWheel,
    isMarkupExpandSelected,
    markupModalStageRef,
    markupModalStageSize,
  ]);
}
