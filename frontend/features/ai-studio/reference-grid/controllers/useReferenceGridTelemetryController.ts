/**
 * Telemetry controller for Reference Grid.
 * Encapsulates render commit sampling, longtask observation, and telemetry backpressure policy.
 */
import { useEffect, type MutableRefObject } from "react";
import { logMediaPerf, setMediaPerfSamplingPolicy } from "../../../../lib/mediaPerfTelemetry";
import type { ReferenceGridDropMode } from "./useReferenceGridDropController";

type UseReferenceGridTelemetryControllerArgs = {
  renderCommitTelemetryEnabled: boolean;
  telemetryBackpressureEnabled: boolean;
  lastRenderCommitAtRef: MutableRefObject<number>;
  renderedItemCount: number;
  outputsLength: number;
  shouldVirtualize: boolean;
  isHighDensity: boolean;
  imageHydrationQueueSize: number;
  imageDecodeInflight: number;
  perfDegradeLevel: 0 | 1 | 2;
  previewSwapRatePerMinute: number;
  previewRepaintSpikeCount: number;
  previewLastSwapBurstCount: number;
  startIndex: number;
  endIndex: number;
  canvasDropMode: ReferenceGridDropMode;
  isCuratedDropActive: boolean;
  loadingCardCount: number;
};

/**
 * Installs telemetry-related effects while preserving existing sampling semantics.
 */
export const useReferenceGridTelemetryController = ({
  renderCommitTelemetryEnabled,
  telemetryBackpressureEnabled,
  lastRenderCommitAtRef,
  renderedItemCount,
  outputsLength,
  shouldVirtualize,
  isHighDensity,
  imageHydrationQueueSize,
  imageDecodeInflight,
  perfDegradeLevel,
  previewSwapRatePerMinute,
  previewRepaintSpikeCount,
  previewLastSwapBurstCount,
  startIndex,
  endIndex,
  canvasDropMode,
  isCuratedDropActive,
  loadingCardCount,
}: UseReferenceGridTelemetryControllerArgs): void => {
  useEffect(() => {
    if (!renderCommitTelemetryEnabled) return;
    if (typeof performance === "undefined") return;
    const now = performance.now();
    const durationMs =
      lastRenderCommitAtRef.current > 0
        ? Math.max(0, Math.round(now - lastRenderCommitAtRef.current))
        : 0;
    lastRenderCommitAtRef.current = now;
    logMediaPerf("media.grid.render.commit", {
      surface: "reference-grid",
      rendered_item_count: renderedItemCount,
      total_item_count: outputsLength,
      virtualized: shouldVirtualize,
      high_density: isHighDensity,
      image_hydration_queue: imageHydrationQueueSize,
      image_decode_inflight: imageDecodeInflight,
      perf_degrade_level: perfDegradeLevel,
      preview_src_swap_rate_per_minute: previewSwapRatePerMinute,
      preview_repaint_spike_count: previewRepaintSpikeCount,
      preview_last_swap_burst_count: previewLastSwapBurstCount,
      duration_ms: durationMs,
    });
  }, [
    endIndex,
    imageDecodeInflight,
    imageHydrationQueueSize,
    isHighDensity,
    lastRenderCommitAtRef,
    outputsLength,
    perfDegradeLevel,
    previewLastSwapBurstCount,
    previewRepaintSpikeCount,
    previewSwapRatePerMinute,
    renderCommitTelemetryEnabled,
    renderedItemCount,
    shouldVirtualize,
    startIndex,
  ]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof PerformanceObserver === "undefined") return;
    const observer = new PerformanceObserver((entryList) => {
      entryList.getEntries().forEach((entry) => {
        logMediaPerf("media.grid.longtask.sample", {
          surface: "reference-grid",
          duration_ms: Math.round(entry.duration),
          name: entry.name,
        });
      });
    });
    try {
      observer.observe({ type: "longtask", buffered: true });
    } catch {
      observer.disconnect();
      return;
    }
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!telemetryBackpressureEnabled) return;
    const shouldDefer =
      perfDegradeLevel >= 1 ||
      canvasDropMode !== "none" ||
      isCuratedDropActive ||
      loadingCardCount > 8;
    setMediaPerfSamplingPolicy(shouldDefer ? "defer_non_critical" : "normal");
    return () => {
      setMediaPerfSamplingPolicy("normal");
    };
  }, [
    canvasDropMode,
    isCuratedDropActive,
    loadingCardCount,
    perfDegradeLevel,
    telemetryBackpressureEnabled,
  ]);
};
