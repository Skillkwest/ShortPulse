/**
 * Unit coverage for image hydration runtime controller.
 * Verifies queued decode work pauses while modal-open suspension is active.
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../../types";
import { useReferenceGridImageHydrationController } from "../useReferenceGridImageHydrationController";

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
          outputs: [output],
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
      ({ outputs }: { outputs: StudioOutput[] }) =>
        useReferenceGridImageHydrationController({
          decodeBudgetEnabled: true,
          suspendHydrationProcessing: true,
          adaptivePreviewRoutingEnabled: false,
          imageDecodeBudget: 2,
          activeOutputId: null,
          outputs,
          runNonUrgentUpdate,
          liveWatchdogDegradeLevelRef,
        }),
      {
        initialProps: {
          outputs: [output],
        },
      }
    );

    act(() => {
      result.current.enqueueImageHydration("out-1", "https://cdn.example.com/preview.jpg");
    });

    expect(result.current.imageHydrationState.queueSize).toBe(1);
    expect(requestedUrls).toEqual([]);

    rerender({ outputs: [] });

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
      ({ outputs }: { outputs: StudioOutput[] }) =>
        useReferenceGridImageHydrationController({
          decodeBudgetEnabled: true,
          suspendHydrationProcessing: false,
          adaptivePreviewRoutingEnabled: false,
          imageDecodeBudget: 1,
          activeOutputId: null,
          outputs,
          runNonUrgentUpdate,
          liveWatchdogDegradeLevelRef,
        }),
      {
        initialProps: {
          outputs: [output],
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

    rerender({ outputs: [] });

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
});
