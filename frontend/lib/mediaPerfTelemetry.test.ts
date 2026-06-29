import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearMediaPerfEvents,
  getMediaPerfFallbackStats,
  getMediaPerfResolveStats,
  getMediaPerfSnapshot,
  logMediaPerf,
  setMediaPerfSamplingPolicy,
} from "./mediaPerfTelemetry";

vi.mock("./clientBreadcrumbs", () => ({
  addBreadcrumb: vi.fn(),
}));

describe("mediaPerfTelemetry sampling policy", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearMediaPerfEvents();
    setMediaPerfSamplingPolicy("normal");
  });

  afterEach(() => {
    setMediaPerfSamplingPolicy("normal");
    clearMediaPerfEvents();
    vi.useRealTimers();
  });

  it("defers non-critical events and rate-limits repeated samples", () => {
    setMediaPerfSamplingPolicy("defer_non_critical");
    logMediaPerf("media.grid.scroll.sample", { a: 1 });
    logMediaPerf("media.grid.scroll.sample", { a: 2 });
    expect(getMediaPerfSnapshot()).toHaveLength(0);

    vi.advanceTimersByTime(200);
    expect(getMediaPerfSnapshot()).toHaveLength(1);
    expect(getMediaPerfSnapshot()[0]?.data.a).toBe(1);

    vi.advanceTimersByTime(600);
    logMediaPerf("media.grid.scroll.sample", { a: 3 });
    expect(getMediaPerfSnapshot()).toHaveLength(1);

    vi.advanceTimersByTime(200);
    expect(getMediaPerfSnapshot()).toHaveLength(2);
    expect(getMediaPerfSnapshot()[1]?.event).toBe("media.grid.scroll.sample");
    expect(getMediaPerfSnapshot()[1]?.data.a).toBe(3);
  });

  it("keeps critical events immediate in defer mode", () => {
    setMediaPerfSamplingPolicy("defer_non_critical");
    logMediaPerf("media.grid.render.commit", { duration_ms: 12 });

    expect(getMediaPerfSnapshot()).toHaveLength(1);
    expect(getMediaPerfSnapshot()[0]?.event).toBe("media.grid.render.commit");
  });

  it("defers long-task samples under telemetry backpressure", () => {
    setMediaPerfSamplingPolicy("defer_non_critical");
    logMediaPerf("media.grid.longtask.sample", { duration_ms: 120 });

    expect(getMediaPerfSnapshot()).toHaveLength(0);

    vi.advanceTimersByTime(200);
    expect(getMediaPerfSnapshot()).toHaveLength(1);
    expect(getMediaPerfSnapshot()[0]?.event).toBe("media.grid.longtask.sample");
  });

  it("accepts panel media paint events", () => {
    logMediaPerf("media.panel.first_media_paint", { asset_kind: "image", duration_ms: 42 });

    expect(getMediaPerfSnapshot()).toHaveLength(1);
    expect(getMediaPerfSnapshot()[0]?.event).toBe("media.panel.first_media_paint");
  });

  it("aggregates resolve-previews completion stats by surface", () => {
    logMediaPerf("media.resolve_previews.completed", {
      surface: "media-library-panel",
      batch_size: 2,
      resolved_count: 1,
      failed_count: 1,
      duration_ms: 12,
    });
    logMediaPerf("media.resolve_previews.completed", {
      surface: "media-library-panel",
      batch_size: 3,
      resolved_count: 3,
      failed_count: 0,
      duration_ms: 18,
    });

    expect(getMediaPerfResolveStats()).toEqual([
      {
        surface: "media-library-panel",
        samples: 2,
        avg_duration_ms: 15,
        p50_duration_ms: 12,
        p95_duration_ms: 12,
        total_batch_size: 5,
        total_resolved: 4,
        total_failed: 1,
        failed_ratio: 0.2,
      },
    ]);
  });

  it("aggregates storage-download fallback stats by surface", () => {
    logMediaPerf("media.storage_download_fallback.completed", {
      surface: "media-library-modal",
      candidate_count: 2,
      succeeded_count: 1,
      failed_count: 0,
      duration_ms: 14,
    });
    logMediaPerf("media.storage_download_fallback.failed", {
      surface: "media-library-modal",
      candidate_count: 3,
      succeeded_count: 0,
      failed_count: 1,
      duration_ms: 20,
    });

    expect(getMediaPerfFallbackStats()).toEqual([
      {
        surface: "media-library-modal",
        samples: 2,
        avg_duration_ms: 17,
        p50_duration_ms: 14,
        p95_duration_ms: 14,
        total_candidates: 5,
        total_succeeded: 1,
        total_failed: 1,
        failed_ratio: 0.5,
      },
    ]);
  });
});
