/**
 * AI Studio project-workspace persistence controller.
 * Orchestrates project-owned restore/apply and debounced autosave against project workspace authority.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addBreadcrumb } from "../../../lib/clientBreadcrumbs";
import {
  createAiStudioProjectWorkspaceAutosaveCandidates,
  type AiStudioProjectWorkspaceAutosaveCandidateKind,
  type AiStudioSessionSnapshot,
} from "../logic/sessionSnapshot";
import type { AiStudioSessionHydrationPayload } from "../logic/sessionSnapshotHydrator";
import {
  resetAiStudioProjectWorkspaceSnapshotViaApi,
  saveAiStudioProjectWorkspaceSnapshotViaApi,
} from "../logic/projectWorkspaceApiClient";
import {
  useAiStudioSessionAutosave,
  type AiStudioSessionAutosaveError,
} from "./useAiStudioSessionAutosave";
import { useAiStudioProjectWorkspaceRestoreCandidate } from "./useAiStudioProjectWorkspaceRestoreCandidate";
import { useAiStudioProjectWorkspaceRestoreHydration } from "./useAiStudioProjectWorkspaceRestoreHydration";
import { resetAiStudioOutputStore } from "./aiStudioOutputStore";
import {
  AI_STUDIO_SESSION_MAX_SNAPSHOT_BYTES,
  createProjectDurableAiStudioSessionCanvasState,
  parseAiStudioSessionCanvasState,
  serializeAiStudioSessionCanvasState,
  type AiStudioSessionCanvasState,
} from "../logic/sessionSnapshotCanvas";
import {
  prepareAiStudioSessionAutosaveSnapshot,
  utf8ByteLength,
  type PreparedAiStudioSessionAutosaveSnapshot,
} from "../logic/sessionAutosaveSerialization";
import { createProjectRestoreSnapshot } from "../logic/projectRestoreSnapshot";
import { recordProjectWorkspaceAutosavePerf } from "../logic/projectWorkspaceAutosavePerf";
import type { AiStudioPersistenceController } from "./aiStudioPersistenceControllerContract";

type UseAiStudioProjectWorkspacePersistenceControllerParams = {
  projectId: string | null;
  projectRouteRequested?: boolean;
  sessionId: string | null;
  buildBaseSessionSnapshot: (sessionId: string) => AiStudioSessionSnapshot;
  patchSessionSnapshot?: (snapshot: AiStudioSessionSnapshot) => AiStudioSessionSnapshot;
  hydrateFromSessionSnapshot: (
    snapshot: AiStudioSessionSnapshot
  ) => AiStudioSessionHydrationPayload;
  hydrateFromSessionAgentSnapshot?: (
    payload: Pick<AiStudioSessionHydrationPayload, "workspace" | "agent" | "agentRuntimes">
  ) => void;
  hydrateFromSessionCanvasSnapshot?: (canvas: AiStudioSessionCanvasState | null) => void;
  applyEmptyProjectState?: () => void;
  resetProjectAgentConversation?: () => void;
  onPersistenceWarning?: (message: string) => void;
};

const resolveProjectPersistenceWarningMessage = ({
  reason,
  snapshotBytes,
  maxSnapshotBytes,
  error,
  willRetry,
}: {
  reason: "snapshot_too_large" | "snapshot_serialize_failed" | "persist_failed";
  snapshotBytes?: number;
  maxSnapshotBytes: number;
  error: Error;
  willRetry?: boolean;
}): string => {
  switch (reason) {
    case "snapshot_too_large": {
      const currentKb = typeof snapshotBytes === "number" ? Math.ceil(snapshotBytes / 1024) : null;
      const limitKb = Math.ceil(maxSnapshotBytes / 1024);
      if (currentKb == null) {
        return `Project autosave skipped because workspace size exceeded the ${limitKb}KB limit.`;
      }
      return `Project autosave skipped because workspace size (${currentKb}KB) exceeded the ${limitKb}KB limit.`;
    }
    case "snapshot_serialize_failed":
      return "Project autosave skipped because workspace serialization failed.";
    case "persist_failed":
    default:
      if (willRetry === false) {
        return `Project autosave paused after repeated failures: ${error.message}`;
      }
      return `Project autosave is retrying in the background: ${error.message}`;
  }
};

const measureSerializedBytes = (value: unknown): number | null => {
  try {
    return utf8ByteLength(JSON.stringify(value));
  } catch {
    return null;
  }
};

type ProjectSnapshotByteBreakdown = {
  totalBytes: number | null;
  workspaceBytes: number | null;
  outputsActiveBytes: number | null;
  outputsArchivedBytes: number | null;
  standardRuntimeBytes: number | null;
  pulseRuntimeBytes: number | null;
  canvasBytes: number | null;
  expertEditBytes: number | null;
};

const PROJECT_WORKSPACE_PHASE_SLOW_THRESHOLDS_MS = {
  baseSnapshotBuild: 40,
  sessionSnapshotCompose: 24,
  candidateSelection: 24,
} as const;
const PROJECT_WORKSPACE_PHASE_TELEMETRY_THROTTLE_MS = 60_000;

const flattenProjectSnapshotByteBreakdown = (
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

const resolveProjectSnapshotOutputCounts = (snapshot: AiStudioSessionSnapshot | null) => {
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

const resolveProjectSnapshotByteBreakdown = (
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

const collectProjectSnapshotOutputIds = (snapshot: AiStudioSessionSnapshot): string[] => {
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

const resolveProjectRestoreCanvasSignature = (
  snapshot: AiStudioSessionSnapshot | null
): string | null => {
  if (!snapshot || !("canvas" in snapshot)) return null;
  const parsedCanvas = parseAiStudioSessionCanvasState(snapshot.canvas ?? null);
  const durableCanvas = createProjectDurableAiStudioSessionCanvasState(parsedCanvas);
  if (!durableCanvas) return null;
  return JSON.stringify(serializeAiStudioSessionCanvasState(durableCanvas));
};

const resolveProjectRestoreVisibilitySignature = (
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
  return JSON.stringify({
    activeOutputIds,
    curatedReferenceIds,
    removedFromAllRefsIds,
    canvasSignature,
  });
};

const areStringListsEqual = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const resolveReducedWorkspaceNotice = (
  fallbackKind: Exclude<AiStudioProjectWorkspaceAutosaveCandidateKind, "full">
): string => {
  if (fallbackKind.includes("archived_outputs")) {
    return "Project autosave saved a reduced workspace snapshot to stay within size limits. Archived outputs may not fully restore.";
  }
  if (fallbackKind.includes("canvas")) {
    return "Project autosave saved a reduced workspace snapshot to stay within size limits. Canvas layout or edit overlays may need to be rebuilt.";
  }
  return "Project autosave saved a reduced workspace snapshot to stay within size limits.";
};

const resolveProjectRepairPendingNotice = (): string =>
  "Project autosave saved the workspace, but project asset repair is pending. Recent outputs may not fully restore until the next successful save.";

const resolvePerfNow = (): number =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

/**
 * Returns project-owned persistence wiring for AI Studio page orchestration.
 */
export const useAiStudioProjectWorkspacePersistenceController = ({
  projectId,
  projectRouteRequested = false,
  sessionId,
  buildBaseSessionSnapshot,
  patchSessionSnapshot,
  hydrateFromSessionSnapshot,
  hydrateFromSessionAgentSnapshot,
  hydrateFromSessionCanvasSnapshot,
  applyEmptyProjectState,
  resetProjectAgentConversation,
  onPersistenceWarning,
}: UseAiStudioProjectWorkspacePersistenceControllerParams): AiStudioPersistenceController => {
  const [bootstrappedProject, setBootstrappedProject] = useState<{
    projectId: string;
    revision: number;
  } | null>(null);
  const [bootstrapVisibilityApplied, setBootstrapVisibilityApplied] = useState<{
    projectId: string;
    revision: number;
    restoreVisibilitySignature: string;
  } | null>(null);
  const [bootstrapError, setBootstrapError] = useState<{
    projectId: string;
    revision: number;
    message: string;
  } | null>(null);
  const projectRuntimeAuthority = projectRouteRequested
    ? projectId
      ? `project:${projectId}`
      : "project:pending"
    : null;
  const [runtimeAuthorityState, setRuntimeAuthorityState] = useState<{
    authority: string | null;
    revision: number;
  }>(() => ({
    authority: projectRuntimeAuthority,
    revision: 0,
  }));
  const projectRuntimeRevision =
    runtimeAuthorityState.authority === projectRuntimeAuthority
      ? runtimeAuthorityState.revision
      : runtimeAuthorityState.revision + 1;
  if (runtimeAuthorityState.authority !== projectRuntimeAuthority) {
    setRuntimeAuthorityState({
      authority: projectRuntimeAuthority,
      revision: projectRuntimeRevision,
    });
  }
  const invalidatedRevisionRef = useRef<number | null>(null);
  const sessionRestoreCandidate = useAiStudioProjectWorkspaceRestoreCandidate({
    projectId,
    enabled: Boolean(projectId),
  });
  const projectBootstrapSettled =
    Boolean(projectId) &&
    sessionRestoreCandidate.status === "ready" &&
    bootstrappedProject?.projectId === projectId &&
    bootstrappedProject.revision === projectRuntimeRevision;
  const snapshotByteBreakdownCacheRef = useRef<WeakMap<object, ProjectSnapshotByteBreakdown>>(
    new WeakMap()
  );
  const slowPhaseTelemetryRef = useRef<
    Partial<Record<keyof typeof PROJECT_WORKSPACE_PHASE_SLOW_THRESHOLDS_MS, number>>
  >({});
  const resolveCachedSnapshotByteBreakdown = useCallback(
    (snapshot: AiStudioSessionSnapshot | null): ProjectSnapshotByteBreakdown => {
      if (!snapshot) {
        return resolveProjectSnapshotByteBreakdown(null);
      }
      const cached = snapshotByteBreakdownCacheRef.current.get(snapshot as object);
      if (cached) return cached;
      const measured = resolveProjectSnapshotByteBreakdown(snapshot);
      snapshotByteBreakdownCacheRef.current.set(snapshot as object, measured);
      return measured;
    },
    []
  );
  const maybeReportSlowProjectWorkspacePhase = useCallback(
    ({
      phase,
      durationMs,
      snapshot,
      fallbackKind,
    }: {
      phase: keyof typeof PROJECT_WORKSPACE_PHASE_SLOW_THRESHOLDS_MS;
      durationMs: number;
      snapshot: AiStudioSessionSnapshot | null;
      fallbackKind?: AiStudioProjectWorkspaceAutosaveCandidateKind;
    }) => {
      if (!projectId || !projectBootstrapSettled) return;
      if (!Number.isFinite(durationMs)) return;
      const thresholdMs = PROJECT_WORKSPACE_PHASE_SLOW_THRESHOLDS_MS[phase];
      if (durationMs < thresholdMs) return;
      const now = Date.now();
      const lastEmittedAt = slowPhaseTelemetryRef.current[phase] ?? 0;
      if (now - lastEmittedAt < PROJECT_WORKSPACE_PHASE_TELEMETRY_THROTTLE_MS) return;
      slowPhaseTelemetryRef.current[phase] = now;
      const breakdown = resolveCachedSnapshotByteBreakdown(snapshot);
      const counts = resolveProjectSnapshotOutputCounts(snapshot);
      addBreadcrumb({
        type: "ui",
        level: durationMs >= thresholdMs * 2 ? "warn" : "info",
        message: "ai_studio_project_workspace_autosave_phase_slow",
        data: {
          project_id: projectId,
          phase,
          duration_ms: Math.round(durationMs * 100) / 100,
          fallback_kind: fallbackKind ?? null,
          active_outputs: counts.activeCount,
          archived_outputs: counts.archivedCount,
          total_outputs: counts.totalCount,
          ...flattenProjectSnapshotByteBreakdown("snap", breakdown),
        },
      });
    },
    [projectBootstrapSettled, projectId, resolveCachedSnapshotByteBreakdown]
  );
  const baseSessionSnapshotComputation = useMemo(() => {
    if (!sessionId || !projectBootstrapSettled) {
      return {
        snapshot: null as AiStudioSessionSnapshot | null,
        durationMs: null as number | null,
      };
    }
    const startedAt = resolvePerfNow();
    const nextSnapshot = buildBaseSessionSnapshot(sessionId);
    return {
      snapshot: nextSnapshot,
      durationMs: resolvePerfNow() - startedAt,
    };
  }, [buildBaseSessionSnapshot, projectBootstrapSettled, sessionId]);
  const baseSessionSnapshot = baseSessionSnapshotComputation.snapshot;

  useEffect(() => {
    if (baseSessionSnapshotComputation.durationMs == null) return;
    recordProjectWorkspaceAutosavePerf(
      "baseSnapshotBuild",
      baseSessionSnapshotComputation.durationMs
    );
    maybeReportSlowProjectWorkspacePhase({
      phase: "baseSnapshotBuild",
      durationMs: baseSessionSnapshotComputation.durationMs,
      snapshot: baseSessionSnapshotComputation.snapshot,
    });
  }, [baseSessionSnapshotComputation, maybeReportSlowProjectWorkspacePhase]);

  const sessionSnapshotComputation = useMemo(() => {
    if (!baseSessionSnapshot) {
      return {
        snapshot: baseSessionSnapshot,
        durationMs: null as number | null,
      };
    }
    const startedAt = resolvePerfNow();
    const nextSnapshot = patchSessionSnapshot
      ? patchSessionSnapshot(baseSessionSnapshot)
      : baseSessionSnapshot;
    return {
      snapshot: nextSnapshot,
      durationMs: resolvePerfNow() - startedAt,
    };
  }, [baseSessionSnapshot, patchSessionSnapshot]);
  const sessionSnapshot = sessionSnapshotComputation.snapshot;

  useEffect(() => {
    if (sessionSnapshotComputation.durationMs == null) return;
    recordProjectWorkspaceAutosavePerf(
      "sessionSnapshotCompose",
      sessionSnapshotComputation.durationMs
    );
    maybeReportSlowProjectWorkspacePhase({
      phase: "sessionSnapshotCompose",
      durationMs: sessionSnapshotComputation.durationMs,
      snapshot: sessionSnapshotComputation.snapshot,
    });
  }, [maybeReportSlowProjectWorkspacePhase, sessionSnapshotComputation]);

  const expectedProjectRestoreVisibilitySignature = useMemo(
    () =>
      projectBootstrapSettled
        ? resolveProjectRestoreVisibilitySignature(
            sessionRestoreCandidate.snapshot
              ? createProjectRestoreSnapshot(sessionRestoreCandidate.snapshot)
              : null
          )
        : null,
    [projectBootstrapSettled, sessionRestoreCandidate.snapshot]
  );
  const actualProjectRestoreVisibilitySignature = useMemo(
    () =>
      projectBootstrapSettled ? resolveProjectRestoreVisibilitySignature(sessionSnapshot) : null,
    [projectBootstrapSettled, sessionSnapshot]
  );
  const activeBootstrapVisibilityApplied =
    bootstrapVisibilityApplied?.projectId === projectId &&
    bootstrapVisibilityApplied.revision === projectRuntimeRevision &&
    bootstrapVisibilityApplied.restoreVisibilitySignature ===
      expectedProjectRestoreVisibilitySignature;
  useEffect(() => {
    if (!projectId || !projectBootstrapSettled) return;
    if (!expectedProjectRestoreVisibilitySignature) return;
    if (expectedProjectRestoreVisibilitySignature !== actualProjectRestoreVisibilitySignature)
      return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setBootstrapVisibilityApplied((current) => {
        if (
          current?.projectId === projectId &&
          current.revision === projectRuntimeRevision &&
          current.restoreVisibilitySignature === expectedProjectRestoreVisibilitySignature
        ) {
          return current;
        }
        return {
          projectId,
          revision: projectRuntimeRevision,
          restoreVisibilitySignature: expectedProjectRestoreVisibilitySignature,
        };
      });
    });
    return () => {
      cancelled = true;
    };
  }, [
    actualProjectRestoreVisibilitySignature,
    expectedProjectRestoreVisibilitySignature,
    projectBootstrapSettled,
    projectId,
    projectRuntimeRevision,
  ]);
  const projectBootstrapReady = projectBootstrapSettled && activeBootstrapVisibilityApplied;

  const reducedSnapshotNoticeKeyRef = useRef<string | null>(null);
  const repairPendingNoticeKeyRef = useRef<string | null>(null);
  const autosaveSnapshotSelectionComputation = (() => {
    const startedAt = resolvePerfNow();
    if (!sessionSnapshot) {
      return {
        selection: {
          snapshot: null as AiStudioSessionSnapshot | null,
          fallbackKind: "full" as AiStudioProjectWorkspaceAutosaveCandidateKind,
          preparedSnapshot: null as PreparedAiStudioSessionAutosaveSnapshot | null,
        },
        durationMs: resolvePerfNow() - startedAt,
        reportSnapshot: null as AiStudioSessionSnapshot | null,
        reportFallbackKind: undefined as AiStudioProjectWorkspaceAutosaveCandidateKind | undefined,
      };
    }
    let fullPreparedSnapshot: PreparedAiStudioSessionAutosaveSnapshot | null = null;
    for (const candidate of createAiStudioProjectWorkspaceAutosaveCandidates(sessionSnapshot)) {
      const preparedSnapshot = prepareAiStudioSessionAutosaveSnapshot(candidate.snapshot, {
        title: null,
      });
      if (candidate.kind === "full") {
        fullPreparedSnapshot = preparedSnapshot;
      }
      if (
        preparedSnapshot.hash &&
        Number.isFinite(preparedSnapshot.bytes) &&
        preparedSnapshot.bytes <= AI_STUDIO_SESSION_MAX_SNAPSHOT_BYTES
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
        fallbackKind: "full" as AiStudioProjectWorkspaceAutosaveCandidateKind,
        preparedSnapshot:
          fullPreparedSnapshot ??
          prepareAiStudioSessionAutosaveSnapshot(sessionSnapshot, {
            title: null,
          }),
      },
      durationMs: resolvePerfNow() - startedAt,
      reportSnapshot: sessionSnapshot,
      reportFallbackKind: "full" as AiStudioProjectWorkspaceAutosaveCandidateKind,
    };
  })();
  const autosaveSnapshotSelection = autosaveSnapshotSelectionComputation.selection;

  useEffect(() => {
    recordProjectWorkspaceAutosavePerf(
      "candidateSelection",
      autosaveSnapshotSelectionComputation.durationMs
    );
    maybeReportSlowProjectWorkspacePhase({
      phase: "candidateSelection",
      durationMs: autosaveSnapshotSelectionComputation.durationMs,
      snapshot: autosaveSnapshotSelectionComputation.reportSnapshot,
      fallbackKind: autosaveSnapshotSelectionComputation.reportFallbackKind,
    });
  }, [autosaveSnapshotSelectionComputation, maybeReportSlowProjectWorkspacePhase]);

  useEffect(() => {
    if (!projectRuntimeAuthority) {
      invalidatedRevisionRef.current = null;
      return;
    }
    if (invalidatedRevisionRef.current === projectRuntimeRevision) return;
    invalidatedRevisionRef.current = projectRuntimeRevision;
    // Fail closed for decoupled selector-store surfaces before async restore finishes.
    resetAiStudioOutputStore();
    applyEmptyProjectState?.();
  }, [applyEmptyProjectState, projectRuntimeAuthority, projectRuntimeRevision]);

  useEffect(() => {
    if (!projectId || autosaveSnapshotSelection.fallbackKind === "full") return;
    const noticeKey = [
      projectId,
      sessionSnapshot?.updatedAt ?? "none",
      autosaveSnapshotSelection.fallbackKind,
    ].join("|");
    if (reducedSnapshotNoticeKeyRef.current === noticeKey) return;
    reducedSnapshotNoticeKeyRef.current = noticeKey;
    const fullSnapshotByteBreakdown = resolveCachedSnapshotByteBreakdown(sessionSnapshot);
    const reducedSnapshotByteBreakdown = resolveCachedSnapshotByteBreakdown(
      autosaveSnapshotSelection.snapshot
    );
    addBreadcrumb({
      type: "ui",
      level: "info",
      message: "ai_studio_project_workspace_snapshot_reduced_for_size",
      data: {
        project_id: projectId,
        fallback_kind: autosaveSnapshotSelection.fallbackKind,
        snapshot_updated_at: sessionSnapshot?.updatedAt ?? null,
        full_snapshot_bytes: fullSnapshotByteBreakdown.totalBytes,
        reduced_snapshot_bytes: reducedSnapshotByteBreakdown.totalBytes,
        ...flattenProjectSnapshotByteBreakdown("full", fullSnapshotByteBreakdown),
        ...flattenProjectSnapshotByteBreakdown("reduced", reducedSnapshotByteBreakdown),
      },
    });
    onPersistenceWarning?.(
      resolveReducedWorkspaceNotice(
        autosaveSnapshotSelection.fallbackKind as Exclude<
          AiStudioProjectWorkspaceAutosaveCandidateKind,
          "full"
        >
      )
    );
  }, [
    autosaveSnapshotSelection.fallbackKind,
    onPersistenceWarning,
    projectId,
    resolveCachedSnapshotByteBreakdown,
    autosaveSnapshotSelection.snapshot,
    sessionSnapshot?.updatedAt,
    sessionSnapshot,
  ]);

  const handleProjectBootstrapSettled = useCallback(
    (activeProjectId: string) => {
      addBreadcrumb({
        type: "ui",
        level: "info",
        message: "ai_studio_project_workspace_bootstrap_settled",
        data: {
          project_id: activeProjectId,
          runtime_revision: projectRuntimeRevision,
        },
      });
      setBootstrappedProject({
        projectId: activeProjectId,
        revision: projectRuntimeRevision,
      });
    },
    [projectRuntimeRevision]
  );

  const handleProjectBootstrapFailed = useCallback(
    (activeProjectId: string, error: Error) => {
      const message = error.message || "Failed to apply project workspace.";
      addBreadcrumb({
        type: "ui",
        level: "warn",
        message: "ai_studio_project_workspace_bootstrap_failed",
        data: {
          project_id: activeProjectId,
          runtime_revision: projectRuntimeRevision,
          error: message,
        },
      });
      setBootstrapError((current) => {
        if (
          current?.projectId === activeProjectId &&
          current.revision === projectRuntimeRevision &&
          current.message === message
        ) {
          return current;
        }
        return {
          projectId: activeProjectId,
          revision: projectRuntimeRevision,
          message,
        };
      });
    },
    [projectRuntimeRevision]
  );

  useAiStudioProjectWorkspaceRestoreHydration({
    projectId,
    projectWorkspaceRestoreCandidate: sessionRestoreCandidate,
    hydrateFromSessionSnapshot,
    hydrateFromSessionAgentSnapshot,
    hydrateFromSessionCanvasSnapshot,
    applyEmptyProjectState,
    resetProjectAgentConversation,
    onProjectBootstrapSettled: handleProjectBootstrapSettled,
    onProjectBootstrapFailed: handleProjectBootstrapFailed,
  });

  const persistProjectWorkspaceSnapshot = useCallback(
    async (
      activeProjectId: string,
      snapshot: AiStudioSessionSnapshot,
      options?: { keepalive?: boolean }
    ) => {
      const savedWorkspace = await saveAiStudioProjectWorkspaceSnapshotViaApi({
        projectId: activeProjectId,
        snapshot,
        keepalive: options?.keepalive,
      });
      const localOutputIds = collectProjectSnapshotOutputIds(snapshot);
      const savedSnapshot =
        savedWorkspace.snapshot && typeof savedWorkspace.snapshot === "object"
          ? (savedWorkspace.snapshot as AiStudioSessionSnapshot)
          : null;
      const savedOutputIds = savedSnapshot ? collectProjectSnapshotOutputIds(savedSnapshot) : [];
      if (savedSnapshot && !areStringListsEqual(localOutputIds, savedOutputIds)) {
        addBreadcrumb({
          type: "ui",
          level: "info",
          message: "ai_studio_project_workspace_save_canonicalized",
          data: {
            project_id: activeProjectId,
            local_output_count: localOutputIds.length,
            saved_output_count: savedOutputIds.length,
            local_output_ids: localOutputIds,
            saved_output_ids: savedOutputIds,
            keepalive: options?.keepalive === true,
          },
        });
      }
      if (savedWorkspace.saveOutcome?.status === "saved_with_repair_pending") {
        const noticeKey = [
          activeProjectId,
          snapshot.updatedAt,
          savedWorkspace.saveOutcome.repairStage ?? "repair_pending",
          savedWorkspace.saveOutcome.repairMessage ?? "",
        ].join("|");
        if (repairPendingNoticeKeyRef.current !== noticeKey) {
          repairPendingNoticeKeyRef.current = noticeKey;
          onPersistenceWarning?.(resolveProjectRepairPendingNotice());
        }
      }
    },
    [onPersistenceWarning]
  );

  const writeProjectWorkspaceSnapshot = useCallback(
    (
      activeProjectId: string,
      snapshot: AiStudioSessionSnapshot,
      options?: { keepalive?: boolean }
    ) =>
      persistProjectWorkspaceSnapshot(activeProjectId, snapshot, {
        keepalive: options?.keepalive,
      }),
    [persistProjectWorkspaceSnapshot]
  );

  const resolveProjectSnapshotTitle = useCallback(() => null, []);

  const handleProjectPersistError = useCallback(
    (error: Error, details: AiStudioSessionAutosaveError) => {
      if (
        projectId &&
        (details.reason === "snapshot_too_large" || details.reason === "persist_failed")
      ) {
        const fullSnapshotByteBreakdown = resolveCachedSnapshotByteBreakdown(sessionSnapshot);
        const selectedSnapshotByteBreakdown = resolveCachedSnapshotByteBreakdown(
          autosaveSnapshotSelection.snapshot
        );
        addBreadcrumb({
          type: "ui",
          level: details.reason === "snapshot_too_large" ? "warn" : "info",
          message: "ai_studio_project_workspace_autosave_measurement",
          data: {
            project_id: projectId,
            reason: details.reason,
            keepalive: details.keepalive === true,
            snapshot_bytes: details.snapshotBytes ?? selectedSnapshotByteBreakdown.totalBytes,
            max_snapshot_bytes: details.maxSnapshotBytes,
            fallback_kind: autosaveSnapshotSelection.fallbackKind,
            ...flattenProjectSnapshotByteBreakdown("full", fullSnapshotByteBreakdown),
            ...flattenProjectSnapshotByteBreakdown("selected", selectedSnapshotByteBreakdown),
            will_retry: details.willRetry ?? null,
            attempt: details.attempt ?? null,
          },
        });
      }
      onPersistenceWarning?.(
        resolveProjectPersistenceWarningMessage({
          reason: details.reason,
          snapshotBytes: details.snapshotBytes,
          maxSnapshotBytes: details.maxSnapshotBytes,
          error,
          willRetry: details.willRetry,
        })
      );
    },
    [
      autosaveSnapshotSelection.fallbackKind,
      autosaveSnapshotSelection.snapshot,
      onPersistenceWarning,
      projectId,
      resolveCachedSnapshotByteBreakdown,
      sessionSnapshot,
    ]
  );
  const activeBootstrapError =
    bootstrapError?.projectId === projectId && bootstrapError.revision === projectRuntimeRevision
      ? bootstrapError
      : null;

  useAiStudioSessionAutosave({
    sessionId: projectId,
    snapshot: autosaveSnapshotSelection.snapshot,
    enabled: projectBootstrapReady && !activeBootstrapError,
    persistSnapshot: writeProjectWorkspaceSnapshot,
    resolveSnapshotTitle: resolveProjectSnapshotTitle,
    preparedSnapshot: autosaveSnapshotSelection.preparedSnapshot,
    onPersistError: handleProjectPersistError,
  });

  const retryProjectBootstrap = useCallback(() => {
    if (projectId) {
      setBootstrapError((current) =>
        current?.projectId === projectId && current.revision === projectRuntimeRevision
          ? null
          : current
      );
    }
    sessionRestoreCandidate.retry();
  }, [projectId, projectRuntimeRevision, sessionRestoreCandidate]);

  const resetProjectWorkspace = useCallback(async () => {
    if (!projectId) return;
    await resetAiStudioProjectWorkspaceSnapshotViaApi({ projectId });
    setBootstrapError((current) =>
      current?.projectId === projectId && current.revision === projectRuntimeRevision
        ? null
        : current
    );
    sessionRestoreCandidate.retry();
  }, [projectId, projectRuntimeRevision, sessionRestoreCandidate]);

  return {
    sessionId,
    sessionSnapshot,
    sessionRestoreCandidate,
    setSkipRestoreApplyForSessionId: () => undefined,
    projectBootstrapApplied: projectBootstrapReady,
    projectBootstrapError:
      activeBootstrapError?.message ??
      (sessionRestoreCandidate.status === "error" ? sessionRestoreCandidate.error : null),
    retryProjectBootstrap,
    resetProjectWorkspace,
  };
};
