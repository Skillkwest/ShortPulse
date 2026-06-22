import { act, renderHook } from "@testing-library/react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useReferenceGridHorizontalSplit } from "../useReferenceGridHorizontalSplit";

class MockResizeObserver {
  private callback: ResizeObserverCallback;

  private static callbacks = new Set<ResizeObserverCallback>();

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    MockResizeObserver.callbacks.add(callback);
  }

  observe() {
    return undefined;
  }
  unobserve() {
    return undefined;
  }
  disconnect() {
    MockResizeObserver.callbacks.delete(this.callback);
    return undefined;
  }

  static trigger() {
    for (const callback of MockResizeObserver.callbacks) {
      callback([], {} as ResizeObserver);
    }
  }

  static reset() {
    MockResizeObserver.callbacks.clear();
  }
}

const createContainer = (height: number): HTMLElement => {
  const element = document.createElement("div");
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      width: 600,
      height,
      right: 600,
      bottom: height,
      toJSON: () => ({}),
    }),
  });
  return element;
};

describe("useReferenceGridHorizontalSplit", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    MockResizeObserver.reset();
  });

  it("returns zero residual when a divider can consume the full delta", () => {
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    const containerRef = { current: createContainer(400) };
    const { result } = renderHook(() =>
      useReferenceGridHorizontalSplit({
        enabled: true,
        containerRef,
        defaultTopRatio: 0.35,
        minTopSectionHeightPx: 100,
        minBottomSectionHeightPx: 100,
      })
    );

    let residual = 0;
    act(() => {
      residual = result.current.nudgeTopSectionHeightByPx(30);
    });

    expect(residual).toBe(0);
    expect(result.current.topRatio).toBeCloseTo(0.425, 3);
  });

  it("returns partial residual when a divider hits bounds", () => {
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    const containerRef = { current: createContainer(400) };
    const { result } = renderHook(() =>
      useReferenceGridHorizontalSplit({
        enabled: true,
        containerRef,
        defaultTopRatio: 0.35,
        minTopSectionHeightPx: 100,
        minBottomSectionHeightPx: 100,
      })
    );

    let residual = 0;
    act(() => {
      residual = result.current.nudgeTopSectionHeightByPx(-100);
    });

    expect(residual).toBeCloseTo(-60, 3);
    expect(result.current.topRatio).toBeCloseTo(0.25, 3);
  });

  it("returns full residual passthrough when bounds pin the divider", () => {
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    const containerRef = { current: createContainer(180) };
    const { result } = renderHook(() =>
      useReferenceGridHorizontalSplit({
        enabled: true,
        containerRef,
        defaultTopRatio: 0.35,
        minTopSectionHeightPx: 120,
        minBottomSectionHeightPx: 120,
      })
    );

    let residual = 0;
    const beforeRatio = result.current.topRatio;
    act(() => {
      residual = result.current.nudgeTopSectionHeightByPx(40);
    });

    expect(residual).toBeCloseTo(40, 3);
    expect(result.current.topRatio).toBeCloseTo(beforeRatio, 3);
  });

  it("caps the bottom section height when a maximum is provided", () => {
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    const containerRef = { current: createContainer(800) };
    const { result } = renderHook(() =>
      useReferenceGridHorizontalSplit({
        enabled: true,
        containerRef,
        defaultTopRatio: 0.2,
        minTopSectionHeightPx: 100,
        minBottomSectionHeightPx: 300,
        maxBottomSectionHeightPx: 420,
      })
    );

    expect(result.current.bottomSectionHeightPx).toBeCloseTo(420, 3);
    expect(result.current.topSectionHeightPx).toBeCloseTo(380, 3);
  });

  it("keeps top ratio pinned at bounds on keyboard overflow", () => {
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    const containerRef = { current: createContainer(400) };
    const { result } = renderHook(() =>
      useReferenceGridHorizontalSplit({
        enabled: true,
        containerRef,
        defaultTopRatio: 0.75,
        minTopSectionHeightPx: 100,
        minBottomSectionHeightPx: 100,
      })
    );

    const beforeRatio = result.current.topRatio;
    act(() => {
      const keyDownEvent = {
        key: "ArrowDown",
        shiftKey: false,
        preventDefault: vi.fn(),
      } as unknown as ReactKeyboardEvent<HTMLDivElement>;
      result.current.dividerProps.onKeyDown?.(keyDownEvent);
    });

    expect(result.current.topRatio).toBeCloseTo(beforeRatio, 3);
  });

  it("ignores non-arrow divider keys without changing the split", () => {
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    const containerRef = { current: createContainer(400) };
    const { result } = renderHook(() =>
      useReferenceGridHorizontalSplit({
        enabled: true,
        containerRef,
        defaultTopRatio: 0.5,
        minTopSectionHeightPx: 100,
        minBottomSectionHeightPx: 100,
      })
    );

    const beforeRatio = result.current.topRatio;
    const preventDefault = vi.fn();

    act(() => {
      result.current.dividerProps.onKeyDown?.({
        key: "Home",
        shiftKey: false,
        preventDefault,
      } as unknown as ReactKeyboardEvent<HTMLDivElement>);
    });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(result.current.topRatio).toBeCloseTo(beforeRatio, 3);
  });

  it("preserves top section pixel height when the split container grows", () => {
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    let containerHeight = 400;
    const containerRef = {
      current: createContainer(containerHeight),
    };
    Object.defineProperty(containerRef.current, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        width: 600,
        height: containerHeight,
        right: 600,
        bottom: containerHeight,
        toJSON: () => ({}),
      }),
    });
    const { result } = renderHook(() =>
      useReferenceGridHorizontalSplit({
        enabled: true,
        containerRef,
        defaultTopRatio: 0.5,
        minTopSectionHeightPx: 100,
        minBottomSectionHeightPx: 100,
      })
    );

    const topHeightBefore = result.current.topSectionHeightPx;
    expect(topHeightBefore).toBeCloseTo(200, 3);

    containerHeight = 520;
    act(() => {
      MockResizeObserver.trigger();
    });

    expect(result.current.topSectionHeightPx).toBeCloseTo(topHeightBefore, 3);
  });

  it("can keep the default ratio when a transient startup height grows", () => {
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    let containerHeight = 40;
    const containerRef = {
      current: createContainer(containerHeight),
    };
    Object.defineProperty(containerRef.current, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        width: 600,
        height: containerHeight,
        right: 600,
        bottom: containerHeight,
        toJSON: () => ({}),
      }),
    });
    const { result } = renderHook(() =>
      useReferenceGridHorizontalSplit({
        enabled: true,
        containerRef,
        defaultTopRatio: 0.4,
        minTopSectionHeightPx: 12,
        minBottomSectionHeightPx: 12,
        preserveTopPixelsOnContainerGrowth: false,
      })
    );

    expect(result.current.topRatio).toBeCloseTo(0.4, 3);

    containerHeight = 600;
    act(() => {
      MockResizeObserver.trigger();
    });

    expect(result.current.topRatio).toBeCloseTo(0.4, 3);
    expect(result.current.topSectionHeightPx).toBeCloseTo(240, 3);
  });

  it("preserves the current top ratio when the split container shrinks", () => {
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    let containerHeight = 400;
    const containerRef = {
      current: createContainer(containerHeight),
    };
    Object.defineProperty(containerRef.current, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        width: 600,
        height: containerHeight,
        right: 600,
        bottom: containerHeight,
        toJSON: () => ({}),
      }),
    });
    const { result } = renderHook(() =>
      useReferenceGridHorizontalSplit({
        enabled: true,
        containerRef,
        defaultTopRatio: 0.5,
        minTopSectionHeightPx: 100,
        minBottomSectionHeightPx: 100,
      })
    );

    const ratioBefore = result.current.topRatio;
    expect(ratioBefore).toBeCloseTo(0.5, 3);

    containerHeight = 320;
    act(() => {
      MockResizeObserver.trigger();
    });

    expect(result.current.topRatio).toBeCloseTo(ratioBefore, 3);
    expect(result.current.topSectionHeightPx).toBeCloseTo(160, 3);
  });

  it("snaps the top section to its maximum height when expanded", () => {
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    const containerRef = { current: createContainer(400) };
    const { result } = renderHook(() =>
      useReferenceGridHorizontalSplit({
        enabled: true,
        containerRef,
        defaultTopRatio: 0.35,
        minTopSectionHeightPx: 100,
        minBottomSectionHeightPx: 100,
        allRefsSnapTopHeightPx: 120,
      })
    );

    act(() => {
      result.current.snapToInventoryExpanded();
    });

    expect(result.current.topRatio).toBeCloseTo(0.75, 3);
    expect(result.current.topSectionHeightPx).toBeCloseTo(300, 3);
  });

  it("tracks the divider to the pointer's absolute Y position while dragging", () => {
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    const containerRef = { current: createContainer(400) };
    const onTopRatioCommit = vi.fn();
    const { result } = renderHook(() =>
      useReferenceGridHorizontalSplit({
        enabled: true,
        containerRef,
        defaultTopRatio: 0.5,
        onTopRatioCommit,
        minTopSectionHeightPx: 100,
        minBottomSectionHeightPx: 100,
      })
    );

    const dividerNode = document.createElement("div");
    Object.assign(dividerNode, {
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
    });

    act(() => {
      result.current.dividerProps.onPointerDown?.({
        pointerId: 101,
        button: 0,
        clientY: 200,
        pointerType: "mouse",
        currentTarget: dividerNode,
        preventDefault: vi.fn(),
      } as unknown as ReactPointerEvent<HTMLDivElement>);
    });

    expect(result.current.isResizing).toBe(true);

    act(() => {
      window.dispatchEvent(new PointerEvent("pointermove", { pointerId: 101, clientY: 120 }));
    });

    expect(result.current.topRatio).toBeCloseTo(0.3, 3);
    expect(onTopRatioCommit).toHaveBeenCalledWith(expect.closeTo(0.3, 3));

    act(() => {
      window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 101, clientY: 120 }));
    });

    expect(result.current.isResizing).toBe(false);
  });
});
