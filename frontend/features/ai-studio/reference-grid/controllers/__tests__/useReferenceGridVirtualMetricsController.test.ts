import React from "react";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useReferenceGridVirtualMetricsController } from "../useReferenceGridVirtualMetricsController";

class MockResizeObserver {
  static instanceCount = 0;
  static disconnectCount = 0;
  private static callbacks = new Set<ResizeObserverCallback>();
  private disconnected = false;
  private callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    MockResizeObserver.callbacks.add(callback);
    MockResizeObserver.instanceCount += 1;
  }

  observe() {
    return undefined;
  }

  unobserve() {
    return undefined;
  }

  disconnect() {
    if (this.disconnected) return undefined;
    this.disconnected = true;
    MockResizeObserver.callbacks.delete(this.callback);
    MockResizeObserver.disconnectCount += 1;
    return undefined;
  }

  static trigger() {
    for (const callback of MockResizeObserver.callbacks) {
      callback([], {} as ResizeObserver);
    }
  }

  static reset() {
    MockResizeObserver.instanceCount = 0;
    MockResizeObserver.disconnectCount = 0;
    MockResizeObserver.callbacks.clear();
  }
}

const createMeasuredElement = ({
  clientWidth = 620,
  clientHeight = 480,
  scrollTop = 12,
}: {
  clientWidth?: number;
  clientHeight?: number;
  scrollTop?: number;
} = {}): HTMLDivElement => {
  const element = document.createElement("div");
  element.style.gap = "4px";
  element.style.paddingLeft = "0px";
  element.style.paddingRight = "0px";
  Object.defineProperty(element, "clientWidth", {
    configurable: true,
    value: clientWidth,
  });
  Object.defineProperty(element, "clientHeight", {
    configurable: true,
    value: clientHeight,
  });
  Object.defineProperty(element, "scrollTop", {
    configurable: true,
    value: scrollTop,
    writable: true,
  });
  return element;
};

type HarnessProps = {
  isWideLayout: boolean;
  outputsLength: number;
  curatedOutputsLength: number;
  perfDegradeLevel?: 0 | 1 | 2;
  suspendMeasurements?: boolean;
  outputIds?: string[];
  curatedOutputIds?: string[];
};

const createOutputIds = (count: number, prefix: string) =>
  Array.from({ length: count }, (_, index) => `${prefix}-${index + 1}`);

const useHarness = ({
  isWideLayout,
  outputsLength,
  curatedOutputsLength,
  perfDegradeLevel = 0,
  suspendMeasurements = false,
  outputIds,
  curatedOutputIds,
}: HarnessProps) => {
  const [virtualMetrics, setVirtualMetrics] = React.useState({
    scrollTop: 0,
    viewportHeight: 0,
    columnCount: 1,
    rowHeight: 220,
  });
  const [curatedVirtualMetrics, setCuratedVirtualMetrics] = React.useState({
    scrollTop: 0,
    viewportHeight: 0,
    columnCount: 1,
    rowHeight: 220,
  });
  const scrollNode = React.useMemo(() => createMeasuredElement({ clientHeight: 420 }), []);
  const gridNode = React.useMemo(() => createMeasuredElement({ clientWidth: 640 }), []);
  const curatedScrollNode = React.useMemo(() => createMeasuredElement({ clientHeight: 240 }), []);
  const curatedGridNode = React.useMemo(() => createMeasuredElement({ clientWidth: 320 }), []);
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(scrollNode);
  const gridRef = React.useRef<HTMLDivElement | null>(gridNode);
  const curatedScrollContainerRef = React.useRef<HTMLDivElement | null>(curatedScrollNode);
  const curatedGridRef = React.useRef<HTMLDivElement | null>(curatedGridNode);
  const resolvedOutputIds = React.useMemo(
    () => outputIds ?? createOutputIds(outputsLength, "out"),
    [outputIds, outputsLength]
  );
  const resolvedCuratedOutputIds = React.useMemo(
    () => curatedOutputIds ?? createOutputIds(curatedOutputsLength, "curated"),
    [curatedOutputIds, curatedOutputsLength]
  );

  useReferenceGridVirtualMetricsController({
    isCuratedSplitEnabled: false,
    isWideLayout,
    outputsLength,
    curatedOutputsLength,
    outputIds: resolvedOutputIds,
    curatedOutputIds: resolvedCuratedOutputIds,
    perfDegradeLevel,
    suspendMeasurements,
    scrollContainerRef,
    gridRef,
    curatedScrollContainerRef,
    curatedGridRef,
    setVirtualMetrics,
    setCuratedVirtualMetrics,
    config: {
      referenceGridMinColumns: 2,
      referenceGridMinCardPx: 124,
      referenceGridMinCardPxWide: 124,
      referenceGridMaxColumns: 5,
      referenceGridMaxColumnsWide: 5,
      quickSlotInventoryMaxColumns: 5,
      fallbackReferenceRowHeight: 220,
    },
  });

  return {
    virtualMetrics,
    curatedVirtualMetrics,
    scrollNode,
    setVirtualMetrics,
  };
};

describe("useReferenceGridVirtualMetricsController", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    MockResizeObserver.reset();
  });

  it("does not recreate resize observers when output counts change without layout changes", () => {
    vi.stubGlobal("ResizeObserver", MockResizeObserver);

    const { rerender } = renderHook(
      ({ isWideLayout, outputsLength, curatedOutputsLength }: HarnessProps) =>
        useHarness({ isWideLayout, outputsLength, curatedOutputsLength }),
      {
        initialProps: {
          isWideLayout: false,
          outputsLength: 12,
          curatedOutputsLength: 0,
        },
      }
    );

    expect(MockResizeObserver.instanceCount).toBe(1);
    expect(MockResizeObserver.disconnectCount).toBe(0);

    rerender({
      isWideLayout: false,
      outputsLength: 18,
      curatedOutputsLength: 0,
    });

    expect(MockResizeObserver.instanceCount).toBe(1);
    expect(MockResizeObserver.disconnectCount).toBe(0);
  });

  it("recreates resize observers when the layout mode changes", () => {
    vi.stubGlobal("ResizeObserver", MockResizeObserver);

    const { rerender } = renderHook(
      ({ isWideLayout, outputsLength, curatedOutputsLength }: HarnessProps) =>
        useHarness({ isWideLayout, outputsLength, curatedOutputsLength }),
      {
        initialProps: {
          isWideLayout: false,
          outputsLength: 12,
          curatedOutputsLength: 0,
        },
      }
    );

    expect(MockResizeObserver.instanceCount).toBe(1);

    rerender({
      isWideLayout: true,
      outputsLength: 12,
      curatedOutputsLength: 0,
    });

    expect(MockResizeObserver.instanceCount).toBeGreaterThan(1);
    expect(MockResizeObserver.disconnectCount).toBeGreaterThan(0);
  });

  it("re-reads the live scrollTop when measurement sync reruns for output-count changes", () => {
    const { result, rerender } = renderHook(
      ({ isWideLayout, outputsLength, curatedOutputsLength }: HarnessProps) =>
        useHarness({ isWideLayout, outputsLength, curatedOutputsLength }),
      {
        initialProps: {
          isWideLayout: false,
          outputsLength: 12,
          curatedOutputsLength: 0,
        },
      }
    );

    expect(result.current.virtualMetrics.scrollTop).toBe(12);

    act(() => {
      result.current.setVirtualMetrics((prev) => ({
        ...prev,
        scrollTop: 264,
      }));
    });
    act(() => {
      Object.defineProperty(result.current.scrollNode, "scrollTop", {
        configurable: true,
        value: 312,
        writable: true,
      });
    });

    rerender({
      isWideLayout: false,
      outputsLength: 18,
      curatedOutputsLength: 0,
    });

    expect(result.current.virtualMetrics.scrollTop).toBe(312);
  });

  it("caps measured columns for high-density pressure", () => {
    const { result } = renderHook(() =>
      useHarness({
        isWideLayout: true,
        outputsLength: 260,
        curatedOutputsLength: 0,
        perfDegradeLevel: 2,
      })
    );

    expect(result.current.virtualMetrics.columnCount).toBe(4);
  });

  it("pins prepends to the top when the user is already at the top", () => {
    const { result, rerender } = renderHook(
      ({ isWideLayout, outputsLength, curatedOutputsLength, outputIds }: HarnessProps) =>
        useHarness({ isWideLayout, outputsLength, curatedOutputsLength, outputIds }),
      {
        initialProps: {
          isWideLayout: false,
          outputsLength: 2,
          curatedOutputsLength: 0,
          outputIds: ["out-1", "out-2"],
        },
      }
    );

    act(() => {
      result.current.setVirtualMetrics((prev) => ({
        ...prev,
        scrollTop: 0,
      }));
    });
    act(() => {
      Object.defineProperty(result.current.scrollNode, "scrollTop", {
        configurable: true,
        value: 180,
        writable: true,
      });
    });

    rerender({
      isWideLayout: false,
      outputsLength: 3,
      curatedOutputsLength: 0,
      outputIds: ["out-new", "out-1", "out-2"],
    });

    expect(result.current.virtualMetrics.scrollTop).toBe(0);
    expect(result.current.scrollNode.scrollTop).toBe(0);
  });

  it("skips resize measurements while suspended and resyncs once resumed", () => {
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);

    const { result, rerender } = renderHook(
      ({ suspendMeasurements }: HarnessProps) =>
        useHarness({
          isWideLayout: false,
          outputsLength: 80,
          curatedOutputsLength: 0,
          suspendMeasurements,
        }),
      {
        initialProps: {
          isWideLayout: false,
          outputsLength: 80,
          curatedOutputsLength: 0,
          suspendMeasurements: false,
        },
      }
    );

    expect(result.current.virtualMetrics.scrollTop).toBe(12);

    rerender({
      isWideLayout: false,
      outputsLength: 80,
      curatedOutputsLength: 0,
      suspendMeasurements: true,
    });

    act(() => {
      result.current.scrollNode.scrollTop = 240;
      MockResizeObserver.trigger();
    });

    expect(result.current.virtualMetrics.scrollTop).toBe(12);

    rerender({
      isWideLayout: false,
      outputsLength: 80,
      curatedOutputsLength: 0,
      suspendMeasurements: false,
    });

    expect(result.current.virtualMetrics.scrollTop).toBe(240);
    expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(1);
  });
});
