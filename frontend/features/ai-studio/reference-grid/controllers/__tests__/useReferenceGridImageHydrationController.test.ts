/**
 * Unit coverage for image hydration runtime controller.
 * Verifies queued decode work pauses while modal-open suspension is active.
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../../types";
import { useReferenceGridImageHydrationController } from "../useReferenceGridImageHydrationController";
import {
  logAdaptiveLocalTranscode,
  resolveAdaptivePolicyDecision,
  shouldTranscodeLocalAdaptiveImage,
  transcodeLocalImageToObjectUrl,
} from "../../../../../lib/adaptive-media";

vi.mock("../../../../../lib/adaptive-media", async () => {
  const actual = await vi.importActual<typeof import("../../../../../lib/adaptive-media")>(
    "../../../../../lib/adaptive-media"
  );
  return {
    ...actual,
    logAdaptiveLocalTranscode: vi.fn(),
    resolveAdaptivePolicyDecision: vi.fn(actual.resolveAdaptivePolicyDecision),
    shouldTranscodeLocalAdaptiveImage: vi.fn(() => false),
    transcodeLocalImageToObjectUrl: vi.fn(async () => null),
  };
});

const createOutput = (id: string): StudioOutput =>
  ({
    id,
    mode: "image",
    previewStoragePath: "https://cdn.example.com/preview.jpg",
    fullStoragePath: "https://cdn.example.com/full.jpg",
    previewUrl: null,
    resultUrls: null,
  }) as unknown as StudioOutput;

describe("useReferenceGridImageHydrationController", () => {
  const OriginalImage = window.Image;

  afterEach(() => {
    Object.defineProperty(window, "Image", {
      configurable: true,
      writable: true,
      value: OriginalImage,
    });
    vi.clearAllMocks();
  });

  it("defers queued image decode while suspended and resumes after unsuspend", async () => {
    const requestedUrls: string[] = [];
    class MockImage {
      decoding = "";
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;

      set src(value: string) {
        requestedUrls.push(value);
      }
    }

    Object.defineProperty(window, "Image", {
      configurable: true,
      writable: true,
      value: MockImage,
    });

    const output = createOutput("out-1");
    const runNonUrgentUpdate = vi.fn((updater: () => void) => updater());
    const liveWatchdogDegradeLevelRef = { current: 0 as 0 | 1 | 2 };

    const { result, rerender } = renderHook(
      ({ suspendHydrationProcessing }: { suspendHydrationProcessing: boolean }) =>
        useReferenceGridImageHydrationController({
          decodeBudgetEnabled: true,
          suspendHydrationProcessing,
          adaptivePreviewRoutingEnabled: false,
          imageDecodeBudget: 2,
          activeOutputId: null,
          validOutputIds: [output.id],
          runNonUrgentUpdate,
          liveWatchdogDegradeLevelRef,
        }),
      {
        initialProps: {
          suspendHydrationProcessing: true,
        },
      }
    );

    act(() => {
      result.current.enqueueImageHydration("out-1", "https://cdn.example.com/preview.jpg");
    });
    expect(requestedUrls).toEqual([]);

    rerender({ suspendHydrationProcessing: false });
    await waitFor(() => {
      expect(requestedUrls).toEqual(["https://cdn.example.com/preview.jpg"]);
    });
  });

  it("prunes stale queued hydration work when outputs are removed", async () => {
    const requestedUrls: string[] = [];
    class MockImage {
      decoding = "";
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;

      set src(value: string) {
        requestedUrls.push(value);
      }
    }

    Object.defineProperty(window, "Image", {
      configurable: true,
      writable: true,
      value: MockImage,
    });

    const output = createOutput("out-1");
    const runNonUrgentUpdate = vi.fn((updater: () => void) => updater());
    const liveWatchdogDegradeLevelRef = { current: 0 as 0 | 1 | 2 };

    const { result, rerender } = renderHook(
      ({ outputIds }: { outputIds: string[] }) =>
        useReferenceGridImageHydrationController({
          decodeBudgetEnabled: true,
          suspendHydrationProcessing: true,
          adaptivePreviewRoutingEnabled: false,
          imageDecodeBudget: 2,
          activeOutputId: null,
          validOutputIds: outputIds,
          runNonUrgentUpdate,
          liveWatchdogDegradeLevelRef,
        }),
      {
        initialProps: {
          outputIds: [output.id],
        },
      }
    );

    act(() => {
      result.current.enqueueImageHydration("out-1", "https://cdn.example.com/preview.jpg");
    });

    await waitFor(() => {
      expect(result.current.imageHydrationState.queueSize).toBe(1);
    });
    expect(requestedUrls).toEqual([]);

    rerender({ outputIds: [] });

    await waitFor(() => {
      expect(result.current.imageHydrationState.queueSize).toBe(0);
      expect(result.current.imageHydrationState.decodeInflight).toBe(0);
    });
    expect(requestedUrls).toEqual([]);
  });

  it("drops in-flight hydration results when the output is removed before decode completes", async () => {
    const requestedUrls: string[] = [];
    const imageInstances: MockImage[] = [];
    class MockImage {
      decoding = "";
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;

      constructor() {
        imageInstances.push(this);
      }

      set src(value: string) {
        requestedUrls.push(value);
      }
    }

    Object.defineProperty(window, "Image", {
      configurable: true,
      writable: true,
      value: MockImage,
    });

    const output = createOutput("out-1");
    const runNonUrgentUpdate = vi.fn((updater: () => void) => updater());
    const liveWatchdogDegradeLevelRef = { current: 0 as 0 | 1 | 2 };

    const { result, rerender } = renderHook(
      ({ outputIds }: { outputIds: string[] }) =>
        useReferenceGridImageHydrationController({
          decodeBudgetEnabled: true,
          suspendHydrationProcessing: false,
          adaptivePreviewRoutingEnabled: false,
          imageDecodeBudget: 1,
          activeOutputId: null,
          validOutputIds: outputIds,
          runNonUrgentUpdate,
          liveWatchdogDegradeLevelRef,
        }),
      {
        initialProps: {
          outputIds: [output.id],
        },
      }
    );

    act(() => {
      result.current.enqueueImageHydration("out-1", "https://cdn.example.com/preview.jpg");
    });

    await waitFor(() => {
      expect(requestedUrls).toEqual(["https://cdn.example.com/preview.jpg"]);
      expect(result.current.imageHydrationState.decodeInflight).toBe(1);
    });

    rerender({ outputIds: [] });

    await waitFor(() => {
      expect(result.current.imageHydrationState.decodeInflight).toBe(0);
    });

    act(() => {
      imageInstances[0]?.onload?.();
    });

    await waitFor(() => {
      expect(result.current.imageHydrationState.hydratedById).toEqual({});
      expect(result.current.imageHydrationState.decodeInflight).toBe(0);
    });
  });

  it("uses the enqueued media surface for adaptive hydration decisions", async () => {
    const requestedUrls: string[] = [];
    const imageInstances: MockImage[] = [];
    class MockImage {
      decoding = "";
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      naturalWidth = 1200;
      naturalHeight = 900;

      constructor() {
        imageInstances.push(this);
      }

      set src(value: string) {
        requestedUrls.push(value);
      }
    }

    vi.mocked(shouldTranscodeLocalAdaptiveImage).mockReturnValue(true);
    vi.mocked(transcodeLocalImageToObjectUrl).mockResolvedValue("blob:quick-slot-preview");

    Object.defineProperty(window, "Image", {
      configurable: true,
      writable: true,
      value: MockImage,
    });

    const output = createOutput("out-1");
    const runNonUrgentUpdate = vi.fn((updater: () => void) => updater());
    const liveWatchdogDegradeLevelRef = { current: 0 as 0 | 1 | 2 };

    const { result } = renderHook(() =>
      useReferenceGridImageHydrationController({
        decodeBudgetEnabled: true,
        suspendHydrationProcessing: false,
        adaptivePreviewRoutingEnabled: true,
        imageDecodeBudget: 1,
        activeOutputId: null,
        validOutputIds: [output.id],
        runNonUrgentUpdate,
        liveWatchdogDegradeLevelRef,
      })
    );

    act(() => {
      result.current.enqueueImageHydration("out-1", "https://cdn.example.com/preview.jpg", {
        mediaSurface: "quick-slot",
        targetLongEdgePx: 384,
        previewQualityBand: "balanced",
      });
    });

    await waitFor(() => {
      expect(requestedUrls).toEqual(["https://cdn.example.com/preview.jpg"]);
    });

    act(() => {
      imageInstances[0]?.onload?.();
    });

    await waitFor(() => {
      expect(resolveAdaptivePolicyDecision).toHaveBeenCalled();
      expect(logAdaptiveLocalTranscode).toHaveBeenCalledWith(
        expect.objectContaining({ surface: "quick-slot" })
      );
      expect(result.current.imageHydrationState.hydratedById["out-1"]).toEqual({
        sourceUrl: "https://cdn.example.com/preview.jpg",
        renderUrl: "blob:quick-slot-preview",
      });
    });

    expect(resolveAdaptivePolicyDecision).toHaveBeenCalledWith(
      expect.objectContaining({ surface: "quick-slot", cardLongEdgePx: 384 })
    );
  });

  it("batches queue sync work for multiple enqueues in one tick", async () => {
    const runNonUrgentUpdate = vi.fn((updater: () => void) => updater());
    const liveWatchdogDegradeLevelRef = { current: 0 as 0 | 1 | 2 };

    const { result } = renderHook(() =>
      useReferenceGridImageHydrationController({
        decodeBudgetEnabled: true,
        suspendHydrationProcessing: true,
        adaptivePreviewRoutingEnabled: false,
        imageDecodeBudget: 2,
        activeOutputId: null,
        validOutputIds: ["out-1", "out-2"],
        runNonUrgentUpdate,
        liveWatchdogDegradeLevelRef,
      })
    );

    act(() => {
      result.current.enqueueImageHydration("out-1", "https://cdn.example.com/preview-1.jpg");
      result.current.enqueueImageHydration("out-2", "https://cdn.example.com/preview-2.jpg");
    });

    expect(runNonUrgentUpdate).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(result.current.imageHydrationState.queueSize).toBe(2);
    });

    expect(runNonUrgentUpdate).toHaveBeenCalledTimes(1);
  });

  it("does not finalize the same failed image URL as hydrated", async () => {
    const requestedUrls: string[] = [];
    const imageInstances: MockImage[] = [];
    class MockImage {
      decoding = "";
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;

      constructor() {
        imageInstances.push(this);
      }

      set src(value: string) {
        requestedUrls.push(value);
      }
    }

    Object.defineProperty(window, "Image", {
      configurable: true,
      writable: true,
      value: MockImage,
    });

    const runNonUrgentUpdate = vi.fn((updater: () => void) => updater());
    const liveWatchdogDegradeLevelRef = { current: 0 as 0 | 1 | 2 };
    const { result } = renderHook(() =>
      useReferenceGridImageHydrationController({
        decodeBudgetEnabled: true,
        suspendHydrationProcessing: false,
        adaptivePreviewRoutingEnabled: false,
        imageDecodeBudget: 1,
        activeOutputId: null,
        validOutputIds: ["out-1"],
        runNonUrgentUpdate,
        liveWatchdogDegradeLevelRef,
      })
    );

    act(() => {
      result.current.enqueueImageHydration("out-1", "https://cdn.example.com/broken.jpg");
    });

    await waitFor(() => {
      expect(requestedUrls).toEqual(["https://cdn.example.com/broken.jpg"]);
    });

    act(() => {
      imageInstances[0]?.onerror?.();
    });

    await waitFor(() => {
      expect(result.current.imageHydrationState.decodeInflight).toBe(0);
      expect(result.current.imageHydrationState.hydratedById).toEqual({});
    });
  });

  it("retries a distinct fallback image URL instead of marking it hydrated before load", async () => {
    const requestedUrls: string[] = [];
    const imageInstances: MockImage[] = [];
    class MockImage {
      decoding = "";
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;

      constructor() {
        imageInstances.push(this);
      }

      set src(value: string) {
        requestedUrls.push(value);
      }
    }

    Object.defineProperty(window, "Image", {
      configurable: true,
      writable: true,
      value: MockImage,
    });

    const runNonUrgentUpdate = vi.fn((updater: () => void) => updater());
    const liveWatchdogDegradeLevelRef = { current: 0 as 0 | 1 | 2 };
    const { result } = renderHook(() =>
      useReferenceGridImageHydrationController({
        decodeBudgetEnabled: true,
        suspendHydrationProcessing: false,
        adaptivePreviewRoutingEnabled: false,
        imageDecodeBudget: 1,
        activeOutputId: null,
        validOutputIds: ["out-1"],
        runNonUrgentUpdate,
        liveWatchdogDegradeLevelRef,
      })
    );

    act(() => {
      result.current.enqueueImageHydration("out-1", "https://cdn.example.com/broken-preview.jpg", {
        fallbackUrl: "https://cdn.example.com/full-fallback.jpg",
      });
    });

    await waitFor(() => {
      expect(requestedUrls).toEqual(["https://cdn.example.com/broken-preview.jpg"]);
    });

    act(() => {
      imageInstances[0]?.onerror?.();
    });

    await waitFor(() => {
      expect(requestedUrls).toEqual([
        "https://cdn.example.com/broken-preview.jpg",
        "https://cdn.example.com/full-fallback.jpg",
      ]);
      expect(result.current.imageHydrationState.hydratedById).toEqual({});
    });

    act(() => {
      imageInstances[1]?.onload?.();
    });

    await waitFor(() => {
      expect(result.current.imageHydrationState.hydratedById["out-1"]).toEqual({
        sourceUrl: "https://cdn.example.com/full-fallback.jpg",
        renderUrl: "https://cdn.example.com/full-fallback.jpg",
      });
    });
  });
});
