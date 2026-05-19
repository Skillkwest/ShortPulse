import { describe, expect, it } from "vitest";
import {
  buildPacketFromPanelCapture,
  parseArgs,
  selectRepresentativeOpenPhaseListSummary,
} from "../media_panel_kpi_capture.mjs";

describe("media_panel_kpi_capture", () => {
  const createCaptureSample = (overrides = {}) => ({
    ok: true,
    firstVisibleKind: "media",
    firstVisibleMs: 1420,
    loadingStateVisibleMs: 980,
    stableContentSettleMs: 1680,
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
    openPhaseListSummary: {
      mediaKind: "all",
      profile: "expanded",
      rowCount: 36,
      includeLibraryTotalCount: true,
      countsByKind: {
        image: 20,
        video: 10,
        audio: 6,
        other: 0,
      },
      withThumbVariantCount: 20,
      withPosterVariantCount: 10,
      withPreviewVariantCount: 8,
      withAnyDurablePreviewCount: 28,
      signedSeedCount: 0,
      firstRowsSample: [
        {
          fileType: "image/png",
          source: "upload",
          hasThumbVariant: true,
          hasPosterVariant: false,
          hasPreviewVariant: false,
        },
      ],
    },
    openPhaseVisiblePreviewSummary: {
      visibleMediaCardCount: 6,
      visiblePreviewReadyCount: 5,
      visibleMissingPreviewCount: 1,
    },
    ...overrides,
  });

  it("builds a KPI packet from repeated panel captures", () => {
    const packet = buildPacketFromPanelCapture(
      {
        captures: [
          createCaptureSample({
            firstVisibleMs: 1200,
            loadingStateVisibleMs: 800,
            stableContentSettleMs: 1500,
          }),
          createCaptureSample({
            firstVisibleMs: 1300,
            loadingStateVisibleMs: 860,
            stableContentSettleMs: 1600,
          }),
          createCaptureSample({
            firstVisibleMs: 1420,
            loadingStateVisibleMs: 980,
            stableContentSettleMs: 1680,
          }),
          createCaptureSample({
            firstVisibleMs: 1500,
            loadingStateVisibleMs: 1010,
            stableContentSettleMs: 1760,
          }),
          createCaptureSample({
            firstVisibleMs: 1710,
            loadingStateVisibleMs: 1200,
            stableContentSettleMs: 1900,
          }),
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
    expect(packet.metrics.stableContentSettleMsP95).toBe(1872);
    expect(packet.metrics.stateFlipCountPerOpen).toBe(2);
    expect(packet.metrics.extraListCallsPerOpen).toBe(2);
    expect(packet.metrics.signBatchP95Ms).toBe(280);
    expect(packet.metrics.signFailedRatio).toBe(0);
    expect(packet.metrics.resolveCallsPerOpen).toBe(1);
    expect(packet.metrics.resolveFailedRatio).toBe(0);
    expect(packet.metrics.fallbackCallsPerOpen).toBe(1);
    expect(packet.metrics.fallbackFailedRatio).toBe(0);
    expect(packet.metrics.canonicalPreviewCoverageRatio).toBe(1);
    expect(packet.metrics.missingPreviewRatio).toBe(0.1667);
    expect(packet.metrics.visualRegressionCount).toBeNull();
    expect(packet.metrics.emptyStateMismatchCount).toBeNull();
    expect(packet.analysis.requestedRootTab).toBe("all");
    expect(packet.analysis.signStatsPhaseUsed).toBe("open");
    expect(packet.analysis.openPhaseListSummary).toEqual({
      samples: 5,
      dominantMediaKind: "all",
      dominantProfile: "expanded",
      includeLibraryTotalCount: true,
      averageRowCount: 36,
      averageSignedSeedCount: 0,
      averageWithThumbVariantCount: 20,
      averageWithPosterVariantCount: 10,
      averageWithPreviewVariantCount: 8,
      averageWithAnyDurablePreviewCount: 28,
      averageCountsByKind: {
        image: 20,
        video: 10,
        audio: 6,
        other: 0,
      },
      representativeFirstRows: [
        {
          fileType: "image/png",
          source: "upload",
          hasThumbVariant: true,
          hasPosterVariant: false,
          hasPreviewVariant: false,
        },
      ],
    });
    expect(packet.analysis.openPhaseVisiblePreviewSummary).toEqual({
      samples: 5,
      visibleMediaCardCount: 30,
      visiblePreviewReadyCount: 25,
      visibleMissingPreviewCount: 5,
      missingPreviewRatio: 0.1667,
    });
    expect(packet.analysis.openPhaseSignTabBreakdown).toEqual([
      {
        tab: "unknown",
        samples: 15,
        signBatchP95Ms: 280,
        totalSigned: 60,
        totalFailed: 0,
        totalPrimaryDurable: 40,
        totalPrimaryOriginal: 20,
        totalResolvedDurable: 40,
        totalResolvedOriginal: 20,
        canonicalPreviewCoverageRatio: 1,
      },
    ]);
  });

  it("keeps direct timing p95 fields null when fewer than five runs were captured", () => {
    const packet = buildPacketFromPanelCapture(createCaptureSample(), {
      environment: "production",
      rootTab: "images",
    });

    expect(packet.sampleCount).toBe(1);
    expect(packet.analysis.requestedRootTab).toBe("images");
    expect(packet.metrics.firstMediaPaintP95Ms).toBeNull();
    expect(packet.metrics.loadingStateVisibleMsP95).toBeNull();
    expect(packet.metrics.openToFirstMediaP95Ms).toBeNull();
    expect(packet.metrics.stableContentSettleMsP95).toBeNull();
    expect(packet.metrics.signBatchP95Ms).toBe(280);
    expect(packet.metrics.canonicalPreviewCoverageRatio).toBe(1);
    expect(packet.metrics.missingPreviewRatio).toBe(0.1667);
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
    expect(packet.analysis.openPhaseListSummary).toEqual({
      samples: 5,
      dominantMediaKind: "all",
      dominantProfile: "expanded",
      includeLibraryTotalCount: true,
      averageRowCount: 36,
      averageSignedSeedCount: 0,
      averageWithThumbVariantCount: 20,
      averageWithPosterVariantCount: 10,
      averageWithPreviewVariantCount: 8,
      averageWithAnyDurablePreviewCount: 28,
      averageCountsByKind: {
        image: 20,
        video: 10,
        audio: 6,
        other: 0,
      },
      representativeFirstRows: [
        {
          fileType: "image/png",
          source: "upload",
          hasThumbVariant: true,
          hasPosterVariant: false,
          hasPreviewVariant: false,
        },
      ],
    });
    expect(packet.analysis.openPhaseVisiblePreviewSummary).toEqual({
      samples: 5,
      visibleMediaCardCount: 30,
      visiblePreviewReadyCount: 25,
      visibleMissingPreviewCount: 5,
      missingPreviewRatio: 0.1667,
    });
    expect(packet.analysis.openPhaseSignTabBreakdown).toEqual([
      {
        tab: "uploaded_images",
        samples: 5,
        signBatchP95Ms: 210,
        totalSigned: 30,
        totalFailed: 0,
        totalPrimaryDurable: 30,
        totalPrimaryOriginal: 0,
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
        totalPrimaryDurable: 0,
        totalPrimaryOriginal: 30,
        totalResolvedDurable: 0,
        totalResolvedOriginal: 30,
        canonicalPreviewCoverageRatio: null,
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
    expect(packet.metrics.canonicalPreviewCoverageRatio).toBe(1);
  });

  it("aggregates mixed open-phase list payloads into retained analysis", () => {
    const packet = buildPacketFromPanelCapture(
      {
        captures: [
          createCaptureSample({
            openPhaseListSummary: {
              mediaKind: "all",
              profile: "expanded",
              rowCount: 36,
              includeLibraryTotalCount: true,
              countsByKind: { image: 18, video: 12, audio: 6, other: 0 },
              withThumbVariantCount: 18,
              withPosterVariantCount: 12,
              withPreviewVariantCount: 9,
              withAnyDurablePreviewCount: 30,
              signedSeedCount: 0,
              firstRowsSample: [
                {
                  fileType: "audio/mpeg",
                  source: "upload",
                  hasThumbVariant: false,
                  hasPosterVariant: false,
                  hasPreviewVariant: false,
                },
              ],
            },
          }),
          createCaptureSample({
            openPhaseListSummary: {
              mediaKind: "all",
              profile: "expanded",
              rowCount: 36,
              includeLibraryTotalCount: true,
              countsByKind: { image: 16, video: 14, audio: 6, other: 0 },
              withThumbVariantCount: 16,
              withPosterVariantCount: 14,
              withPreviewVariantCount: 10,
              withAnyDurablePreviewCount: 30,
              signedSeedCount: 0,
              firstRowsSample: [
                {
                  fileType: "audio/mpeg",
                  source: "upload",
                  hasThumbVariant: false,
                  hasPosterVariant: false,
                  hasPreviewVariant: false,
                },
              ],
            },
          }),
        ],
      },
      {
        environment: "production",
      }
    );

    expect(packet.analysis.openPhaseListSummary).toEqual({
      samples: 2,
      dominantMediaKind: "all",
      dominantProfile: "expanded",
      includeLibraryTotalCount: true,
      averageRowCount: 36,
      averageSignedSeedCount: 0,
      averageWithThumbVariantCount: 17,
      averageWithPosterVariantCount: 13,
      averageWithPreviewVariantCount: 9.5,
      averageWithAnyDurablePreviewCount: 30,
      averageCountsByKind: {
        image: 17,
        video: 13,
        audio: 6,
        other: 0,
      },
      representativeFirstRows: [
        {
          fileType: "audio/mpeg",
          source: "upload",
          hasThumbVariant: false,
          hasPosterVariant: false,
          hasPreviewVariant: false,
        },
      ],
    });
  });

  it("chooses the richest open-phase list payload when one run emits multiple list responses", () => {
    const selected = selectRepresentativeOpenPhaseListSummary([
      {
        mediaKind: "all",
        profile: "expanded",
        rowCount: 12,
        includeLibraryTotalCount: false,
        countsByKind: { image: 4, video: 4, audio: 4, other: 0 },
        withThumbVariantCount: 4,
        withPosterVariantCount: 4,
        withPreviewVariantCount: 0,
        withAnyDurablePreviewCount: 8,
        signedSeedCount: 0,
        firstRowsSample: [
          {
            fileType: "audio/mpeg",
            source: "upload",
            hasThumbVariant: false,
            hasPosterVariant: false,
            hasPreviewVariant: false,
          },
        ],
      },
      {
        mediaKind: "all",
        profile: "expanded",
        rowCount: 36,
        includeLibraryTotalCount: true,
        countsByKind: { image: 20, video: 10, audio: 6, other: 0 },
        withThumbVariantCount: 20,
        withPosterVariantCount: 10,
        withPreviewVariantCount: 8,
        withAnyDurablePreviewCount: 28,
        signedSeedCount: 0,
        firstRowsSample: [
          {
            fileType: "image/png",
            source: "upload",
            hasThumbVariant: true,
            hasPosterVariant: false,
            hasPreviewVariant: false,
          },
        ],
      },
    ]);

    expect(selected).toEqual({
      mediaKind: "all",
      profile: "expanded",
      rowCount: 36,
      includeLibraryTotalCount: true,
      countsByKind: { image: 20, video: 10, audio: 6, other: 0 },
      withThumbVariantCount: 20,
      withPosterVariantCount: 10,
      withPreviewVariantCount: 8,
      withAnyDurablePreviewCount: 28,
      signedSeedCount: 0,
      firstRowsSample: [
        {
          fileType: "image/png",
          source: "upload",
          hasThumbVariant: true,
          hasPosterVariant: false,
          hasPreviewVariant: false,
        },
      ],
    });
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
      "--root-tab",
      "audio",
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
    expect(args.rootTab).toBe("audio");
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
