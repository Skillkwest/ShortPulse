import React from "react";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  createDefaultMarkupViewportState,
  createIdleMarkupPanPointerSession,
} from "../expertEditViewportUtils";
import { useExpertEditStageViewportController } from "../useExpertEditStageViewportController";

const createStageElement = (rect: DOMRect) => {
  const element = document.createElement("div") as HTMLDivElement & {
    setPointerCapture: (pointerId: number) => void;
    releasePointerCapture: (pointerId: number) => void;
  };
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () => rect,
  });
  element.setPointerCapture = vi.fn();
  element.releasePointerCapture = vi.fn();
  return element;
};

const createPointerEvent = ({
  currentTarget,
  pointerId,
  button = 0,
  buttons = 1,
  clientX = 100,
  clientY = 100,
}: {
  currentTarget: HTMLDivElement;
  pointerId: number;
  button?: number;
  buttons?: number;
  clientX?: number;
  clientY?: number;
}) =>
  ({
    currentTarget,
    pointerId,
    pointerType: "mouse",
    button,
    buttons,
    clientX,
    clientY,
    preventDefault: vi.fn(),
  }) as unknown as React.PointerEvent<HTMLDivElement>;

describe("useExpertEditStageViewportController", () => {
  it("starts a pan gesture from primary pointer drag while spacebar pan mode is armed", () => {
    const stageRect = {
      left: 0,
      top: 0,
      width: 240,
      height: 180,
      right: 240,
      bottom: 180,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect;
    const stageElement = createStageElement(stageRect);

    const { result } = renderHook(() => {
      const [markupViewport, setMarkupViewport] = React.useState(createDefaultMarkupViewportState);
      const [moveStageZoomSliderValue, setMoveStageZoomSliderValue] = React.useState(50);
      const [isMarkupPanDragging, setIsMarkupPanDragging] = React.useState(false);
      const [inlineStageViewportSize, setInlineStageViewportSize] = React.useState({
        width: 1,
        height: 1,
      });
      const [markupModalViewportSize, setMarkupModalViewportSize] = React.useState({
        width: 1,
        height: 1,
      });
      const markupPanPointerSessionRef = React.useRef(createIdleMarkupPanPointerSession());

      const controller = useExpertEditStageViewportController({
        markupViewport,
        shouldApplyMarkupViewport: true,
        isMarkupPanSpacePressed: true,
        markupPanPointerSessionRef,
        setMoveStageZoomSliderValue,
        setMarkupViewport,
        setIsMarkupPanDragging,
        setInlineStageViewportSize,
        setMarkupModalViewportSize,
      });

      return {
        controller,
        inlineStageViewportSize,
        isMarkupPanDragging,
        markupModalViewportSize,
        markupPanPointerSessionRef,
        markupViewport,
        moveStageZoomSliderValue,
      };
    });

    let began = false;
    act(() => {
      began = result.current.controller.beginMarkupPanGesture(
        createPointerEvent({
          currentTarget: stageElement,
          pointerId: 41,
        }),
        "modal"
      );
    });

    expect(began).toBe(true);
    expect(result.current.isMarkupPanDragging).toBe(true);
    expect(result.current.markupPanPointerSessionRef.current.active).toBe(true);
    expect(result.current.markupPanPointerSessionRef.current.pointerId).toBe(41);
    expect(stageElement.setPointerCapture).toHaveBeenCalledWith(41);
  });
});
