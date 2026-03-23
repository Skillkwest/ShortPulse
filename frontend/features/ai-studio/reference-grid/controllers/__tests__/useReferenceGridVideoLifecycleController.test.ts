import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../../types";
import { useReferenceGridVideoLifecycleController } from "../useReferenceGridVideoLifecycleController";

class MockIntersectionObserver {
  observe() {
    return undefined;
  }

  unobserve() {
    return undefined;
  }

  disconnect() {
    return undefined;
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

describe("useReferenceGridVideoLifecycleController", () => {
  it("detaches stale video nodes when their outputs disappear", async () => {
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

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

    expect(recomputeAutoplayBudget).toHaveBeenCalled();
  });
});
