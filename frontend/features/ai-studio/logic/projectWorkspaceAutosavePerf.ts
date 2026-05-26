/**
 * Project-workspace autosave perf counters for local typing-path audits.
 * Tracks hot-path work without changing persistence behavior.
 */
export type ProjectWorkspaceAutosavePerfPhase =
  | "baseSnapshotBuild"
  | "sessionSnapshotCompose"
  | "candidateSelection";

export type ProjectWorkspaceAutosavePerfCounters = {
  baseSnapshotBuildCount: number;
  baseSnapshotBuildMs: number;
  sessionSnapshotComposeCount: number;
  sessionSnapshotComposeMs: number;
  candidateSelectionCount: number;
  candidateSelectionMs: number;
};

const createInitialCounters = (): ProjectWorkspaceAutosavePerfCounters => ({
  baseSnapshotBuildCount: 0,
  baseSnapshotBuildMs: 0,
  sessionSnapshotComposeCount: 0,
  sessionSnapshotComposeMs: 0,
  candidateSelectionCount: 0,
  candidateSelectionMs: 0,
});

let counters = createInitialCounters();

/**
 * Records one hot-path project autosave phase sample.
 */
export const recordProjectWorkspaceAutosavePerf = (
  phase: ProjectWorkspaceAutosavePerfPhase,
  durationMs: number
) => {
  const safeDurationMs = Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0;
  switch (phase) {
    case "baseSnapshotBuild":
      counters = {
        ...counters,
        baseSnapshotBuildCount: counters.baseSnapshotBuildCount + 1,
        baseSnapshotBuildMs: counters.baseSnapshotBuildMs + safeDurationMs,
      };
      return;
    case "sessionSnapshotCompose":
      counters = {
        ...counters,
        sessionSnapshotComposeCount: counters.sessionSnapshotComposeCount + 1,
        sessionSnapshotComposeMs: counters.sessionSnapshotComposeMs + safeDurationMs,
      };
      return;
    case "candidateSelection":
      counters = {
        ...counters,
        candidateSelectionCount: counters.candidateSelectionCount + 1,
        candidateSelectionMs: counters.candidateSelectionMs + safeDurationMs,
      };
      return;
  }
};

/**
 * Returns a snapshot of current project autosave perf counters.
 */
export const getProjectWorkspaceAutosavePerfCounters =
  (): ProjectWorkspaceAutosavePerfCounters => ({
    ...counters,
  });

/**
 * Clears project autosave perf counters.
 */
export const resetProjectWorkspaceAutosavePerfCounters = () => {
  counters = createInitialCounters();
};
