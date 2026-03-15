/**
 * Preview-swap telemetry controller for Reference Grid.
 * Encapsulates URL swap-rate tracking and reset logic away from ReferenceGrid composition.
 */
import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";

type PreviewSwapCard = {
  item: { id: string };
  cardPreviewUrl: string | null;
};

type PreviewSwapMetrics = {
  swapRatePerMinute: number;
  repaintSpikeCount: number;
  lastSwapBurstCount: number;
};

type UseReferenceGridPreviewSwapTelemetryControllerArgs = {
  visibleCardItems: PreviewSwapCard[];
  renderedItemCount: number;
  outputsLength: number;
  suspendVisualTelemetry?: boolean;
  previousVisiblePreviewUrlByIdRef: MutableRefObject<Record<string, string | null>>;
  previewSwapTelemetryRef: MutableRefObject<{
    windowStartedAtMs: number;
    totalSwapCount: number;
    repaintSpikeCount: number;
  }>;
  setPreviewSwapMetrics: Dispatch<SetStateAction<PreviewSwapMetrics>>;
};

/**
 * Tracks visible-preview URL swaps and updates aggregate swap/repaint metrics.
 */
export const useReferenceGridPreviewSwapTelemetryController = ({
  visibleCardItems,
  renderedItemCount,
  outputsLength,
  suspendVisualTelemetry = false,
  previousVisiblePreviewUrlByIdRef,
  previewSwapTelemetryRef,
  setPreviewSwapMetrics,
}: UseReferenceGridPreviewSwapTelemetryControllerArgs): void => {
  useEffect(() => {
    if (typeof performance === "undefined") return;
    const nextVisibleUrlById: Record<string, string | null> = {};
    visibleCardItems.forEach((card) => {
      nextVisibleUrlById[card.item.id] = card.cardPreviewUrl ?? null;
    });
    if (suspendVisualTelemetry) {
      previousVisiblePreviewUrlByIdRef.current = nextVisibleUrlById;
      return;
    }
    const previousVisibleUrlById = previousVisiblePreviewUrlByIdRef.current;
    let swappedCount = 0;
    visibleCardItems.forEach((card) => {
      const nextUrl = nextVisibleUrlById[card.item.id] ?? null;
      const previousUrl = previousVisibleUrlById[card.item.id];
      if (typeof previousUrl !== "string") return;
      if (previousUrl === nextUrl) return;
      swappedCount += 1;
    });
    previousVisiblePreviewUrlByIdRef.current = nextVisibleUrlById;
    if (swappedCount === 0) return;

    const nowMs = performance.now();
    if (previewSwapTelemetryRef.current.windowStartedAtMs <= 0) {
      previewSwapTelemetryRef.current.windowStartedAtMs = nowMs;
    }
    previewSwapTelemetryRef.current.totalSwapCount += swappedCount;
    const repaintSpikeThreshold = Math.max(6, Math.floor(renderedItemCount * 0.75));
    if (swappedCount >= repaintSpikeThreshold) {
      previewSwapTelemetryRef.current.repaintSpikeCount += 1;
    }

    const elapsedMs = Math.max(1, nowMs - previewSwapTelemetryRef.current.windowStartedAtMs);
    const swapRatePerMinute = Math.round(
      (previewSwapTelemetryRef.current.totalSwapCount * 60_000) / elapsedMs
    );
    const repaintSpikeCount = previewSwapTelemetryRef.current.repaintSpikeCount;
    setPreviewSwapMetrics((prev) => {
      if (
        prev.swapRatePerMinute === swapRatePerMinute &&
        prev.repaintSpikeCount === repaintSpikeCount &&
        prev.lastSwapBurstCount === swappedCount
      ) {
        return prev;
      }
      return {
        swapRatePerMinute,
        repaintSpikeCount,
        lastSwapBurstCount: swappedCount,
      };
    });
  }, [
    previousVisiblePreviewUrlByIdRef,
    previewSwapTelemetryRef,
    renderedItemCount,
    setPreviewSwapMetrics,
    suspendVisualTelemetry,
    visibleCardItems,
  ]);

  useEffect(() => {
    if (outputsLength > 0) return;
    previousVisiblePreviewUrlByIdRef.current = {};
    previewSwapTelemetryRef.current = {
      windowStartedAtMs: 0,
      totalSwapCount: 0,
      repaintSpikeCount: 0,
    };
    setPreviewSwapMetrics((prev) => {
      if (
        prev.swapRatePerMinute === 0 &&
        prev.repaintSpikeCount === 0 &&
        prev.lastSwapBurstCount === 0
      ) {
        return prev;
      }
      return {
        swapRatePerMinute: 0,
        repaintSpikeCount: 0,
        lastSwapBurstCount: 0,
      };
    });
  }, [
    outputsLength,
    previousVisiblePreviewUrlByIdRef,
    previewSwapTelemetryRef,
    setPreviewSwapMetrics,
  ]);
};
