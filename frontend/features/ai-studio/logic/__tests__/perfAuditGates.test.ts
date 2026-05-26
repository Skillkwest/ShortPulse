import { describe, expect, it } from "vitest";
import {
  evaluateReferenceGridAuditGates,
  evaluateProjectWorkspaceAutosaveTypingAuditGates,
  evaluateStudioShellAuditGates,
  type ProjectWorkspaceAutosaveTypingScenario,
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
  toolbarP95MsAt60: 150,
  panelP95MsAt60: 150,
  toolSwitchVisualCommitP95MsAt60: 180,
  longTaskP95Ms: 120,
  maxInputStallMs: 1000,
  nonGridRerendersPerOutputStatusTick: 3,
};

const PROJECT_WORKSPACE_AUTOSAVE_TYPING_THRESHOLDS = {
  standardPromptCommitP95Ms: 45,
  standardPromptBaseSnapshotBuildsP95: 1,
  standardPromptSessionSnapshotComposeCountP95: 1,
  standardPromptCandidateSelectionCountP95: 1,
  draftCommitP95Ms: 30,
  draftBaseSnapshotBuildsP95: 0,
  draftSessionSnapshotComposeCountP95: 0,
  draftCandidateSelectionCountP95: 0,
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

  it("passes project autosave typing gates when drafts trigger no project snapshot churn", () => {
    const scenarios: ProjectWorkspaceAutosaveTypingScenario[] = [
      {
        field: "standardPrompt",
        commit: { samples: 12, p95Ms: 28 },
        autosave: {
          baseSnapshotBuildsP95: 1,
          baseSnapshotBuildMsP95: 7,
          sessionSnapshotComposeCountP95: 1,
          sessionSnapshotComposeMsP95: 4,
          candidateSelectionCountP95: 1,
          candidateSelectionMsP95: 3,
        },
      },
      {
        field: "editReferenceText",
        commit: { samples: 12, p95Ms: 18 },
        autosave: {
          baseSnapshotBuildsP95: 0,
          baseSnapshotBuildMsP95: 0,
          sessionSnapshotComposeCountP95: 0,
          sessionSnapshotComposeMsP95: 0,
          candidateSelectionCountP95: 0,
          candidateSelectionMsP95: 0,
        },
      },
      {
        field: "videoReferenceText",
        commit: { samples: 12, p95Ms: 20 },
        autosave: {
          baseSnapshotBuildsP95: 0,
          baseSnapshotBuildMsP95: 0,
          sessionSnapshotComposeCountP95: 0,
          sessionSnapshotComposeMsP95: 0,
          candidateSelectionCountP95: 0,
          candidateSelectionMsP95: 0,
        },
      },
    ];

    const gates = evaluateProjectWorkspaceAutosaveTypingAuditGates(
      scenarios,
      PROJECT_WORKSPACE_AUTOSAVE_TYPING_THRESHOLDS
    );

    expect(gates.every((gate) => gate.pass)).toBe(true);
  });

  it("fails project autosave typing gates when draft edits still rebuild project snapshots", () => {
    const scenarios: ProjectWorkspaceAutosaveTypingScenario[] = [
      {
        field: "standardPrompt",
        commit: { samples: 12, p95Ms: 28 },
        autosave: {
          baseSnapshotBuildsP95: 1,
          baseSnapshotBuildMsP95: 7,
          sessionSnapshotComposeCountP95: 1,
          sessionSnapshotComposeMsP95: 4,
          candidateSelectionCountP95: 1,
          candidateSelectionMsP95: 3,
        },
      },
      {
        field: "editReferenceText",
        commit: { samples: 12, p95Ms: 18 },
        autosave: {
          baseSnapshotBuildsP95: 1,
          baseSnapshotBuildMsP95: 5,
          sessionSnapshotComposeCountP95: 1,
          sessionSnapshotComposeMsP95: 3,
          candidateSelectionCountP95: 1,
          candidateSelectionMsP95: 2,
        },
      },
      {
        field: "videoReferenceText",
        commit: { samples: 12, p95Ms: 20 },
        autosave: {
          baseSnapshotBuildsP95: 0,
          baseSnapshotBuildMsP95: 0,
          sessionSnapshotComposeCountP95: 0,
          sessionSnapshotComposeMsP95: 0,
          candidateSelectionCountP95: 0,
          candidateSelectionMsP95: 0,
        },
      },
    ];

    const gates = evaluateProjectWorkspaceAutosaveTypingAuditGates(
      scenarios,
      PROJECT_WORKSPACE_AUTOSAVE_TYPING_THRESHOLDS
    );
    const draftBuildGate = gates.find(
      (gate) => gate.name === "project_editReferenceText_base_snapshot_builds_p95"
    );

    expect(draftBuildGate?.pass).toBe(false);
  });
});
