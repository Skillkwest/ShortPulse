import { describe, expect, it } from "vitest";
import {
  getProjectWorkspaceAutosavePerfCounters,
  recordProjectWorkspaceAutosavePerf,
  resetProjectWorkspaceAutosavePerfCounters,
} from "../projectWorkspaceAutosavePerf";

describe("projectWorkspaceAutosavePerf", () => {
  it("records and resets hot-path counters", () => {
    resetProjectWorkspaceAutosavePerfCounters();

    recordProjectWorkspaceAutosavePerf("baseSnapshotBuild", 4);
    recordProjectWorkspaceAutosavePerf("baseSnapshotBuild", 6);
    recordProjectWorkspaceAutosavePerf("sessionSnapshotCompose", 3);
    recordProjectWorkspaceAutosavePerf("candidateSelection", 2);

    expect(getProjectWorkspaceAutosavePerfCounters()).toEqual({
      baseSnapshotBuildCount: 2,
      baseSnapshotBuildMs: 10,
      sessionSnapshotComposeCount: 1,
      sessionSnapshotComposeMs: 3,
      candidateSelectionCount: 1,
      candidateSelectionMs: 2,
    });

    resetProjectWorkspaceAutosavePerfCounters();

    expect(getProjectWorkspaceAutosavePerfCounters()).toEqual({
      baseSnapshotBuildCount: 0,
      baseSnapshotBuildMs: 0,
      sessionSnapshotComposeCount: 0,
      sessionSnapshotComposeMs: 0,
      candidateSelectionCount: 0,
      candidateSelectionMs: 0,
    });
  });
});
