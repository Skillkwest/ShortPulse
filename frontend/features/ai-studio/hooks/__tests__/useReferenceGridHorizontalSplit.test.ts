import { act, renderHook } from "@testing-library/react";
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
      result.current.dividerProps.onKeyDown?.({
        key: "ArrowDown",
        shiftKey: false,
        preventDefault: vi.fn(),
      } as any);
    });

    expect(result.current.topRatio).toBeCloseTo(beforeRatio, 3);
  });

  it("preserves top section pixel height when the split container is resized", () => {
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
});
