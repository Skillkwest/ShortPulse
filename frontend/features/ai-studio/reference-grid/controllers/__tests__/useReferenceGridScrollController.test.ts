import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useReferenceGridScrollController } from "../useReferenceGridScrollController";

type VirtualMetricsState = {
  scrollTop: number;
  viewportHeight: number;
  columnCount: number;
  rowHeight: number;
};

const installRafQueue = () => {
  let nextFrameId = 1;
  const callbacks = new Map<number, FrameRequestCallback>();
  const requestAnimationFrameMock = vi.fn((callback: FrameRequestCallback) => {
    const frameId = nextFrameId;
    nextFrameId += 1;
    callbacks.set(frameId, callback);
    return frameId;
  });
  const cancelAnimationFrameMock = vi.fn((frameId: number) => {
    callbacks.delete(frameId);
  });

  vi.stubGlobal("requestAnimationFrame", requestAnimationFrameMock);
  vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrameMock);

  const flushNextFrame = () => {
    const nextEntry = callbacks.entries().next().value as
      | [number, FrameRequestCallback]
      | undefined;
    if (!nextEntry) return false;
    const [frameId, callback] = nextEntry;
    callbacks.delete(frameId);
    callback(0);
    return true;
  };

  return {
    requestAnimationFrameMock,
    cancelAnimationFrameMock,
    flushNextFrame,
  };
};

const createScrollEvent = ({
  scrollTop,
  clientHeight = 420,
}: {
  scrollTop: number;
  clientHeight?: number;
}) =>
  ({
    currentTarget: {
      scrollTop,
      clientHeight,
      scrollHeight: 2400,
    },
  }) as React.UIEvent<HTMLDivElement>;

describe("useReferenceGridScrollController", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("skips all-refs metric commits when scroll stays within the same virtual row", () => {
    const { flushNextFrame } = installRafQueue();
    const setVirtualMetrics = vi.fn((updater: React.SetStateAction<VirtualMetricsState>) =>
      typeof updater === "function"
        ? updater({
            scrollTop: 0,
            viewportHeight: 420,
            columnCount: 3,
            rowHeight: 220,
          })
        : updater
    );
    const setCuratedVirtualMetrics = vi.fn();

    const { result } = renderHook(() =>
      useReferenceGridScrollController({
        setVirtualMetrics,
        setCuratedVirtualMetrics,
        outputsLength: 20,
        renderedItemCount: 10,
      })
    );

    act(() => {
      result.current.handleAllRefsScroll(createScrollEvent({ scrollTop: 120 }));
      flushNextFrame();
    });

    expect(setVirtualMetrics).toHaveBeenCalledTimes(1);
    const updater = setVirtualMetrics.mock.calls[0]?.[0] as (
      prev: VirtualMetricsState
    ) => VirtualMetricsState;
    const previousState = {
      scrollTop: 0,
      viewportHeight: 420,
      columnCount: 3,
      rowHeight: 220,
    };
    expect(updater(previousState)).toBe(previousState);
  });

  it("commits all-refs metric updates when scroll crosses into a new virtual row", () => {
    const { flushNextFrame } = installRafQueue();
    const setVirtualMetrics = vi.fn((updater: React.SetStateAction<VirtualMetricsState>) =>
      typeof updater === "function"
        ? updater({
            scrollTop: 0,
            viewportHeight: 420,
            columnCount: 3,
            rowHeight: 220,
          })
        : updater
    );
    const setCuratedVirtualMetrics = vi.fn();

    const { result } = renderHook(() =>
      useReferenceGridScrollController({
        setVirtualMetrics,
        setCuratedVirtualMetrics,
        outputsLength: 20,
        renderedItemCount: 10,
      })
    );

    act(() => {
      result.current.handleAllRefsScroll(createScrollEvent({ scrollTop: 260 }));
      flushNextFrame();
    });

    const updater = setVirtualMetrics.mock.calls[0]?.[0] as (
      prev: VirtualMetricsState
    ) => VirtualMetricsState;
    const previousState = {
      scrollTop: 0,
      viewportHeight: 420,
      columnCount: 3,
      rowHeight: 220,
    };
    expect(updater(previousState)).toEqual({
      ...previousState,
      scrollTop: 260,
      viewportHeight: 420,
    });
  });
});
