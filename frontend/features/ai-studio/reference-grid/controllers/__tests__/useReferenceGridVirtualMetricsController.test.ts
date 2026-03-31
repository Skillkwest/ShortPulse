import React from "react";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useReferenceGridVirtualMetricsController } from "../useReferenceGridVirtualMetricsController";

class MockResizeObserver {
  static instanceCount = 0;
  static disconnectCount = 0;
  private disconnected = false;

  constructor(callback: ResizeObserverCallback) {
    void callback;
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
    MockResizeObserver.disconnectCount += 1;
    return undefined;
  }

  static reset() {
    MockResizeObserver.instanceCount = 0;
    MockResizeObserver.disconnectCount = 0;
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
};

const useHarness = ({ isWideLayout, outputsLength, curatedOutputsLength }: HarnessProps) => {
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

  useReferenceGridVirtualMetricsController({
    isCuratedSplitEnabled: false,
    isWideLayout,
    outputsLength,
    curatedOutputsLength,
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

  it("preserves scrollTop when measurement sync reruns for output-count changes", () => {
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

    expect(result.current.virtualMetrics.scrollTop).toBe(0);

    act(() => {
      result.current.setVirtualMetrics((prev) => ({
        ...prev,
        scrollTop: 264,
      }));
    });

    rerender({
      isWideLayout: false,
      outputsLength: 18,
      curatedOutputsLength: 0,
    });

    expect(result.current.virtualMetrics.scrollTop).toBe(264);
  });
});
