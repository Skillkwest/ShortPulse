/**
 * Unit coverage for preview-swap telemetry controller.
 * Verifies suspend/resume behavior for modal-open visual throttling.
 */
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useReferenceGridPreviewSwapTelemetryController } from "../useReferenceGridPreviewSwapTelemetryController";

type PreviewSwapMetrics = {
  swapRatePerMinute: number;
  repaintSpikeCount: number;
  lastSwapBurstCount: number;
};

const createCard = (id: string, cardPreviewUrl: string | null) => ({
  item: { id },
  cardPreviewUrl,
});

describe("useReferenceGridPreviewSwapTelemetryController", () => {
  it("pauses telemetry churn while suspended and resumes with clean baseline", () => {
    const previousVisiblePreviewUrlByIdRef = {
      current: {
        "out-1": "https://cdn.example.com/a.jpg",
      },
    };
    const previewSwapTelemetryRef = {
      current: {
        windowStartedAtMs: 1,
        totalSwapCount: 0,
        repaintSpikeCount: 0,
      },
    };
    let metrics: PreviewSwapMetrics = {
      swapRatePerMinute: 0,
      repaintSpikeCount: 0,
      lastSwapBurstCount: 0,
    };
    const setPreviewSwapMetrics = vi.fn(
      (updater: PreviewSwapMetrics | ((prev: PreviewSwapMetrics) => PreviewSwapMetrics)) => {
        metrics = typeof updater === "function" ? updater(metrics) : updater;
      }
    );

    const { rerender } = renderHook(
      ({
        suspendVisualTelemetry,
        visibleUrl,
      }: {
        suspendVisualTelemetry: boolean;
        visibleUrl: string;
      }) =>
        useReferenceGridPreviewSwapTelemetryController({
          visibleCardItems: [createCard("out-1", visibleUrl)],
          renderedItemCount: 1,
          outputsLength: 1,
          suspendVisualTelemetry,
          previousVisiblePreviewUrlByIdRef,
          previewSwapTelemetryRef,
          setPreviewSwapMetrics,
        }),
      {
        initialProps: {
          suspendVisualTelemetry: true,
          visibleUrl: "https://cdn.example.com/b.jpg",
        },
      }
    );

    expect(setPreviewSwapMetrics).not.toHaveBeenCalled();
    expect(previousVisiblePreviewUrlByIdRef.current).toEqual({
      "out-1": "https://cdn.example.com/b.jpg",
    });

    rerender({
      suspendVisualTelemetry: false,
      visibleUrl: "https://cdn.example.com/b.jpg",
    });

    expect(setPreviewSwapMetrics).not.toHaveBeenCalled();

    rerender({
      suspendVisualTelemetry: false,
      visibleUrl: "https://cdn.example.com/c.jpg",
    });

    expect(setPreviewSwapMetrics).toHaveBeenCalledTimes(1);
    expect(metrics.lastSwapBurstCount).toBe(1);
  });
});
