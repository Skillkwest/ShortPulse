import { describe, expect, it } from "vitest";
import {
  buildMarkdownReport,
  buildTemplatePacket,
  parseArgs,
  scorePacket,
} from "../media_panel_kpi_score.mjs";

describe("media_panel_kpi_score", () => {
  it("builds a template packet for supported surfaces", () => {
    const packet = buildTemplatePacket("ai-studio-panel");

    expect(packet.surface).toBe("ai-studio-panel");
    expect(packet.packetVersion).toBe(2);
    expect(packet.environment).toBeNull();
    expect(packet.captureMode).toBeNull();
    expect(packet.sampleCount).toBeNull();
    expect(packet.metrics.firstMediaPaintP95Ms).toBeNull();
    expect(packet.metrics.loadingStateVisibleMsP95).toBeNull();
    expect(packet.metrics.canonicalPreviewCoverageRatio).toBeNull();
    expect(packet.metrics.saveRoundtripFailureRate).toBeNull();
    expect(packet.metrics.saveBrowseReadyRatio).toBeNull();
  });

  it("rejects unknown surfaces when building a template", () => {
    expect(() => buildTemplatePacket("reference-grid")).toThrow(/Unknown template surface/);
  });

  it("scores a strong packet highly", () => {
    const scored = scorePacket({
      packetVersion: 2,
      measuredAt: "2026-05-15T17:00:00.000Z",
      environment: "production",
      captureMode: "manual+telemetry",
      sampleCount: 12,
      surface: "ai-studio-panel",
      metrics: {
        firstMediaPaintP95Ms: 520,
        loadingStateVisibleMsP95: 600,
        openToFirstMediaP95Ms: 900,
        stableContentSettleMsP95: 1100,
        signBatchP95Ms: 120,
        resolveCallsPerOpen: 0.05,
        fallbackCallsPerOpen: 0,
        stateFlipCountPerOpen: 0.1,
        extraListCallsPerOpen: 0.1,
        signFailedRatio: 0,
        resolveFailedRatio: 0,
        fallbackFailedRatio: 0,
        consoleErrorsPerOpen: 0,
        visualRegressionCount: 0,
        missingPreviewRatio: 0,
        canonicalPreviewCoverageRatio: 1,
        emptyStateMismatchCount: 0,
        saveRoundtripFailureRate: 0,
        saveRoundtripMismatchRate: 0,
        saveBrowseReadyRatio: 1,
      },
    });

    expect(scored.grade).toMatch(/^A/);
    expect(scored.overallScore10).toBeGreaterThanOrEqual(9);
    expect(scored.missingMetrics).toEqual([]);
    expect(scored.evidence).toBe("high");
    expect(scored.scoreCapsApplied).toEqual([]);
  });

  it("caps partial packets with weak evidence", () => {
    const scored = scorePacket({
      packetVersion: 1,
      surface: "elements-media-panel",
      metrics: {
        firstMediaPaintP95Ms: 1400,
        loadingStateVisibleMsP95: 2800,
        signBatchP95Ms: 350,
        resolveCallsPerOpen: 0.8,
        fallbackCallsPerOpen: 0.35,
        signFailedRatio: 0.05,
        resolveFailedRatio: 0.1,
      },
    });

    expect(scored.coverage).toBeLessThan(1);
    expect(scored.coverage).toBeLessThan(0.75);
    expect(scored.missingMetrics).toContain("saveRoundtripFailureRate");
    expect(scored.overallScore10).toBeLessThanOrEqual(6);
    expect(scored.scoreCapsApplied.some((reason) => reason.startsWith("coverage below"))).toBe(
      true
    );
  });

  it("builds a markdown report", () => {
    const scored = scorePacket({
      packetVersion: 2,
      environment: "production",
      captureMode: "telemetry",
      sampleCount: 8,
      surface: "ai-studio-panel",
      metrics: {
        firstMediaPaintP95Ms: 700,
        loadingStateVisibleMsP95: 900,
        openToFirstMediaP95Ms: 1100,
        stableContentSettleMsP95: 1600,
        signBatchP95Ms: 180,
        resolveCallsPerOpen: 0.15,
        fallbackCallsPerOpen: 0.05,
        stateFlipCountPerOpen: 0.2,
        extraListCallsPerOpen: 0.1,
        signFailedRatio: 0.01,
        resolveFailedRatio: 0.01,
        fallbackFailedRatio: 0.01,
        consoleErrorsPerOpen: 0,
        visualRegressionCount: 0,
        missingPreviewRatio: 0.01,
        canonicalPreviewCoverageRatio: 0.98,
        emptyStateMismatchCount: 0,
      },
    });

    const markdown = buildMarkdownReport(scored);

    expect(markdown).toContain("# Media Panel KPI Report");
    expect(markdown).toContain("AI Studio Media Panel");
    expect(markdown).toContain("Category Scores");
    expect(markdown).toContain("Evidence quality");
  });

  it("rejects unsupported packet versions", () => {
    expect(() =>
      scorePacket({
        packetVersion: 9,
        surface: "ai-studio-panel",
        metrics: {},
      })
    ).toThrow(/Unsupported packetVersion/);
  });

  it("rejects out-of-range metric values", () => {
    expect(() =>
      scorePacket({
        packetVersion: 2,
        surface: "ai-studio-panel",
        metrics: {
          signFailedRatio: -0.2,
        },
      })
    ).toThrow(/signFailedRatio/);

    expect(() =>
      scorePacket({
        packetVersion: 2,
        surface: "ai-studio-panel",
        metrics: {
          canonicalPreviewCoverageRatio: 1.2,
        },
      })
    ).toThrow(/canonicalPreviewCoverageRatio/);
  });

  it("rejects unknown metric keys", () => {
    expect(() =>
      scorePacket({
        packetVersion: 2,
        surface: "ai-studio-panel",
        metrics: {
          fakeMetric: 1,
        },
      })
    ).toThrow(/Unknown metric keys/);
  });

  it("applies critical-failure caps", () => {
    const scored = scorePacket({
      packetVersion: 2,
      surface: "ai-studio-panel",
      metrics: {
        firstMediaPaintP95Ms: 300,
        loadingStateVisibleMsP95: 400,
        openToFirstMediaP95Ms: 500,
        stableContentSettleMsP95: 900,
        signBatchP95Ms: 80,
        resolveCallsPerOpen: 0,
        fallbackCallsPerOpen: 0,
        stateFlipCountPerOpen: 0,
        extraListCallsPerOpen: 0,
        signFailedRatio: 0,
        resolveFailedRatio: 0,
        fallbackFailedRatio: 0,
        consoleErrorsPerOpen: 0,
        visualRegressionCount: 1,
        missingPreviewRatio: 0,
        canonicalPreviewCoverageRatio: 1,
        emptyStateMismatchCount: 0,
      },
    });

    expect(scored.rawOverallScore10).toBeGreaterThan(scored.overallScore10);
    expect(scored.overallScore10).toBeLessThanOrEqual(5.5);
    expect(scored.scoreCapsApplied).toContain("visual regressions observed");
  });

  it("caps strong packets with tiny sample counts", () => {
    const scored = scorePacket({
      packetVersion: 2,
      environment: "production",
      captureMode: "manual+telemetry",
      sampleCount: 1,
      surface: "ai-studio-panel",
      metrics: {
        firstMediaPaintP95Ms: 520,
        loadingStateVisibleMsP95: 600,
        openToFirstMediaP95Ms: 900,
        stableContentSettleMsP95: 1100,
        signBatchP95Ms: 120,
        resolveCallsPerOpen: 0.05,
        fallbackCallsPerOpen: 0,
        stateFlipCountPerOpen: 0.1,
        extraListCallsPerOpen: 0.1,
        signFailedRatio: 0,
        resolveFailedRatio: 0,
        fallbackFailedRatio: 0,
        consoleErrorsPerOpen: 0,
        visualRegressionCount: 0,
        missingPreviewRatio: 0,
        canonicalPreviewCoverageRatio: 1,
        emptyStateMismatchCount: 0,
      },
    });

    expect(scored.rawOverallScore10).toBeGreaterThan(scored.overallScore10);
    expect(scored.evidence).toBe("insufficient");
    expect(scored.readiness).toBe("insufficient evidence");
    expect(scored.scoreCapsApplied).toContain("sample count below 2");
  });

  it("parses template args", () => {
    const args = parseArgs(["--template", "--surface", "elements-media-panel"]);

    expect(args.template).toBe(true);
    expect(args.surface).toBe("elements-media-panel");
  });
});
