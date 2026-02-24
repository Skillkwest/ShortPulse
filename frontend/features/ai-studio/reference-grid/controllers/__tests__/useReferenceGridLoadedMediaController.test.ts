/**
 * Unit coverage for loaded-media controller timing behavior.
 * Verifies immediate autosave notification, optional two-frame visual stabilization, and dedupe semantics.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useReferenceGridLoadedMediaController } from "../useReferenceGridLoadedMediaController";

type LoadedMap = Record<string, boolean>;

type HarnessOptions = {
  stabilizeLoadingVisual?: boolean;
  onOutputMediaLoaded?: (id: string) => void;
};

const createHarness = (options: HarnessOptions = {}) => {
  const loadedIdsRef = { current: new Set<string>() };
  let loadedMap: LoadedMap = {};
  const setLoadedMap = (updater: LoadedMap | ((prev: LoadedMap) => LoadedMap)) => {
    loadedMap = typeof updater === "function" ? updater(loadedMap) : updater;
  };
  const runNonUrgentUpdate = vi.fn((updater: () => void) => updater());
  const onOutputMediaLoaded = options.onOutputMediaLoaded ?? vi.fn();
  const { result, unmount } = renderHook(() =>
    useReferenceGridLoadedMediaController({
      loadedIdsRef,
      setLoadedMap,
      runNonUrgentUpdate,
      onOutputMediaLoaded,
      stabilizeLoadingVisual: options.stabilizeLoadingVisual ?? false,
    })
  );

  return {
    result,
    unmount,
    getLoadedMap: () => loadedMap,
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

describe("useReferenceGridLoadedMediaController", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("commits loaded-map immediately when stabilization is disabled", () => {
    const onOutputMediaLoaded = vi.fn();
    const harness = createHarness({
      stabilizeLoadingVisual: false,
      onOutputMediaLoaded,
    });

    act(() => {
      harness.result.current.markLoaded("out-1");
    });

    expect(harness.getLoadedMap()).toEqual({ "out-1": true });
    expect(onOutputMediaLoaded).toHaveBeenCalledWith("out-1");
    expect(harness.runNonUrgentUpdate).toHaveBeenCalledTimes(1);
  });

  it("defers loaded-map commit by two animation frames when stabilization is enabled", () => {
    const { flushNextFrame } = installRafQueue();
    const onOutputMediaLoaded = vi.fn();
    const harness = createHarness({
      stabilizeLoadingVisual: true,
      onOutputMediaLoaded,
    });

    act(() => {
      harness.result.current.markLoaded("out-1");
    });

    expect(onOutputMediaLoaded).toHaveBeenCalledWith("out-1");
    expect(harness.getLoadedMap()).toEqual({});

    act(() => {
      flushNextFrame();
    });

    expect(harness.getLoadedMap()).toEqual({});

    act(() => {
      flushNextFrame();
    });

    expect(harness.getLoadedMap()).toEqual({ "out-1": true });
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

    expect(harness.getLoadedMap()).toEqual({ "out-1": true });
    expect(harness.runNonUrgentUpdate).toHaveBeenCalledTimes(1);
  });
});
