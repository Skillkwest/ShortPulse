import React from "react";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useExpertEditStageInteractions } from "../useExpertEditStageInteractions";
import type { NonPassiveStageWheelEvent } from "../useNonPassiveWheelCapture";

const createPointerEvent = () => ({}) as React.PointerEvent<HTMLDivElement>;
const createWheelEvent = () => ({}) as NonPassiveStageWheelEvent;

const buildArgs = (activeStageInteractionMode: "move" | "inpaint" | "markup" = "move") => ({
  activeStageInteractionMode,
  isMorePresetsSurfaceOpen: false,
  transformEditingEnabled: true,
  beginMarkupPanGesture: vi.fn(() => false),
  continueMarkupPanGesture: vi.fn(() => false),
  endMarkupPanGesture: vi.fn(() => false),
  endMarkupPanGestureOnLeave: vi.fn(() => false),
  handleStageViewportWheel: vi.fn(),
  handleMovePointerDown: vi.fn(),
  handleMovePointerMove: vi.fn(),
  handleMovePointerLeave: vi.fn(),
  endTransformPointerSession: vi.fn(),
  beginMarkupDrawGesture: vi.fn(() => false),
  continueMarkupDrawGesture: vi.fn(() => false),
  endMarkupDrawGesture: vi.fn(() => false),
  endMarkupDrawGestureOnLeave: vi.fn(() => false),
  handleInpaintStagePointerDown: vi.fn(),
  handleInpaintStagePointerMove: vi.fn(),
  handleInpaintStagePointerUp: vi.fn(),
  handleInpaintStagePointerCancel: vi.fn(),
  handleInpaintStagePointerLeave: vi.fn(),
});

describe("useExpertEditStageInteractions", () => {
  it("short-circuits modal move pointer down when a pan gesture starts", () => {
    const args = buildArgs("move");
    args.beginMarkupPanGesture.mockReturnValue(true);

    const { result } = renderHook(() => useExpertEditStageInteractions(args));

    act(() => {
      result.current.modalStageInteractionRouter.onPointerDown(createPointerEvent());
    });

    expect(args.beginMarkupPanGesture).toHaveBeenCalledTimes(1);
    expect(args.handleMovePointerDown).not.toHaveBeenCalled();
  });

  it("short-circuits inline move pointer down when a pan gesture starts", () => {
    const args = buildArgs("move");
    args.beginMarkupPanGesture.mockReturnValue(true);

    const { result } = renderHook(() => useExpertEditStageInteractions(args));

    act(() => {
      result.current.inlineStageInteractionRouter.onPointerDown(createPointerEvent());
    });

    expect(args.beginMarkupPanGesture).toHaveBeenCalledTimes(1);
    expect(args.handleMovePointerDown).not.toHaveBeenCalled();
  });

  it("short-circuits modal inpaint pointer move while pan is active", () => {
    const args = buildArgs("inpaint");
    args.continueMarkupPanGesture.mockReturnValue(true);

    const { result } = renderHook(() => useExpertEditStageInteractions(args));

    act(() => {
      result.current.modalStageInteractionRouter.onPointerMove(createPointerEvent());
    });

    expect(args.continueMarkupPanGesture).toHaveBeenCalledTimes(1);
    expect(args.handleInpaintStagePointerMove).not.toHaveBeenCalled();
  });

  it("still routes modal wheel events through the viewport handler", () => {
    const args = buildArgs("markup");

    const { result } = renderHook(() => useExpertEditStageInteractions(args));

    act(() => {
      result.current.modalStageInteractionRouter.onWheel(createWheelEvent());
    });

    expect(args.handleStageViewportWheel).toHaveBeenCalledTimes(1);
  });

  it("routes inline wheel events through the viewport handler too", () => {
    const args = buildArgs("move");

    const { result } = renderHook(() => useExpertEditStageInteractions(args));

    act(() => {
      result.current.inlineStageInteractionRouter.onWheel(createWheelEvent());
    });

    expect(args.handleStageViewportWheel).toHaveBeenCalledTimes(1);
  });
});
