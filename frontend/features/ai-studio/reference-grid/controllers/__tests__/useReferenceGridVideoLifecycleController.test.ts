import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearMediaPerfEvents,
  logMediaPerf,
  readMediaPerfCrashEvidence,
} from "../../../../../lib/mediaPerfTelemetry";
import { useReferenceGridVideoLifecycleController } from "../useReferenceGridVideoLifecycleController";

class MockIntersectionObserver {
  private callback: IntersectionObserverCallback;

  static callbacks = new Set<IntersectionObserverCallback>();

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    MockIntersectionObserver.callbacks.add(callback);
  }

  observe() {
    return undefined;
  }

  unobserve() {
    return undefined;
  }

  disconnect() {
    MockIntersectionObserver.callbacks.delete(this.callback);
    return undefined;
  }

  static trigger(entries: IntersectionObserverEntry[]) {
    for (const callback of MockIntersectionObserver.callbacks) {
      callback(entries, {} as IntersectionObserver);
    }
  }

  static reset() {
    MockIntersectionObserver.callbacks.clear();
  }
}

const createIntersectionEntry = ({
  target,
  isIntersecting,
  intersectionRatio,
}: {
  target: Element;
  isIntersecting: boolean;
  intersectionRatio: number;
}): IntersectionObserverEntry =>
  ({
    target,
    isIntersecting,
    intersectionRatio,
  }) as unknown as IntersectionObserverEntry;

describe("useReferenceGridVideoLifecycleController", () => {
  afterEach(() => {
    clearMediaPerfEvents();
    vi.unstubAllGlobals();
    MockIntersectionObserver.reset();
  });

  it("detaches stale video nodes when their outputs disappear", async () => {
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    let nextRafId = 0;
    const rafCallbacks = new Map<number, FrameRequestCallback>();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      nextRafId += 1;
      rafCallbacks.set(nextRafId, callback);
      return nextRafId;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => {
      rafCallbacks.delete(id);
    });

    const autoplayingIdsRef = { current: new Set<string>() };
    const videoVisibleKeySetRef = { current: new Set<string>(["video-key"]) };
    const videoOutputIdByKeyRef = { current: new Map<string, string>() };
    const videoNodeByKeyRef = { current: new Map<string, HTMLVideoElement>() };
    const videoDetachTimeoutByKeyRef = { current: new Map<string, number>() };
    const videoIntersectionObserverBySurfaceRef = {
      current: new Map<"all-refs" | "curated", IntersectionObserver>(),
    };
    const recomputeAutoplayBudget = vi.fn();
    const scrollContainerRef = {
      current: document.createElement("div"),
    } as React.MutableRefObject<HTMLDivElement | null>;
    const curatedScrollContainerRef = {
      current: null,
    } as React.MutableRefObject<HTMLDivElement | null>;

    const { result, rerender } = renderHook(
      ({ outputIds }: { outputIds: string[] }) =>
        useReferenceGridVideoLifecycleController({
          activeOutputId: null,
          validOutputIds: outputIds,
          shouldVirtualize: false,
          renderedOutputIdSet: new Set(),
          autoplayEnabledIds: [],
          autoplayEnabledIdSet: new Set(),
          isCuratedSplitEnabled: false,
          scrollContainerRef,
          curatedScrollContainerRef,
          autoplayingIdsRef,
          videoVisibleKeySetRef,
          videoOutputIdByKeyRef,
          videoNodeByKeyRef,
          videoDetachTimeoutByKeyRef,
          videoIntersectionObserverBySurfaceRef,
          autoplayDetachDelayMs: 100,
          autoplayVisibilityThreshold: 0.6,
          recomputeAutoplayBudget,
        }),
      {
        initialProps: {
          outputIds: ["video-1"],
        },
      }
    );

    const node = document.createElement("video");
    const pauseSpy = vi.spyOn(node, "pause").mockImplementation(() => undefined);
    const loadSpy = vi.spyOn(node, "load").mockImplementation(() => undefined);
    const removeAttributeSpy = vi.spyOn(node, "removeAttribute");
    node.setAttribute("src", "https://cdn.example.com/video.mp4");

    act(() => {
      result.current.registerVideoNode("video-key", "video-1", node);
      videoDetachTimeoutByKeyRef.current.set(
        "video-key",
        window.setTimeout(() => {}, 10)
      );
    });

    rerender({ outputIds: [] });

    await waitFor(() => {
      expect(pauseSpy).toHaveBeenCalled();
      expect(removeAttributeSpy).toHaveBeenCalledWith("src");
      expect(loadSpy).toHaveBeenCalled();
      expect(videoNodeByKeyRef.current.has("video-key")).toBe(false);
      expect(videoOutputIdByKeyRef.current.has("video-key")).toBe(false);
      expect(videoDetachTimeoutByKeyRef.current.has("video-key")).toBe(false);
      expect(videoVisibleKeySetRef.current.has("video-key")).toBe(false);
    });

    act(() => {
      Array.from(rafCallbacks.values()).forEach((callback) => callback(16));
    });

    expect(recomputeAutoplayBudget).toHaveBeenCalledTimes(1);
  });

  it("detaches and clears a remembered node when its callback ref receives null", () => {
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    const rafCallbacks = new Map<number, FrameRequestCallback>();
    let nextRafId = 0;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      nextRafId += 1;
      rafCallbacks.set(nextRafId, callback);
      return nextRafId;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => {
      rafCallbacks.delete(id);
    });
    const videoNodeByKeyRef = { current: new Map<string, HTMLVideoElement>() };
    const videoOutputIdByKeyRef = { current: new Map<string, string>() };
    const videoVisibleKeySetRef = { current: new Set<string>(["all-refs:video-1"]) };
    const videoDetachTimeoutByKeyRef = { current: new Map<string, number>() };
    const { result, unmount } = renderHook(() =>
      useReferenceGridVideoLifecycleController({
        activeOutputId: null,
        validOutputIds: ["video-1"],
        shouldVirtualize: true,
        renderedOutputIdSet: new Set(["video-1"]),
        autoplayEnabledIds: [],
        autoplayEnabledIdSet: new Set(),
        isCuratedSplitEnabled: false,
        scrollContainerRef: { current: document.createElement("div") },
        curatedScrollContainerRef: { current: null },
        autoplayingIdsRef: { current: new Set() },
        videoVisibleKeySetRef,
        videoOutputIdByKeyRef,
        videoNodeByKeyRef,
        videoDetachTimeoutByKeyRef,
        videoIntersectionObserverBySurfaceRef: { current: new Map() },
        autoplayDetachDelayMs: 100,
        autoplayVisibilityThreshold: 0.6,
        recomputeAutoplayBudget: vi.fn(),
      })
    );
    const node = document.createElement("video");
    const pauseSpy = vi.spyOn(node, "pause").mockImplementation(() => undefined);
    const loadSpy = vi.spyOn(node, "load").mockImplementation(() => undefined);
    node.src = "https://cdn.example.com/video-1.mp4";

    act(() => {
      result.current.registerVideoNode("all-refs:video-1", "video-1", node);
      result.current.registerVideoNode("all-refs:video-1", "video-1", null);
    });

    expect(pauseSpy).toHaveBeenCalledTimes(1);
    expect(loadSpy).toHaveBeenCalledTimes(1);
    expect(node.getAttribute("src")).toBeNull();
    expect(videoNodeByKeyRef.current.size).toBe(0);
    expect(videoOutputIdByKeyRef.current.size).toBe(0);
    expect(videoVisibleKeySetRef.current.size).toBe(0);
    expect(videoDetachTimeoutByKeyRef.current.size).toBe(0);
    unmount();
    expect(rafCallbacks.size).toBe(0);
  });

  it("detaches the old physical node before replacing the same surface key", () => {
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn(() => 1)
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const videoNodeByKeyRef = { current: new Map<string, HTMLVideoElement>() };
    const videoOutputIdByKeyRef = { current: new Map<string, string>() };
    const videoVisibleKeySetRef = { current: new Set<string>() };
    const recomputeAutoplayBudget = vi.fn();
    const { result } = renderHook(() =>
      useReferenceGridVideoLifecycleController({
        activeOutputId: null,
        validOutputIds: ["video-1"],
        shouldVirtualize: false,
        renderedOutputIdSet: new Set(),
        autoplayEnabledIds: [],
        autoplayEnabledIdSet: new Set(),
        isCuratedSplitEnabled: false,
        scrollContainerRef: { current: document.createElement("div") },
        curatedScrollContainerRef: { current: null },
        autoplayingIdsRef: { current: new Set() },
        videoVisibleKeySetRef,
        videoOutputIdByKeyRef,
        videoNodeByKeyRef,
        videoDetachTimeoutByKeyRef: { current: new Map() },
        videoIntersectionObserverBySurfaceRef: { current: new Map() },
        autoplayDetachDelayMs: 100,
        autoplayVisibilityThreshold: 0.6,
        recomputeAutoplayBudget,
      })
    );
    const oldNode = document.createElement("video");
    const newNode = document.createElement("video");
    const oldPauseSpy = vi.spyOn(oldNode, "pause").mockImplementation(() => undefined);
    const oldLoadSpy = vi.spyOn(oldNode, "load").mockImplementation(() => undefined);
    const newPauseSpy = vi.spyOn(newNode, "pause").mockImplementation(() => undefined);
    vi.spyOn(newNode, "load").mockImplementation(() => undefined);
    oldNode.src = "https://cdn.example.com/old.mp4";
    newNode.src = "https://cdn.example.com/new.mp4";

    act(() => {
      result.current.registerVideoNode("all-refs:video-1", "video-1", oldNode);
      result.current.registerVideoNode("all-refs:video-1", "video-1", newNode);
    });

    expect(oldPauseSpy).toHaveBeenCalledTimes(1);
    expect(oldLoadSpy).toHaveBeenCalledTimes(1);
    expect(oldNode.getAttribute("src")).toBeNull();
    expect(newPauseSpy).not.toHaveBeenCalled();
    expect(videoNodeByKeyRef.current.get("all-refs:video-1")).toBe(newNode);
    expect(videoOutputIdByKeyRef.current.get("all-refs:video-1")).toBe("video-1");

    act(() => {
      MockIntersectionObserver.trigger([
        createIntersectionEntry({
          target: oldNode,
          isIntersecting: true,
          intersectionRatio: 1,
        }),
      ]);
    });

    expect(videoVisibleKeySetRef.current.has("all-refs:video-1")).toBe(false);
    expect(recomputeAutoplayBudget).not.toHaveBeenCalled();
  });

  it("coalesces autoplay budget recomputes to once per frame during visibility churn", () => {
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    let nextRafId = 0;
    const rafCallbacks = new Map<number, FrameRequestCallback>();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      nextRafId += 1;
      rafCallbacks.set(nextRafId, callback);
      return nextRafId;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => {
      rafCallbacks.delete(id);
    });

    const autoplayingIdsRef = { current: new Set<string>() };
    const videoVisibleKeySetRef = { current: new Set<string>() };
    const videoOutputIdByKeyRef = {
      current: new Map<string, string>([
        ["video-key-1", "video-1"],
        ["video-key-2", "video-2"],
      ]),
    };
    const videoNodeByKeyRef = { current: new Map<string, HTMLVideoElement>() };
    const videoDetachTimeoutByKeyRef = { current: new Map<string, number>() };
    const videoIntersectionObserverBySurfaceRef = {
      current: new Map<"all-refs" | "curated", IntersectionObserver>(),
    };
    const recomputeAutoplayBudget = vi.fn();
    const scrollContainerRef = {
      current: document.createElement("div"),
    } as React.MutableRefObject<HTMLDivElement | null>;
    const curatedScrollContainerRef = {
      current: null,
    } as React.MutableRefObject<HTMLDivElement | null>;

    renderHook(() =>
      useReferenceGridVideoLifecycleController({
        activeOutputId: null,
        validOutputIds: ["video-1", "video-2"],
        shouldVirtualize: false,
        renderedOutputIdSet: new Set(),
        autoplayEnabledIds: [],
        autoplayEnabledIdSet: new Set(),
        isCuratedSplitEnabled: false,
        scrollContainerRef,
        curatedScrollContainerRef,
        autoplayingIdsRef,
        videoVisibleKeySetRef,
        videoOutputIdByKeyRef,
        videoNodeByKeyRef,
        videoDetachTimeoutByKeyRef,
        videoIntersectionObserverBySurfaceRef,
        autoplayDetachDelayMs: 100,
        autoplayVisibilityThreshold: 0.6,
        recomputeAutoplayBudget,
      })
    );

    const firstNode = document.createElement("video");
    firstNode.dataset.outputKey = "video-key-1";
    const secondNode = document.createElement("video");
    secondNode.dataset.outputKey = "video-key-2";
    videoNodeByKeyRef.current.set("video-key-1", firstNode);
    videoNodeByKeyRef.current.set("video-key-2", secondNode);

    act(() => {
      MockIntersectionObserver.trigger([
        createIntersectionEntry({
          target: firstNode,
          isIntersecting: true,
          intersectionRatio: 1,
        }),
        createIntersectionEntry({
          target: secondNode,
          isIntersecting: true,
          intersectionRatio: 1,
        }),
      ]);
      MockIntersectionObserver.trigger([
        createIntersectionEntry({
          target: firstNode,
          isIntersecting: false,
          intersectionRatio: 0,
        }),
      ]);
    });

    expect(recomputeAutoplayBudget).not.toHaveBeenCalled();
    expect(rafCallbacks.size).toBe(2);

    act(() => {
      Array.from(rafCallbacks.values()).forEach((callback) => callback(16));
    });

    expect(recomputeAutoplayBudget).toHaveBeenCalledTimes(1);
  });

  it("detaches tracked video nodes on hook cleanup", () => {
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

    const autoplayingIdsRef = { current: new Set<string>() };
    const videoVisibleKeySetRef = { current: new Set<string>() };
    const videoOutputIdByKeyRef = { current: new Map<string, string>() };
    const videoNodeByKeyRef = { current: new Map<string, HTMLVideoElement>() };
    const videoDetachTimeoutByKeyRef = { current: new Map<string, number>() };
    const videoIntersectionObserverBySurfaceRef = {
      current: new Map<"all-refs" | "curated", IntersectionObserver>(),
    };
    const scrollContainerRef = {
      current: document.createElement("div"),
    } as React.MutableRefObject<HTMLDivElement | null>;
    const curatedScrollContainerRef = {
      current: null,
    } as React.MutableRefObject<HTMLDivElement | null>;

    const { result, unmount } = renderHook(() =>
      useReferenceGridVideoLifecycleController({
        activeOutputId: null,
        validOutputIds: ["video-1"],
        shouldVirtualize: false,
        renderedOutputIdSet: new Set(),
        autoplayEnabledIds: [],
        autoplayEnabledIdSet: new Set(),
        isCuratedSplitEnabled: false,
        scrollContainerRef,
        curatedScrollContainerRef,
        autoplayingIdsRef,
        videoVisibleKeySetRef,
        videoOutputIdByKeyRef,
        videoNodeByKeyRef,
        videoDetachTimeoutByKeyRef,
        videoIntersectionObserverBySurfaceRef,
        autoplayDetachDelayMs: 100,
        autoplayVisibilityThreshold: 0.6,
        recomputeAutoplayBudget: vi.fn(),
      })
    );

    const node = document.createElement("video");
    const pauseSpy = vi.spyOn(node, "pause").mockImplementation(() => undefined);
    const loadSpy = vi.spyOn(node, "load").mockImplementation(() => undefined);
    const removeAttributeSpy = vi.spyOn(node, "removeAttribute");
    node.setAttribute("src", "https://cdn.example.com/video.mp4");

    act(() => {
      result.current.registerVideoNode("video-key", "video-1", node);
    });
    logMediaPerf("media.grid.memory.sample", {
      surface: "reference-grid",
      tracked_video_node_count: 1,
      attached_video_source_count: 1,
      visible_video_key_count: 1,
      autoplay_enabled_output_count: 1,
      duplicate_video_output_count: 1,
    });

    unmount();

    expect(pauseSpy).toHaveBeenCalled();
    expect(removeAttributeSpy).toHaveBeenCalledWith("src");
    expect(loadSpy).toHaveBeenCalled();
    expect(videoNodeByKeyRef.current.size).toBe(0);
    expect(readMediaPerfCrashEvidence()).toMatchObject({
      media_grid_tracked_video_node_count: 0,
      media_grid_attached_video_source_count: 0,
      media_grid_visible_video_key_count: 0,
      media_grid_autoplay_enabled_output_count: 0,
      media_grid_duplicate_video_output_count: 0,
    });
  });
});
