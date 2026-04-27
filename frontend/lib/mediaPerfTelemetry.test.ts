import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearMediaPerfEvents,
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

    vi.advanceTimersByTime(800);
    logMediaPerf("media.grid.scroll.sample", { a: 3 });
    expect(getMediaPerfSnapshot()).toHaveLength(0);

    vi.advanceTimersByTime(200);
    expect(getMediaPerfSnapshot()).toHaveLength(1);
    expect(getMediaPerfSnapshot()[0]?.event).toBe("media.grid.scroll.sample");
  });

  it("keeps critical events immediate in defer mode", () => {
    setMediaPerfSamplingPolicy("defer_non_critical");
    logMediaPerf("media.grid.render.commit", { duration_ms: 12 });

    expect(getMediaPerfSnapshot()).toHaveLength(1);
    expect(getMediaPerfSnapshot()[0]?.event).toBe("media.grid.render.commit");
  });

  it("accepts panel media paint events", () => {
    logMediaPerf("media.panel.first_media_paint", { asset_kind: "image", duration_ms: 42 });

    expect(getMediaPerfSnapshot()).toHaveLength(1);
    expect(getMediaPerfSnapshot()[0]?.event).toBe("media.panel.first_media_paint");
  });
});
