/**
 * Unit coverage for image hydration runtime controller.
 * Verifies queued decode work pauses while modal-open suspension is active.
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../../types";
import {
  REFERENCE_GRID_HYDRATED_IMAGE_ENTRY_LIMIT,
  useReferenceGridImageHydrationController,
} from "../useReferenceGridImageHydrationController";
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
  const originalRevokeObjectURL = URL.revokeObjectURL;

  afterEach(() => {
    Object.defineProperty(window, "Image", {
      configurable: true,
      writable: true,
      value: OriginalImage,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: originalRevokeObjectURL,
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

  it("does not hydrate stale in-flight image URLs after a card URL changes", async () => {
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

    const { result } = renderHook(() =>
      useReferenceGridImageHydrationController({
        decodeBudgetEnabled: true,
        suspendHydrationProcessing: false,
        adaptivePreviewRoutingEnabled: false,
        imageDecodeBudget: 1,
        activeOutputId: null,
        validOutputIds: [output.id],
        runNonUrgentUpdate,
        liveWatchdogDegradeLevelRef,
      })
    );

    act(() => {
      result.current.enqueueImageHydration("out-1", "https://cdn.example.com/old-preview.jpg");
    });

    await waitFor(() => {
      expect(requestedUrls).toEqual(["https://cdn.example.com/old-preview.jpg"]);
      expect(result.current.imageHydrationState.decodeInflight).toBe(1);
    });

    act(() => {
      result.current.enqueueImageHydration("out-1", "https://cdn.example.com/new-preview.jpg");
      imageInstances[0]?.onload?.();
    });

    await waitFor(() => {
      expect(requestedUrls).toEqual([
        "https://cdn.example.com/old-preview.jpg",
        "https://cdn.example.com/new-preview.jpg",
      ]);
    });
    expect(result.current.imageHydrationState.hydratedById).toEqual({});

    act(() => {
      imageInstances[1]?.onload?.();
    });

    await waitFor(() => {
      expect(result.current.imageHydrationState.hydratedById["out-1"]).toEqual({
        sourceUrl: "https://cdn.example.com/new-preview.jpg",
        renderUrl: "https://cdn.example.com/new-preview.jpg",
      });
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

  it("bounds offscreen hydrated entries while preserving candidates and revoking generated object URLs", async () => {
    const requestedUrls: string[] = [];
    const imageInstances: MockImage[] = [];
    class MockImage {
      decoding = "";
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      naturalWidth = 1400;
      naturalHeight = 900;

      constructor() {
        imageInstances.push(this);
      }

      set src(value: string) {
        requestedUrls.push(value);
      }
    }

    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: revokeObjectURL,
    });
    Object.defineProperty(window, "Image", {
      configurable: true,
      writable: true,
      value: MockImage,
    });
    vi.mocked(shouldTranscodeLocalAdaptiveImage).mockReturnValue(true);
    let transcodeIndex = 0;
    vi.mocked(transcodeLocalImageToObjectUrl).mockImplementation(async () => {
      const objectUrl = `blob:hydrated-preview-${transcodeIndex}`;
      transcodeIndex += 1;
      return objectUrl;
    });

    const validOutputIds = Array.from(
      { length: REFERENCE_GRID_HYDRATED_IMAGE_ENTRY_LIMIT + 2 },
      (_, index) => `out-${index}`
    );
    const runNonUrgentUpdate = vi.fn((updater: () => void) => updater());
    const liveWatchdogDegradeLevelRef = { current: 0 as 0 | 1 | 2 };

    const { result } = renderHook(() =>
      useReferenceGridImageHydrationController({
        decodeBudgetEnabled: true,
        suspendHydrationProcessing: false,
        adaptivePreviewRoutingEnabled: true,
        imageDecodeBudget: REFERENCE_GRID_HYDRATED_IMAGE_ENTRY_LIMIT + 2,
        activeOutputId: "out-0",
        validOutputIds,
        runNonUrgentUpdate,
        liveWatchdogDegradeLevelRef,
      })
    );

    act(() => {
      result.current.pruneHydrationQueueToCandidateIds(new Set(validOutputIds));
      validOutputIds.forEach((id, index) => {
        result.current.enqueueImageHydration(id, `blob:source-${index}`, {
          mediaSurface: "reference-grid",
          targetLongEdgePx: 384,
          previewQualityBand: "balanced",
        });
      });
    });

    await waitFor(() => {
      expect(requestedUrls).toHaveLength(REFERENCE_GRID_HYDRATED_IMAGE_ENTRY_LIMIT + 2);
    });

    act(() => {
      imageInstances.forEach((image) => image.onload?.());
    });

    await waitFor(() => {
      const hydratedEntries = result.current.imageHydrationState.hydratedById;
      expect(Object.keys(hydratedEntries)).toHaveLength(
        REFERENCE_GRID_HYDRATED_IMAGE_ENTRY_LIMIT + 2
      );
      expect(hydratedEntries["out-0"]).toEqual({
        sourceUrl: "blob:source-0",
        renderUrl: "blob:hydrated-preview-0",
      });
    });

    act(() => {
      result.current.pruneHydrationQueueToCandidateIds(new Set(["out-0"]));
    });

    await waitFor(() => {
      const hydratedEntries = result.current.imageHydrationState.hydratedById;
      expect(Object.keys(hydratedEntries)).toHaveLength(REFERENCE_GRID_HYDRATED_IMAGE_ENTRY_LIMIT);
      expect(hydratedEntries["out-0"]).toEqual({
        sourceUrl: "blob:source-0",
        renderUrl: "blob:hydrated-preview-0",
      });
      expect(hydratedEntries["out-1"]).toBeUndefined();
      expect(hydratedEntries["out-2"]).toBeUndefined();
    });
    await waitFor(() => {
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:hydrated-preview-1");
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:hydrated-preview-2");
    });
  });

  it("suppresses repeated hydration attempts for the same failed image URL", async () => {
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

    act(() => {
      result.current.enqueueImageHydration("out-1", "https://cdn.example.com/broken.jpg");
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(requestedUrls).toEqual(["https://cdn.example.com/broken.jpg"]);

    act(() => {
      result.current.enqueueImageHydration("out-1", "https://cdn.example.com/repaired.jpg");
    });

    await waitFor(() => {
      expect(requestedUrls).toEqual([
        "https://cdn.example.com/broken.jpg",
        "https://cdn.example.com/repaired.jpg",
      ]);
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

    act(() => {
      result.current.enqueueImageHydration("out-1", "https://cdn.example.com/broken-preview.jpg", {
        fallbackUrl: "https://cdn.example.com/full-fallback.jpg",
      });
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(requestedUrls).toEqual([
      "https://cdn.example.com/broken-preview.jpg",
      "https://cdn.example.com/full-fallback.jpg",
    ]);
  });
});
