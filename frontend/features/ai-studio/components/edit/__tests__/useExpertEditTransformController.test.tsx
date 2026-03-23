/**
 * Verifies move-stage transform controller math under wrapper-authoritative camera offsets.
 */
import React from "react";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { defaultLayerTransform } from "../expertEditLayerTransformUtils";
import {
  createIdleTransformPointerSession,
  type TransformPointerSession,
} from "../expertEditInteractionUtils";
import type { ExpertEditLayer } from "../expertEditLayerSessionUtils";
import { useExpertEditTransformController } from "../useExpertEditTransformController";

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
  clientX,
  clientY,
  pointerId,
  shiftKey = false,
}: {
  currentTarget: HTMLDivElement;
  clientX: number;
  clientY: number;
  pointerId: number;
  shiftKey?: boolean;
}) =>
  ({
    currentTarget,
    target: currentTarget,
    clientX,
    clientY,
    pointerId,
    pointerType: "mouse",
    button: 0,
    altKey: false,
    shiftKey,
    preventDefault: vi.fn(),
  }) as unknown as React.PointerEvent<HTMLDivElement>;

describe("useExpertEditTransformController", () => {
  it("uses wrapper-authoritative viewport offset pixels for inline resize math", () => {
    const stageRect = {
      left: 0,
      top: 0,
      width: 200,
      height: 200,
      right: 200,
      bottom: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect;
    const stageElement = createStageElement(stageRect);
    const initialLayer: ExpertEditLayer = {
      id: "layer-1",
      name: "layer 1",
      imageUrl: "https://example.com/layer-1.png",
      opacity: 1,
      isAutoNamed: true,
      ownsImageUrl: false,
      transform: defaultLayerTransform(),
    };
    const commitTransformHistoryTransition = vi.fn();

    const { result } = renderHook(() => {
      const [layers, setLayers] = React.useState<ExpertEditLayer[]>([initialLayer]);
      const [activeTransformDragMode, setActiveTransformDragMode] =
        React.useState<TransformPointerSession["dragMode"]>("move");
      const [isTransformPointerDragging, setIsTransformPointerDragging] = React.useState(false);
      const transformPointerSessionRef = React.useRef(createIdleTransformPointerSession());
      const transformGestureBaselineRef = React.useRef(null);

      const controller = useExpertEditTransformController({
        layers,
        selectedLayer: layers[0] ?? null,
        sceneZoomScale: 2,
        shouldApplyViewportTransform: true,
        viewportOffsetXRatio: 0.25,
        viewportOffsetYRatio: 0,
        resolveViewportOffsetPixels: () => ({
          offsetX: 60,
          offsetY: 0,
        }),
        transformPointerSessionRef,
        transformGestureBaselineRef,
        setLayers,
        setActiveTransformDragMode,
        setIsTransformPointerDragging,
        commitTransformHistoryTransition,
        showStatusToast: vi.fn(),
      });

      return {
        activeTransformDragMode,
        controller,
        isTransformPointerDragging,
        layers,
      };
    });

    act(() => {
      result.current.controller.handleMovePointerDown(
        createPointerEvent({
          currentTarget: stageElement,
          clientX: 200,
          clientY: 100,
          pointerId: 51,
          shiftKey: true,
        })
      );
    });

    act(() => {
      result.current.controller.handleMovePointerMove(
        createPointerEvent({
          currentTarget: stageElement,
          clientX: 240,
          clientY: 100,
          pointerId: 51,
          shiftKey: true,
        })
      );
    });

    expect(result.current.activeTransformDragMode).toBe("resize");
    expect(result.current.isTransformPointerDragging).toBe(true);
    expect(result.current.layers[0]?.transform.scale ?? 0).toBeCloseTo(2, 6);

    act(() => {
      result.current.controller.endTransformPointerSession(
        createPointerEvent({
          currentTarget: stageElement,
          clientX: 240,
          clientY: 100,
          pointerId: 51,
          shiftKey: true,
        })
      );
    });

    expect(commitTransformHistoryTransition).toHaveBeenCalledTimes(1);
  });
});
