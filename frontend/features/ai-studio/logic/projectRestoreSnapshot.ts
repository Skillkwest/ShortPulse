import {
  createEmptyAiStudioSessionSnapshot,
  patchAiStudioSessionSnapshotCanvas,
  patchAiStudioSessionSnapshotOutputs,
  patchAiStudioSessionSnapshotWorkspace,
  patchAiStudioSessionSnapshotPulseChats,
  type AiStudioSessionSnapshot,
  type AiStudioSessionSnapshotV2,
} from "./sessionSnapshot";
import {
  createProjectDurableAiStudioSessionCanvasState,
  parseAiStudioSessionCanvasState,
} from "./sessionSnapshotCanvas";
import { sanitizeRightRailLayoutSnapshot } from "./rightRailLayout";
import { createAiStudioProjectWorkspaceSnapshot } from "../../../lib/ai-studio-session/projectWorkspaceSnapshot";

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
  const archivedOutputs = Array.isArray(snapshot.outputs?.archived)
    ? snapshot.outputs.archived
    : [];
  const activeOutputIds = new Set(
    activeOutputs
      .map((output) => (typeof output?.id === "string" ? output.id.trim() : ""))
      .filter((id) => id.length > 0)
  );
  const persistedOutputIds = new Set([
    ...activeOutputIds,
    ...archivedOutputs
      .map((output) => (typeof output?.id === "string" ? output.id.trim() : ""))
      .filter((id) => id.length > 0),
  ]);
  const outputRestoredSnapshot = patchAiStudioSessionSnapshotOutputs(emptySnapshot, {
    active: activeOutputs,
    archived: archivedOutputs,
    activeOutputId: null,
    curatedReferenceIds: normalizeProjectRestoreOutputIds(
      snapshot.outputs?.curatedReferenceIds,
      activeOutputIds
    ),
    removedFromAllRefsIds: normalizeProjectRestoreOutputIds(
      snapshot.outputs?.removedFromAllRefsIds,
      persistedOutputIds
    ),
  });
  if (snapshot.schemaVersion < 2) return outputRestoredSnapshot;
  const snapshotV2 = snapshot as AiStudioSessionSnapshotV2;
  const workspaceRestoredSnapshot = patchAiStudioSessionSnapshotWorkspace(outputRestoredSnapshot, {
    rightRailLayout: sanitizeRightRailLayoutSnapshot(snapshotV2.workspace.rightRailLayout),
  });
  const pulseChats = "pulseChats" in snapshot ? snapshotV2.pulseChats : undefined;

  const parsedCanvas = parseAiStudioSessionCanvasState(snapshotV2.canvas ?? null);
  const durableCanvas = createProjectDurableAiStudioSessionCanvasState(parsedCanvas);
  const canvasRestoredSnapshot = durableCanvas
    ? patchAiStudioSessionSnapshotCanvas(workspaceRestoredSnapshot, durableCanvas)
    : workspaceRestoredSnapshot;
  return pulseChats !== undefined
    ? patchAiStudioSessionSnapshotPulseChats(canvasRestoredSnapshot, pulseChats)
    : canvasRestoredSnapshot;
};

export const createProjectRestoreVisibilitySnapshot = (
  snapshot: AiStudioSessionSnapshot
): AiStudioSessionSnapshotV2 => {
  const restoredSnapshot = createProjectRestoreSnapshot(snapshot);
  const canonicalProjectSnapshot = createAiStudioProjectWorkspaceSnapshot(
    restoredSnapshot
  ) as AiStudioSessionSnapshotV2;
  const restoredCanvasState = parseAiStudioSessionCanvasState(restoredSnapshot.canvas ?? null);

  return patchAiStudioSessionSnapshotCanvas(canonicalProjectSnapshot, restoredCanvasState);
};
