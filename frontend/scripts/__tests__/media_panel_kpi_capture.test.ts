import { describe, expect, it } from "vitest";
import { buildPacketFromPanelCapture, parseArgs } from "../media_panel_kpi_capture.mjs";

describe("media_panel_kpi_capture", () => {
  const createCaptureSample = (overrides = {}) => ({
    ok: true,
    firstVisibleKind: "media",
    firstVisibleMs: 1420,
    loadingStateVisibleMs: 980,
    stateFlipCount: 2,
    initialListRequestCount: 3,
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
    ...overrides,
  });

  it("builds a KPI packet from repeated panel captures", () => {
    const packet = buildPacketFromPanelCapture(
      {
        captures: [
          createCaptureSample({ firstVisibleMs: 1200, loadingStateVisibleMs: 800 }),
          createCaptureSample({ firstVisibleMs: 1300, loadingStateVisibleMs: 860 }),
          createCaptureSample({ firstVisibleMs: 1420, loadingStateVisibleMs: 980 }),
          createCaptureSample({ firstVisibleMs: 1500, loadingStateVisibleMs: 1010 }),
          createCaptureSample({ firstVisibleMs: 1710, loadingStateVisibleMs: 1200 }),
        ],
      },
      {
        environment: "production",
        captureMode: "playwright-panel-audit+live-perf-handle",
      }
    );

    expect(packet.surface).toBe("ai-studio-panel");
    expect(packet.sampleCount).toBe(5);
    expect(packet.metrics.firstMediaPaintP95Ms).toBe(1668);
    expect(packet.metrics.openToFirstMediaP95Ms).toBe(1668);
    expect(packet.metrics.loadingStateVisibleMsP95).toBe(1162);
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
    expect(packet.analysis.signStatsPhaseUsed).toBe("open");
    expect(packet.analysis.openPhaseSignTabBreakdown).toEqual([
      {
        tab: "unknown",
        samples: 15,
        signBatchP95Ms: 280,
        totalSigned: 60,
        totalFailed: 0,
        totalResolvedDurable: 40,
        totalResolvedOriginal: 20,
        canonicalPreviewCoverageRatio: 0.6667,
      },
    ]);
  });

  it("keeps direct timing p95 fields null when fewer than five runs were captured", () => {
    const packet = buildPacketFromPanelCapture(createCaptureSample(), {
      environment: "production",
    });

    expect(packet.sampleCount).toBe(1);
    expect(packet.metrics.firstMediaPaintP95Ms).toBeNull();
    expect(packet.metrics.loadingStateVisibleMsP95).toBeNull();
    expect(packet.metrics.openToFirstMediaP95Ms).toBeNull();
    expect(packet.metrics.signBatchP95Ms).toBe(280);
    expect(packet.metrics.canonicalPreviewCoverageRatio).toBe(0.6667);
  });

  it("prefers open-phase sign stats over post-tab churn when deriving coverage", () => {
    const packet = buildPacketFromPanelCapture(
      {
        captures: Array.from({ length: 5 }, () =>
          createCaptureSample({
            openPhasePerfHandle: {
              available: true,
              signStats: [
                {
                  surface: "media-library-panel",
                  tab: "uploaded_images",
                  samples: 1,
                  p95_duration_ms: 210,
                  total_signed: 6,
                  total_failed: 0,
                  total_resolved_durable: 6,
                  total_resolved_original: 0,
                  total_primary_durable: 6,
                  total_primary_original: 0,
                },
              ],
              resolveStats: [],
              fallbackStats: [],
            },
            postTabPerfHandle: {
              available: true,
              signStats: [
                {
                  surface: "media-library-panel",
                  tab: "uploaded_images",
                  samples: 1,
                  p95_duration_ms: 510,
                  total_signed: 6,
                  total_failed: 0,
                  total_resolved_durable: 0,
                  total_resolved_original: 6,
                  total_primary_durable: 0,
                  total_primary_original: 6,
                },
              ],
              resolveStats: [],
              fallbackStats: [],
            },
            perfHandle: {
              available: true,
              signStats: [
                {
                  surface: "media-library-panel",
                  tab: "uploaded_images",
                  samples: 1,
                  p95_duration_ms: 510,
                  total_signed: 6,
                  total_failed: 0,
                  total_resolved_durable: 0,
                  total_resolved_original: 6,
                  total_primary_durable: 0,
                  total_primary_original: 6,
                },
              ],
              resolveStats: [],
              fallbackStats: [],
            },
          })
        ),
      },
      {
        environment: "production",
      }
    );

    expect(packet.metrics.signBatchP95Ms).toBe(210);
    expect(packet.metrics.canonicalPreviewCoverageRatio).toBe(1);
    expect(packet.analysis.signStatsPhaseUsed).toBe("open");
    expect(packet.analysis.openPhaseSignTabBreakdown).toEqual([
      {
        tab: "uploaded_images",
        samples: 5,
        signBatchP95Ms: 210,
        totalSigned: 30,
        totalFailed: 0,
        totalResolvedDurable: 30,
        totalResolvedOriginal: 0,
        canonicalPreviewCoverageRatio: 1,
      },
    ]);
    expect(packet.analysis.postTabSignTabBreakdown).toEqual([
      {
        tab: "uploaded_images",
        samples: 5,
        signBatchP95Ms: 510,
        totalSigned: 30,
        totalFailed: 0,
        totalResolvedDurable: 0,
        totalResolvedOriginal: 30,
        canonicalPreviewCoverageRatio: 0,
      },
    ]);
  });

  it("builds an Elements packet using the same shared telemetry surface", () => {
    const packet = buildPacketFromPanelCapture(
      {
        captures: Array.from({ length: 5 }, (_, index) =>
          createCaptureSample({
            telemetrySurface: "media-library-panel",
            firstVisibleMs: 1110 + index * 20,
            loadingStateVisibleMs: 700 + index * 10,
            stateFlipCount: 1,
            initialListRequestCount: 2,
            listRequestCount: 2,
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
          })
        ),
      },
      {
        environment: "production",
        surface: "elements-media-panel",
      }
    );

    expect(packet.surface).toBe("elements-media-panel");
    expect(packet.notes[0]).toContain("Elements embedded media panel");
    expect(packet.metrics.firstMediaPaintP95Ms).toBe(1186);
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
        initialListRequestCount: 1,
        listRequestCount: 3,
        initialResolveRequestCount: 2,
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
    expect(packet.metrics.fallbackCallsPerOpen).toBeNull();
    expect(packet.metrics.fallbackFailedRatio).toBeNull();
  });

  it("parses capture args", () => {
    const args = parseArgs([
      "--surface",
      "ai-studio-panel",
      "--base-url",
      "https://www.shortpulse.ai",
      "--runs",
      "7",
      "--format",
      "markdown",
      "--headless",
      "false",
      "--write-packet",
      "/tmp/panel.packet.json",
    ]);

    expect(args.surface).toBe("ai-studio-panel");
    expect(args.baseUrl).toBe("https://www.shortpulse.ai");
    expect(args.runs).toBe("7");
    expect(args.format).toBe("markdown");
    expect(args.headless).toBe("false");
    expect(args.writePacket).toBe("/tmp/panel.packet.json");
  });

  it("parses an Elements surface", () => {
    const args = parseArgs(["--surface", "elements-media-panel"]);
    expect(args.surface).toBe("elements-media-panel");
  });
});
