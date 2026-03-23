import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../../types";
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

const createVideoOutput = (id: string): StudioOutput =>
  ({
    id,
    mode: "video",
    previewStoragePath: "https://cdn.example.com/video.mp4",
    fullStoragePath: "https://cdn.example.com/video.mp4",
    previewUrl: "https://cdn.example.com/video.mp4",
    resultUrls: ["https://cdn.example.com/video.mp4"],
  }) as unknown as StudioOutput;

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
      ({ outputs }: { outputs: StudioOutput[] }) =>
        useReferenceGridVideoLifecycleController({
          activeOutputId: null,
          outputs,
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
          outputs: [createVideoOutput("video-1")],
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

    rerender({ outputs: [] });

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
      const callback = rafCallbacks.values().next().value;
      if (callback) callback(16);
    });

    expect(recomputeAutoplayBudget).toHaveBeenCalledTimes(1);
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
        outputs: [createVideoOutput("video-1"), createVideoOutput("video-2")],
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
    expect(rafCallbacks.size).toBe(1);

    act(() => {
      const callback = rafCallbacks.values().next().value;
      if (callback) callback(16);
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
        outputs: [createVideoOutput("video-1")],
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

    unmount();

    expect(pauseSpy).toHaveBeenCalled();
    expect(removeAttributeSpy).toHaveBeenCalledWith("src");
    expect(loadSpy).toHaveBeenCalled();
    expect(videoNodeByKeyRef.current.size).toBe(0);
  });
});
