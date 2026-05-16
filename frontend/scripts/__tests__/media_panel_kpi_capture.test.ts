import { describe, expect, it } from "vitest";
import { buildPacketFromPanelCapture, parseArgs } from "../media_panel_kpi_capture.mjs";

describe("media_panel_kpi_capture", () => {
  it("builds a KPI packet from a strong panel capture", () => {
    const packet = buildPacketFromPanelCapture(
      {
        ok: true,
        firstVisibleKind: "media",
        firstVisibleMs: 1420,
        loadingStateVisibleMs: 980,
        stateFlipCount: 2,
        listRequestCount: 3,
        consoleEntries: [],
        perfHandle: {
          available: true,
          signStats: [
            {
              surface: "media-library-panel",
              samples: 3,
              p95_duration_ms: 280,
              total_signed: 12,
              total_failed: 0,
              total_resolved_durable: 8,
              total_resolved_original: 4,
              total_primary_durable: 8,
              total_primary_original: 4,
            },
          ],
          resolveStats: [
            {
              surface: "media-library-panel",
              samples: 1,
              total_resolved: 4,
              total_failed: 0,
            },
          ],
          fallbackStats: [
            {
              surface: "media-library-panel",
              samples: 1,
              total_succeeded: 2,
              total_failed: 0,
            },
          ],
        },
      },
      {
        environment: "production",
        captureMode: "playwright-panel-audit+live-perf-handle",
      }
    );

    expect(packet.surface).toBe("ai-studio-panel");
    expect(packet.sampleCount).toBe(1);
    expect(packet.metrics.firstMediaPaintP95Ms).toBe(1420);
    expect(packet.metrics.openToFirstMediaP95Ms).toBe(1420);
    expect(packet.metrics.loadingStateVisibleMsP95).toBe(980);
    expect(packet.metrics.stateFlipCountPerOpen).toBe(2);
    expect(packet.metrics.extraListCallsPerOpen).toBe(2);
    expect(packet.metrics.signBatchP95Ms).toBe(280);
    expect(packet.metrics.signFailedRatio).toBe(0);
    expect(packet.metrics.resolveCallsPerOpen).toBe(1);
    expect(packet.metrics.resolveFailedRatio).toBe(0);
    expect(packet.metrics.fallbackCallsPerOpen).toBe(1);
    expect(packet.metrics.fallbackFailedRatio).toBe(0);
    expect(packet.metrics.canonicalPreviewCoverageRatio).toBe(0.6667);
    expect(packet.metrics.visualRegressionCount).toBeNull();
    expect(packet.metrics.emptyStateMismatchCount).toBeNull();
  });

  it("builds an Elements packet using the same shared telemetry surface", () => {
    const packet = buildPacketFromPanelCapture(
      {
        ok: true,
        telemetrySurface: "media-library-panel",
        firstVisibleKind: "media",
        firstVisibleMs: 1110,
        loadingStateVisibleMs: 700,
        stateFlipCount: 1,
        listRequestCount: 2,
        consoleEntries: [],
        perfHandle: {
          available: true,
          signStats: [
            {
              surface: "media-library-panel",
              samples: 2,
              p95_duration_ms: 190,
              total_signed: 10,
              total_failed: 0,
              total_resolved_durable: 7,
              total_resolved_original: 3,
              total_primary_durable: 7,
              total_primary_original: 3,
            },
          ],
          resolveStats: [],
          fallbackStats: [],
        },
      },
      {
        environment: "production",
        surface: "elements-media-panel",
      }
    );

    expect(packet.surface).toBe("elements-media-panel");
    expect(packet.notes[0]).toContain("Elements embedded media panel");
    expect(packet.metrics.firstMediaPaintP95Ms).toBe(1110);
    expect(packet.metrics.canonicalPreviewCoverageRatio).toBe(0.7);
  });

  it("keeps unsupported measurements null instead of inventing them", () => {
    const packet = buildPacketFromPanelCapture(
      {
        ok: true,
        firstVisibleKind: "empty",
        firstVisibleMs: 980,
        loadingStateVisibleMs: null,
        stateFlipCount: 1,
        listRequestCount: 1,
        resolveRequestCount: 2,
        fallbackRequestCount: 3,
        consoleEntries: [],
        perfHandle: {
          available: false,
        },
      },
      {
        environment: "development",
      }
    );

    expect(packet.metrics.firstMediaPaintP95Ms).toBeNull();
    expect(packet.metrics.openToFirstMediaP95Ms).toBeNull();
    expect(packet.metrics.signBatchP95Ms).toBeNull();
    expect(packet.metrics.canonicalPreviewCoverageRatio).toBeNull();
    expect(packet.metrics.extraListCallsPerOpen).toBe(0);
    expect(packet.metrics.resolveCallsPerOpen).toBe(2);
    expect(packet.metrics.resolveFailedRatio).toBeNull();
    expect(packet.metrics.fallbackCallsPerOpen).toBe(3);
    expect(packet.metrics.fallbackFailedRatio).toBeNull();
  });

  it("parses capture args", () => {
    const args = parseArgs([
      "--surface",
      "ai-studio-panel",
      "--base-url",
      "https://www.shortpulse.ai",
      "--format",
      "markdown",
      "--headless",
      "false",
      "--write-packet",
      "/tmp/panel.packet.json",
    ]);

    expect(args.surface).toBe("ai-studio-panel");
    expect(args.baseUrl).toBe("https://www.shortpulse.ai");
    expect(args.format).toBe("markdown");
    expect(args.headless).toBe("false");
    expect(args.writePacket).toBe("/tmp/panel.packet.json");
  });

  it("parses an Elements surface", () => {
    const args = parseArgs(["--surface", "elements-media-panel"]);
    expect(args.surface).toBe("elements-media-panel");
  });
});
