/**
 * Pure snapshot analysis helpers for AI Studio project-workspace persistence.
 * Keeps autosave sizing, restore signatures, and selection logic out of the React controller.
 */
import { PROJECT_WORKSPACE_AUTOSAVE_MAX_SNAPSHOT_BYTES } from "../../../lib/ai-studio-session/projectWorkspaceLimits";
import {
  iterateAiStudioProjectWorkspaceAutosaveCandidates,
  type AiStudioProjectWorkspaceAutosaveCandidateKind,
  type AiStudioSessionSnapshot,
} from "../logic/sessionSnapshot";
import {
  prepareAiStudioSessionAutosaveSnapshot,
  utf8ByteLength,
  type PreparedAiStudioSessionAutosaveSnapshot,
} from "../logic/sessionAutosaveSerialization";
import {
  createProjectDurableAiStudioSessionCanvasState,
  parseAiStudioSessionCanvasState,
  serializeAiStudioSessionCanvasState,
} from "../logic/sessionSnapshotCanvas";
import { buildProjectWorkspaceQuickSlotDiagnostics } from "../logic/projectWorkspaceQuickSlotDiagnostics";
import { createRightRailLayoutSignature } from "../logic/rightRailLayout";
import { resolvePulseChatProjectStateSignature } from "../pulseChats/pulseChatThread";

export type ProjectSnapshotByteBreakdown = {
  totalBytes: number | null;
  workspaceBytes: number | null;
  outputsActiveBytes: number | null;
  outputsArchivedBytes: number | null;
  standardRuntimeBytes: number | null;
  pulseRuntimeBytes: number | null;
  pulseChatsBytes: number | null;
  canvasBytes: number | null;
  expertEditBytes: number | null;
};

type ProjectAutosaveSnapshotSelectionComputation = {
  selection: {
    snapshot: AiStudioSessionSnapshot | null;
    fallbackKind: AiStudioProjectWorkspaceAutosaveCandidateKind;
    preparedSnapshot: PreparedAiStudioSessionAutosaveSnapshot | null;
  };
  durationMs: number;
  reportSnapshot: AiStudioSessionSnapshot | null;
  reportFallbackKind?: AiStudioProjectWorkspaceAutosaveCandidateKind;
};

export const PROJECT_WORKSPACE_PHASE_SLOW_THRESHOLDS_MS = {
  baseSnapshotBuild: 40,
  sessionSnapshotCompose: 24,
  candidateSelection: 24,
} as const;

export const PROJECT_WORKSPACE_PHASE_TELEMETRY_THROTTLE_MS = 60_000;
export const PROJECT_WORKSPACE_QUICK_SLOT_DIAGNOSTIC_THROTTLE_MS = 5 * 60_000;

const measureSerializedBytes = (value: unknown): number | null => {
  try {
    return utf8ByteLength(JSON.stringify(value));
  } catch {
    return null;
  }
};

export const flattenProjectSnapshotByteBreakdown = (
  prefix: string,
  breakdown: ProjectSnapshotByteBreakdown
): Record<string, number> => {
  const flattened: Record<string, number> = {};
  const entries = {
    total_b: breakdown.totalBytes,
    ws_b: breakdown.workspaceBytes,
    out_active_b: breakdown.outputsActiveBytes,
    out_archived_b: breakdown.outputsArchivedBytes,
    rt_std_b: breakdown.standardRuntimeBytes,
    rt_pulse_b: breakdown.pulseRuntimeBytes,
    pulse_chats_b: breakdown.pulseChatsBytes,
    canvas_b: breakdown.canvasBytes,
    expert_b: breakdown.expertEditBytes,
  } as const;
  for (const [key, value] of Object.entries(entries)) {
    if (typeof value === "number" && Number.isFinite(value)) {
      flattened[`${prefix}_${key}`] = value;
    }
  }
  return flattened;
};

export const resolveProjectSnapshotOutputCounts = (snapshot: AiStudioSessionSnapshot | null) => {
  const activeCount = Array.isArray(snapshot?.outputs?.active) ? snapshot.outputs.active.length : 0;
  const archivedCount = Array.isArray(snapshot?.outputs?.archived)
    ? snapshot.outputs.archived.length
    : 0;
  return {
    activeCount,
    archivedCount,
    totalCount: activeCount + archivedCount,
  };
};

export const resolveQuickSlotDiagnosticsTelemetryKey = (
  diagnostics: ReturnType<typeof buildProjectWorkspaceQuickSlotDiagnostics>
): string =>
  [
    diagnostics.active_count,
    diagnostics.archived_count,
    diagnostics.quick_slot_count,
    diagnostics.removed_from_refs_count,
    diagnostics.quick_slot_missing_count,
    diagnostics.quick_slot_missing_ids,
    diagnostics.quick_slot_ids,
    diagnostics.quick_slot_library_count,
    diagnostics.quick_slot_generated_count,
    diagnostics.quick_slot_saved_media_count,
    diagnostics.quick_slot_saved_media_ids_total,
    diagnostics.canvas_item_count,
    diagnostics.canvas_media_item_count,
    diagnostics.canvas_media_id_count,
    diagnostics.canvas_output_id_count,
    diagnostics.canvas_missing_media_authority_count,
    diagnostics.canvas_url_count,
  ].join("|");

export const resolveProjectSnapshotByteBreakdown = (
  snapshot: AiStudioSessionSnapshot | null
): ProjectSnapshotByteBreakdown => {
  if (!snapshot) {
    return {
      totalBytes: null,
      workspaceBytes: null,
      outputsActiveBytes: null,
      outputsArchivedBytes: null,
      standardRuntimeBytes: null,
      pulseRuntimeBytes: null,
      pulseChatsBytes: null,
      canvasBytes: null,
      expertEditBytes: null,
    };
  }

  return {
    totalBytes: measureSerializedBytes(snapshot),
    workspaceBytes: measureSerializedBytes(snapshot.workspace ?? null),
    outputsActiveBytes: measureSerializedBytes(snapshot.outputs?.active ?? []),
    outputsArchivedBytes: measureSerializedBytes(snapshot.outputs?.archived ?? []),
    standardRuntimeBytes: measureSerializedBytes(
      "agentRuntimes" in snapshot
        ? ((
            snapshot as AiStudioSessionSnapshot & {
              agentRuntimes?: { standard?: unknown; pulse?: unknown } | null;
            }
          ).agentRuntimes?.standard ?? null)
        : null
    ),
    pulseRuntimeBytes: measureSerializedBytes(
      "agentRuntimes" in snapshot
        ? ((
            snapshot as AiStudioSessionSnapshot & {
              agentRuntimes?: { standard?: unknown; pulse?: unknown } | null;
            }
          ).agentRuntimes?.pulse ?? null)
        : null
    ),
    pulseChatsBytes: measureSerializedBytes(
      "pulseChats" in snapshot
        ? (snapshot as AiStudioSessionSnapshot & { pulseChats?: unknown }).pulseChats
        : null
    ),
    canvasBytes: measureSerializedBytes(
      "canvas" in snapshot
        ? (snapshot as AiStudioSessionSnapshot & { canvas?: unknown }).canvas
        : null
    ),
    expertEditBytes: measureSerializedBytes(
      "expertEdit" in snapshot
        ? (snapshot as AiStudioSessionSnapshot & { expertEdit?: unknown }).expertEdit
        : null
    ),
  };
};

export const collectProjectSnapshotOutputIds = (snapshot: AiStudioSessionSnapshot): string[] => {
  const seen = new Set<string>();
  const collected: string[] = [];
  const rows = [
    ...(Array.isArray(snapshot.outputs?.active) ? snapshot.outputs.active : []),
    ...(Array.isArray(snapshot.outputs?.archived) ? snapshot.outputs.archived : []),
  ];
  rows.forEach((row) => {
    const outputId = typeof row?.id === "string" ? row.id.trim() : "";
    if (!outputId || seen.has(outputId)) return;
    seen.add(outputId);
    collected.push(outputId);
  });
  return collected;
};

const resolveProjectRestoreVisibilityOutputIds = (
  snapshot: AiStudioSessionSnapshot | null
): string[] => {
  if (!snapshot) return [];
  const activeOutputIds = Array.isArray(snapshot.outputs?.active)
    ? snapshot.outputs.active
        .map((output) => (typeof output?.id === "string" ? output.id.trim() : ""))
        .filter((id): id is string => id.length > 0)
    : [];
  return [...new Set(activeOutputIds)].sort((left, right) => left.localeCompare(right));
};

const normalizeProjectSnapshotStringList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter((entry): entry is string => entry.length > 0)
    : [];

const normalizeProjectAutosaveUnlockString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const resolveProjectAutosaveUnlockOutputRows = (value: unknown) =>
  Array.isArray(value)
    ? value.map((output) => {
        const row = output as Record<string, unknown>;
        return {
          id: normalizeProjectAutosaveUnlockString(row.id),
          mode: normalizeProjectAutosaveUnlockString(row.mode),
          mediaSource: normalizeProjectAutosaveUnlockString(row.mediaSource),
          generationId: normalizeProjectAutosaveUnlockString(row.generationId),
          promptId: normalizeProjectAutosaveUnlockString(row.promptId),
          taskId: normalizeProjectAutosaveUnlockString(row.taskId),
          sourceRef: normalizeProjectAutosaveUnlockString(row.sourceRef),
          previewStoragePath: normalizeProjectAutosaveUnlockString(row.previewStoragePath),
          fullStoragePath: normalizeProjectAutosaveUnlockString(row.fullStoragePath),
          previewPosterStoragePath: normalizeProjectAutosaveUnlockString(
            row.previewPosterStoragePath
          ),
          companionArtStoragePath: normalizeProjectAutosaveUnlockString(
            row.companionArtStoragePath
          ),
          savedMediaIds: normalizeProjectSnapshotStringList(row.savedMediaIds),
          resultStoragePaths: normalizeProjectSnapshotStringList(row.resultStoragePaths),
          previewText: normalizeProjectAutosaveUnlockString(row.previewText),
          archivedAt: normalizeProjectAutosaveUnlockString(row.archivedAt),
          archiveReason: normalizeProjectAutosaveUnlockString(row.archiveReason),
        };
      })
    : [];

const asSnapshotRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const normalizeCanvasSceneItemForRestoreSignature = (item: unknown): Record<string, unknown> => {
  const record = asSnapshotRecord(item);
  const mediaId = normalizeProjectAutosaveUnlockString(record.mediaId);
  const outputId = normalizeProjectAutosaveUnlockString(record.outputId);
  const hasDurableMediaAuthority = Boolean(mediaId || outputId);
  if (!hasDurableMediaAuthority) return record;

  if (record.kind === "image") {
    return {
      ...record,
      src: null,
    };
  }
  if (record.kind === "video") {
    return {
      ...record,
      videoUrl: null,
      posterUrl: null,
    };
  }
  if (record.kind === "audio") {
    return {
      ...record,
      audioUrl: null,
      companionArtUrl: null,
    };
  }
  return record;
};

const normalizeCanvasSnapshotForRestoreSignature = (
  canvas: ReturnType<typeof serializeAiStudioSessionCanvasState>
): Record<string, unknown> => {
  const scene = asSnapshotRecord(canvas.scene);
  const items = Array.isArray(scene.items) ? scene.items : [];
  return {
    ...canvas,
    scene: {
      ...scene,
      items: items.map(normalizeCanvasSceneItemForRestoreSignature),
    },
  };
};

const resolveProjectRestoreCanvasSignature = (
  snapshot: AiStudioSessionSnapshot | null
): string | null => {
  if (!snapshot || !("canvas" in snapshot)) return null;
  const parsedCanvas = parseAiStudioSessionCanvasState(snapshot.canvas ?? null);
  const durableCanvas = createProjectDurableAiStudioSessionCanvasState(parsedCanvas);
  if (!durableCanvas) return null;
  const isDefaultEmptyCanvas =
    durableCanvas.items.length === 0 &&
    durableCanvas.mainCamera.x === 0 &&
    durableCanvas.mainCamera.y === 0 &&
    durableCanvas.mainCamera.zoom === 1 &&
    durableCanvas.railCamera.x === 0 &&
    durableCanvas.railCamera.y === 0 &&
    durableCanvas.railCamera.zoom === 1;
  if (isDefaultEmptyCanvas) return null;
  return JSON.stringify(
    normalizeCanvasSnapshotForRestoreSignature(serializeAiStudioSessionCanvasState(durableCanvas))
  );
};

export const resolveProjectAutosaveUnlockSignature = (
  snapshot: AiStudioSessionSnapshot | null
): string | null => {
  if (!snapshot) return null;
  return JSON.stringify({
    activeOutputs: resolveProjectAutosaveUnlockOutputRows(snapshot.outputs?.active),
    archivedOutputs: resolveProjectAutosaveUnlockOutputRows(snapshot.outputs?.archived),
    curatedReferenceIds: normalizeProjectSnapshotStringList(snapshot.outputs?.curatedReferenceIds),
    removedFromAllRefsIds: normalizeProjectSnapshotStringList(
      snapshot.outputs?.removedFromAllRefsIds
    ),
    canvasSignature: resolveProjectRestoreCanvasSignature(snapshot),
    rightRailLayoutSignature: createRightRailLayoutSignature(snapshot.workspace?.rightRailLayout),
    pulseChats:
      snapshot.schemaVersion >= 2
        ? resolvePulseChatProjectStateSignature(
            (snapshot as AiStudioSessionSnapshot & { pulseChats?: unknown }).pulseChats ?? null
          )
        : null,
  });
};

export const resolveProjectRestoreVisibilitySignature = (
  snapshot: AiStudioSessionSnapshot | null
): string => {
  const activeOutputIds = resolveProjectRestoreVisibilityOutputIds(snapshot);
  const curatedReferenceIds = normalizeProjectSnapshotStringList(
    snapshot?.outputs?.curatedReferenceIds
  );
  const removedFromAllRefsIds = normalizeProjectSnapshotStringList(
    snapshot?.outputs?.removedFromAllRefsIds
  );
  const canvasSignature = resolveProjectRestoreCanvasSignature(snapshot);
  const rightRailLayoutSignature = createRightRailLayoutSignature(
    snapshot?.workspace?.rightRailLayout
  );
  return JSON.stringify({
    activeOutputIds,
    curatedReferenceIds,
    removedFromAllRefsIds,
    canvasSignature,
    rightRailLayoutSignature,
  });
};

export const areStringListsEqual = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

export const resolveReducedWorkspaceNotice = (
  fallbackKind: Exclude<AiStudioProjectWorkspaceAutosaveCandidateKind, "full">
): string => {
  if (fallbackKind.includes("lightweight_checkpoint")) {
    return "Project autosave saved a lightweight workspace checkpoint to stay within size limits.";
  }
  if (fallbackKind.includes("canvas")) {
    return "Project autosave saved a reduced workspace snapshot to stay within size limits. Canvas layout or edit overlays may need to be rebuilt.";
  }
  return "Project autosave saved a reduced workspace snapshot to stay within size limits.";
};

export const resolveProjectRepairPendingNotice = (): string =>
  "Project autosave saved the workspace, but project asset repair is pending. Recent outputs may not fully restore until the next successful save.";

export const resolvePerfNow = (): number =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

export const resolveProjectAutosaveSnapshotSelectionComputation = (
  sessionSnapshot: AiStudioSessionSnapshot | null
): ProjectAutosaveSnapshotSelectionComputation => {
  const startedAt = resolvePerfNow();
  if (!sessionSnapshot) {
    return {
      selection: {
        snapshot: null,
        fallbackKind: "full",
        preparedSnapshot: null,
      },
      durationMs: resolvePerfNow() - startedAt,
      reportSnapshot: null,
      reportFallbackKind: undefined,
    };
  }
  let fullPreparedSnapshot: PreparedAiStudioSessionAutosaveSnapshot | null = null;
  for (const candidate of iterateAiStudioProjectWorkspaceAutosaveCandidates(sessionSnapshot)) {
    const preparedSnapshot = prepareAiStudioSessionAutosaveSnapshot(candidate.snapshot, {
      includeSerializedJson: true,
      title: null,
    });
    if (candidate.kind === "full") {
      fullPreparedSnapshot = preparedSnapshot;
    }
    if (
      preparedSnapshot.hash &&
      Number.isFinite(preparedSnapshot.bytes) &&
      preparedSnapshot.bytes <= PROJECT_WORKSPACE_AUTOSAVE_MAX_SNAPSHOT_BYTES
    ) {
      return {
        selection: {
          snapshot: candidate.snapshot,
          fallbackKind: candidate.kind,
          preparedSnapshot,
        },
        durationMs: resolvePerfNow() - startedAt,
        reportSnapshot: candidate.snapshot,
        reportFallbackKind: candidate.kind,
      };
    }
  }
  return {
    selection: {
      snapshot: sessionSnapshot,
      fallbackKind: "full",
      preparedSnapshot:
        fullPreparedSnapshot ??
        prepareAiStudioSessionAutosaveSnapshot(sessionSnapshot, {
          includeSerializedJson: true,
          title: null,
        }),
    },
    durationMs: resolvePerfNow() - startedAt,
    reportSnapshot: sessionSnapshot,
    reportFallbackKind: "full",
  };
};
