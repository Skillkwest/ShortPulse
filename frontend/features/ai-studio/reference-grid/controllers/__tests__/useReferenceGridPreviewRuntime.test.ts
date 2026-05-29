import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useReferenceGridPreviewRuntime } from "../useReferenceGridPreviewRuntime";

vi.mock("../useReferenceGridImageHydrationController", () => ({
  useReferenceGridImageHydrationController: () => ({
    imageHydrationState: {
      hydratedById: {},
      queueSize: 0,
      decodeInflight: 0,
      optimizerFailoverBypassCount: 0,
      optimizerFailoverErrorCount: 0,
    },
    enqueueImageHydration: vi.fn(),
    pruneHydrationQueueToCandidateIds: vi.fn(),
  }),
}));

type HarnessOptions = {
  stabilizeLoadingVisual?: boolean;
  onOutputMediaLoaded?: (id: string) => void;
};

const createHarness = (options: HarnessOptions = {}) => {
  const runNonUrgentUpdate = vi.fn((updater: () => void) => updater());
  const onOutputMediaLoaded = options.onOutputMediaLoaded ?? vi.fn();
  const { result, unmount } = renderHook(() =>
    useReferenceGridPreviewRuntime({
      decodeBudgetEnabled: true,
      suspendPreviewRuntime: false,
      adaptivePreviewRoutingEnabled: true,
      imageDecodeBudget: 2,
      activeOutputId: null,
      validOutputIds: [],
      runNonUrgentUpdate,
      liveWatchdogDegradeLevelRef: { current: 0 },
      onOutputMediaLoaded,
      stabilizeLoadingVisual: options.stabilizeLoadingVisual ?? false,
    })
  );

  return {
    result,
    unmount,
    runNonUrgentUpdate,
    onOutputMediaLoaded,
  };
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

describe("useReferenceGridPreviewRuntime", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("batches loaded-map commits when stabilization is disabled", () => {
    const { requestAnimationFrameMock, flushNextFrame } = installRafQueue();
    const onOutputMediaLoaded = vi.fn();
    const harness = createHarness({
      stabilizeLoadingVisual: false,
      onOutputMediaLoaded,
    });

    act(() => {
      harness.result.current.markLoaded("out-1");
      harness.result.current.markLoaded("out-2");
    });

    expect(harness.result.current.loadedMap).toEqual({});
    expect(onOutputMediaLoaded).toHaveBeenCalledWith("out-1");
    expect(onOutputMediaLoaded).toHaveBeenCalledWith("out-2");
    expect(requestAnimationFrameMock).toHaveBeenCalledTimes(1);
    expect(harness.runNonUrgentUpdate).not.toHaveBeenCalled();

    act(() => {
      flushNextFrame();
    });

    expect(harness.result.current.loadedMap).toEqual({ "out-1": true, "out-2": true });
    expect(harness.runNonUrgentUpdate).toHaveBeenCalledTimes(1);
  });

  it("defers and batches loaded-map commits by two animation frames when stabilization is enabled", () => {
    const { flushNextFrame } = installRafQueue();
    const onOutputMediaLoaded = vi.fn();
    const harness = createHarness({
      stabilizeLoadingVisual: true,
      onOutputMediaLoaded,
    });

    act(() => {
      harness.result.current.markLoaded("out-1");
      harness.result.current.markLoaded("out-2");
    });

    expect(onOutputMediaLoaded).toHaveBeenCalledWith("out-1");
    expect(onOutputMediaLoaded).toHaveBeenCalledWith("out-2");
    expect(harness.result.current.loadedMap).toEqual({});

    act(() => {
      flushNextFrame();
    });

    expect(harness.result.current.loadedMap).toEqual({});

    act(() => {
      flushNextFrame();
    });

    expect(harness.result.current.loadedMap).toEqual({ "out-1": true, "out-2": true });
    expect(harness.runNonUrgentUpdate).toHaveBeenCalledTimes(1);
  });

  it("keeps dedupe behavior stable while stabilization mode is enabled", () => {
    const { requestAnimationFrameMock, flushNextFrame } = installRafQueue();
    const onOutputMediaLoaded = vi.fn();
    const harness = createHarness({
      stabilizeLoadingVisual: true,
      onOutputMediaLoaded,
    });

    act(() => {
      harness.result.current.markLoaded("out-1");
      harness.result.current.markLoaded("out-1");
    });

    expect(onOutputMediaLoaded).toHaveBeenCalledTimes(1);
    expect(requestAnimationFrameMock).toHaveBeenCalledTimes(1);

    act(() => {
      flushNextFrame();
    });

    expect(requestAnimationFrameMock).toHaveBeenCalledTimes(2);

    act(() => {
      flushNextFrame();
    });

    expect(harness.result.current.loadedMap).toEqual({ "out-1": true });
    expect(harness.runNonUrgentUpdate).toHaveBeenCalledTimes(1);
  });
});
