import {
  createEmptyAiStudioSessionSnapshot,
  patchAiStudioSessionSnapshotCanvas,
  patchAiStudioSessionSnapshotOutputs,
  type AiStudioSessionSnapshot,
  type AiStudioSessionSnapshotV2,
} from "./sessionSnapshot";
import {
  createProjectDurableAiStudioSessionCanvasState,
  parseAiStudioSessionCanvasState,
} from "./sessionSnapshotCanvas";

const normalizeProjectRestoreOutputIds = (
  value: string[] | undefined,
  validOutputIds: Set<string>
): string[] => (value ?? []).filter((id) => validOutputIds.has(id));

export const createProjectRestoreSnapshot = (
  snapshot: AiStudioSessionSnapshot
): AiStudioSessionSnapshotV2 => {
  const emptySnapshot = createEmptyAiStudioSessionSnapshot({
    sessionId: snapshot.sessionId,
    updatedAt: snapshot.updatedAt,
  });
  const activeOutputs = Array.isArray(snapshot.outputs?.active) ? snapshot.outputs.active : [];
  const activeOutputIds = new Set(
    activeOutputs
      .map((output) => (typeof output?.id === "string" ? output.id.trim() : ""))
      .filter((id) => id.length > 0)
  );
  const outputRestoredSnapshot = patchAiStudioSessionSnapshotOutputs(emptySnapshot, {
    active: activeOutputs,
    archived: [],
    activeOutputId: null,
    curatedReferenceIds: normalizeProjectRestoreOutputIds(
      snapshot.outputs?.curatedReferenceIds,
      activeOutputIds
    ),
    removedFromAllRefsIds: normalizeProjectRestoreOutputIds(
      snapshot.outputs?.removedFromAllRefsIds,
      activeOutputIds
    ),
  });
  if (snapshot.schemaVersion < 2) return outputRestoredSnapshot;

  const parsedCanvas = parseAiStudioSessionCanvasState(
    (snapshot as AiStudioSessionSnapshotV2).canvas ?? null
  );
  const durableCanvas = createProjectDurableAiStudioSessionCanvasState(parsedCanvas);
  return durableCanvas
    ? patchAiStudioSessionSnapshotCanvas(outputRestoredSnapshot, durableCanvas)
    : outputRestoredSnapshot;
};
