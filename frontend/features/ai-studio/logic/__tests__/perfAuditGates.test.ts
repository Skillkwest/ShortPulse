import { describe, expect, it } from "vitest";
import {
  evaluateReferenceGridAuditGates,
  evaluateStudioShellAuditGates,
  type ReferenceGridScenario,
  type StudioShellScenario,
} from "../perfAuditGates";

const REFERENCE_THRESHOLDS = {
  clickP95MsAt40: 90,
  longTaskP95MsAt40: 70,
  maxInputStallMsAt40: 450,
  renderedItemCountP95At40: 24,
  clickP95MsAt60: 120,
  longTaskP95MsAt60: 100,
  maxInputStallMsAt60: 800,
  renderedItemCountP95At60: 28,
};

const SHELL_THRESHOLDS = {
  toolbarP95MsAt60: 120,
  panelP95MsAt60: 140,
  toolSwitchVisualCommitP95MsAt60: 180,
  longTaskP95Ms: 120,
  maxInputStallMs: 1000,
  nonGridRerendersPerOutputStatusTick: 1,
};

describe("perfAuditGates", () => {
  it("treats missing long-task samples as pass-with-note for shell gates", () => {
    const scenarios: StudioShellScenario[] = [
      {
        count: 60,
        toolbar: { samples: 10, p95Ms: 80 },
        panel: { samples: 10, p95Ms: 90 },
        drop: { samples: 10, p95Ms: 70 },
        toolSwitchVisualCommit: { samples: 10, p95Ms: 95 },
        sectionRenderCounters: {
          toolbar: 8,
          properties: 8,
          reference: 2,
          preview: 2,
        },
        sectionCommit: {
          toolbarP95Ms: 80,
          propertiesP95Ms: 90,
          referenceP95Ms: 70,
          previewP95Ms: 70,
        },
        nonGridRerendersPerOutputStatusTick: {
          samples: 6,
          toolbarP95: 1,
          propertiesP95: 1,
        },
        longTask: { samples: 0, p95Ms: null },
        interaction: { maxInputStallMs: 40 },
      },
    ];
    const gates = evaluateStudioShellAuditGates(scenarios, SHELL_THRESHOLDS);
    const longTaskGate = gates.find(
      (gate) => gate.name === "long_task_p95_ms_during_shell_actions"
    );
    expect(longTaskGate?.pass).toBe(true);
    expect(longTaskGate?.note).toContain("No long tasks observed");
  });

  it("fails shell gates when p95 exceeds thresholds", () => {
    const scenarios: StudioShellScenario[] = [
      {
        count: 60,
        toolbar: { samples: 10, p95Ms: 240 },
        panel: { samples: 10, p95Ms: 240 },
        drop: { samples: 10, p95Ms: 240 },
        toolSwitchVisualCommit: { samples: 10, p95Ms: 280 },
        sectionRenderCounters: {
          toolbar: 50,
          properties: 50,
          reference: 40,
          preview: 40,
        },
        sectionCommit: {
          toolbarP95Ms: 240,
          propertiesP95Ms: 240,
          referenceP95Ms: 240,
          previewP95Ms: 240,
        },
        nonGridRerendersPerOutputStatusTick: {
          samples: 6,
          toolbarP95: 3,
          propertiesP95: 3,
        },
        longTask: { samples: 2, p95Ms: 240 },
        interaction: { maxInputStallMs: 1200 },
      },
    ];
    const gates = evaluateStudioShellAuditGates(scenarios, SHELL_THRESHOLDS);
    expect(gates.every((gate) => gate.pass)).toBe(false);
  });

  it("fails rendered-item gate when runtime grid metrics are unavailable", () => {
    const scenarios: ReferenceGridScenario[] = [
      {
        count: 40,
        click: { samples: 10, p95Ms: 60 },
        longTask: { samples: 3, p95Ms: 65 },
        interaction: { maxInputStallMs: 40 },
        memory: { beforeMb: null, afterMb: null },
        grid: {
          renderedItemCountP95: 20,
          imageHydrationQueueP95: null,
          imageDecodeInflightP95: null,
          perfDegradeLevelP95: null,
          previewSrcSwapRatePerMinuteP95: null,
          previewRepaintSpikeCountMax: null,
          previewLastSwapBurstCountP95: null,
        },
      },
      {
        count: 60,
        click: { samples: 10, p95Ms: 60 },
        longTask: { samples: 3, p95Ms: 80 },
        interaction: { maxInputStallMs: 50 },
        memory: { beforeMb: null, afterMb: null },
        grid: {
          renderedItemCountP95: null,
          imageHydrationQueueP95: null,
          imageDecodeInflightP95: null,
          perfDegradeLevelP95: null,
          previewSrcSwapRatePerMinuteP95: null,
          previewRepaintSpikeCountMax: null,
          previewLastSwapBurstCountP95: null,
        },
      },
    ];
    const gates = evaluateReferenceGridAuditGates(scenarios, REFERENCE_THRESHOLDS);
    const renderedGate = gates.find((gate) => gate.name === "rendered_item_count_p95_at_60");
    expect(renderedGate?.pass).toBe(false);
    expect(renderedGate?.note).toContain("metric unavailable");
  });

  it("treats missing long-task samples as pass-with-note for reference grid gates", () => {
    const scenarios: ReferenceGridScenario[] = [
      {
        count: 40,
        click: { samples: 10, p95Ms: 30 },
        longTask: { samples: 0, p95Ms: null },
        interaction: { maxInputStallMs: 20 },
        memory: { beforeMb: null, afterMb: null },
        grid: {
          renderedItemCountP95: 12,
          imageHydrationQueueP95: null,
          imageDecodeInflightP95: null,
          perfDegradeLevelP95: null,
          previewSrcSwapRatePerMinuteP95: null,
          previewRepaintSpikeCountMax: null,
          previewLastSwapBurstCountP95: null,
        },
      },
      {
        count: 60,
        click: { samples: 10, p95Ms: 40 },
        longTask: { samples: 0, p95Ms: null },
        interaction: { maxInputStallMs: 30 },
        memory: { beforeMb: null, afterMb: null },
        grid: {
          renderedItemCountP95: 20,
          imageHydrationQueueP95: null,
          imageDecodeInflightP95: null,
          perfDegradeLevelP95: null,
          previewSrcSwapRatePerMinuteP95: null,
          previewRepaintSpikeCountMax: null,
          previewLastSwapBurstCountP95: null,
        },
      },
    ];

    const gates = evaluateReferenceGridAuditGates(scenarios, REFERENCE_THRESHOLDS);
    const longTask40 = gates.find((gate) => gate.name === "grid_long_task_p95_ms_at_40");
    const longTask60 = gates.find((gate) => gate.name === "grid_long_task_p95_ms_at_60");

    expect(longTask40?.pass).toBe(true);
    expect(longTask60?.pass).toBe(true);
    expect(longTask40?.note).toContain("No long tasks observed");
  });
});
