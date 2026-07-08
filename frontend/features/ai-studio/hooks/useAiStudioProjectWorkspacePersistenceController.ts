/**
 * AI Studio project-workspace persistence controller.
 * Orchestrates project-owned restore/apply and debounced autosave against project workspace authority.
 */
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { addBreadcrumb } from "../../../lib/clientBreadcrumbs";
import { reportAppError } from "../../../lib/appErrorReporter";
import {
  PROJECT_WORKSPACE_AUTOSAVE_MAX_SNAPSHOT_BYTES,
  PROJECT_WORKSPACE_KEEPALIVE_MAX_SNAPSHOT_BYTES,
} from "../../../lib/ai-studio-session/projectWorkspaceLimits";
import {
  createEmptyAiStudioSessionSnapshot,
  type AiStudioProjectWorkspaceAutosaveCandidateKind,
  type AiStudioSessionSnapshot,
} from "../logic/sessionSnapshot";
import type { AiStudioSessionHydrationPayload } from "../logic/sessionSnapshotHydrator";
import {
  isStaleProjectWorkspaceSaveError,
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
import type { AiStudioSessionCanvasState } from "../logic/sessionSnapshotCanvas";
import {
  prepareAiStudioSessionAutosaveSnapshot,
  type PreparedAiStudioSessionAutosaveSnapshot,
} from "../logic/sessionAutosaveSerialization";
import { createProjectRestoreVisibilitySnapshot } from "../logic/projectRestoreSnapshot";
import { recordProjectWorkspaceAutosavePerf } from "../logic/projectWorkspaceAutosavePerf";
import {
  buildProjectWorkspaceQuickSlotDiagnostics,
  prefixProjectWorkspaceQuickSlotDiagnostics,
  shouldReportProjectWorkspaceQuickSlotDiagnostics,
} from "../logic/projectWorkspaceQuickSlotDiagnostics";
import type {
  AiStudioPersistenceController,
  AiStudioProjectWorkspaceFlushOptions,
  AiStudioProjectWorkspaceFlushResult,
} from "./aiStudioPersistenceControllerContract";
import {
  PROJECT_WORKSPACE_PHASE_SLOW_THRESHOLDS_MS,
  PROJECT_WORKSPACE_PHASE_TELEMETRY_THROTTLE_MS,
  PROJECT_WORKSPACE_QUICK_SLOT_DIAGNOSTIC_THROTTLE_MS,
  areStringListsEqual,
  collectProjectSnapshotOutputIds,
  flattenProjectSnapshotByteBreakdown,
  resolvePerfNow,
  resolveProjectAutosaveSnapshotSelectionComputation,
  resolveProjectAutosaveUnlockSignature,
  resolveProjectRepairPendingNotice,
  resolveProjectRestoreVisibilitySignature,
  resolveProjectSnapshotByteBreakdown,
  resolveProjectSnapshotOutputCounts,
  resolveQuickSlotDiagnosticsTelemetryKey,
  resolveReducedWorkspaceNotice,
  type ProjectSnapshotByteBreakdown,
} from "./projectWorkspacePersistenceSnapshotAnalysis";

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
  isAutosaveWorkDeferred?: boolean;
  immediateSaveSignal?: string | number | null;
  prepareCurrentSnapshot?: () => void;
  applyEmptyProjectState?: () => void;
  resetProjectAgentConversation?: () => void;
  onPersistenceWarning?: (
    message: string | null,
    details: ProjectWorkspaceAutosaveNoticeDetails
  ) => void;
};

type ProjectWorkspaceAutosaveNoticeReason =
  | "snapshot_reduced"
  | "repair_pending"
  | "snapshot_too_large"
  | "snapshot_serialize_failed"
  | "persist_failed";

export type ProjectWorkspaceAutosaveNoticeDetails = {
  scope: "project_autosave";
  reason: ProjectWorkspaceAutosaveNoticeReason;
  projectId: string;
  snapshotHash: string | null;
  message: string;
  recovered: boolean;
};

type ProjectWorkspaceImperativeFlushRequest = {
  projectId: string;
  snapshot: AiStudioSessionSnapshot;
  snapshotHash: string;
  preparedSnapshot: PreparedAiStudioSessionAutosaveSnapshot;
  keepalive: boolean;
  reason?: AiStudioProjectWorkspaceFlushOptions["reason"];
  reportPersistError: boolean;
};

type ProjectWorkspaceImperativeFlushInFlight = {
  projectId: string;
  snapshotHash: string;
  promise: Promise<AiStudioProjectWorkspaceFlushResult>;
};

type ProjectWorkspacePendingImperativeFlush = {
  request: ProjectWorkspaceImperativeFlushRequest;
  promise: Promise<AiStudioProjectWorkspaceFlushResult>;
  resolve: (result: AiStudioProjectWorkspaceFlushResult) => void;
  reject: (error: unknown) => void;
};

type ProjectWorkspaceReportedPersistError = Error & {
  __shortpulseProjectWorkspacePersistReported?: true;
};

type RunProjectWorkspaceImperativeFlush = (
  request: ProjectWorkspaceImperativeFlushRequest
) => Promise<AiStudioProjectWorkspaceFlushResult>;

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

const markProjectWorkspacePersistErrorReported = (
  error: Error
): ProjectWorkspaceReportedPersistError => {
  (error as ProjectWorkspaceReportedPersistError).__shortpulseProjectWorkspacePersistReported =
    true;
  return error as ProjectWorkspaceReportedPersistError;
};

const wasProjectWorkspacePersistErrorReported = (error: Error): boolean =>
  (error as ProjectWorkspaceReportedPersistError).__shortpulseProjectWorkspacePersistReported ===
  true;

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
  isAutosaveWorkDeferred = false,
  immediateSaveSignal = null,
  prepareCurrentSnapshot,
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
  const [staleWorkspaceSaveProject, setStaleWorkspaceSaveProject] = useState<{
    projectId: string;
    revision: number;
  } | null>(null);
  const [pendingVisibilityAutosaveBaseline, setPendingVisibilityAutosaveBaseline] = useState<{
    projectId: string;
    revision: number;
    restoreVisibilitySignature: string;
    autosaveUnlockSignature: string;
  } | null>(null);
  const [settledAutosaveBaseline, setSettledAutosaveBaseline] = useState<{
    projectId: string;
    revision: number;
    autosaveUnlockSignature: string;
  } | null>(null);
  const [postBootstrapAutosaveUnlocked, setPostBootstrapAutosaveUnlocked] = useState<{
    projectId: string;
    revision: number;
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
  const quickSlotAutosaveCandidateTelemetryKeyRef = useRef<string | null>(null);
  const [lastBaseSessionSnapshotComputation, setLastBaseSessionSnapshotComputation] = useState<{
    snapshot: AiStudioSessionSnapshot | null;
    durationMs: number | null;
  } | null>(null);
  const [lastSessionSnapshotComputation, setLastSessionSnapshotComputation] = useState<{
    snapshot: AiStudioSessionSnapshot | null;
    durationMs: number | null;
  } | null>(null);
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
  const liveBaseSessionSnapshotComputation = useMemo(() => {
    if (isAutosaveWorkDeferred) {
      return null;
    }
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
  }, [buildBaseSessionSnapshot, isAutosaveWorkDeferred, projectBootstrapSettled, sessionId]);
  const baseSessionSnapshotComputation = useMemo(
    () =>
      liveBaseSessionSnapshotComputation ??
      (lastBaseSessionSnapshotComputation
        ? {
            snapshot: lastBaseSessionSnapshotComputation.snapshot,
            durationMs: null as number | null,
          }
        : {
            snapshot: null as AiStudioSessionSnapshot | null,
            durationMs: null as number | null,
          }),
    [lastBaseSessionSnapshotComputation, liveBaseSessionSnapshotComputation]
  );
  const baseSessionSnapshot = baseSessionSnapshotComputation.snapshot;

  useEffect(() => {
    if (!liveBaseSessionSnapshotComputation) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setLastBaseSessionSnapshotComputation((current) => {
        if (
          current?.snapshot === liveBaseSessionSnapshotComputation.snapshot &&
          current.durationMs === liveBaseSessionSnapshotComputation.durationMs
        ) {
          return current;
        }
        return liveBaseSessionSnapshotComputation;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [liveBaseSessionSnapshotComputation]);

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

  const liveSessionSnapshotComputation = useMemo(() => {
    if (isAutosaveWorkDeferred) {
      return null;
    }
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
  }, [baseSessionSnapshot, isAutosaveWorkDeferred, patchSessionSnapshot]);
  const sessionSnapshotComputation = useMemo(
    () =>
      liveSessionSnapshotComputation ??
      (lastSessionSnapshotComputation
        ? {
            snapshot: lastSessionSnapshotComputation.snapshot,
            durationMs: null as number | null,
          }
        : {
            snapshot: baseSessionSnapshot,
            durationMs: null as number | null,
          }),
    [baseSessionSnapshot, lastSessionSnapshotComputation, liveSessionSnapshotComputation]
  );
  const sessionSnapshot = sessionSnapshotComputation.snapshot;

  useEffect(() => {
    if (!liveSessionSnapshotComputation) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setLastSessionSnapshotComputation((current) => {
        if (
          current?.snapshot === liveSessionSnapshotComputation.snapshot &&
          current.durationMs === liveSessionSnapshotComputation.durationMs
        ) {
          return current;
        }
        return liveSessionSnapshotComputation;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [liveSessionSnapshotComputation]);

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
  const deferredSessionSnapshot = useDeferredValue(sessionSnapshot);

  const expectedProjectRestoreVisibilitySignature = useMemo(
    () =>
      projectBootstrapSettled
        ? resolveProjectRestoreVisibilitySignature(
            sessionRestoreCandidate.snapshot
              ? createProjectRestoreVisibilitySnapshot(sessionRestoreCandidate.snapshot)
              : null
          )
        : null,
    [projectBootstrapSettled, sessionRestoreCandidate.snapshot]
  );
  const activeBootstrapVisibilityApplied =
    bootstrapVisibilityApplied?.projectId === projectId &&
    bootstrapVisibilityApplied.revision === projectRuntimeRevision &&
    bootstrapVisibilityApplied.restoreVisibilitySignature ===
      expectedProjectRestoreVisibilitySignature;
  const actualProjectRestoreVisibilitySignature = useMemo(
    () =>
      projectBootstrapSettled && !activeBootstrapVisibilityApplied
        ? resolveProjectRestoreVisibilitySignature(sessionSnapshot)
        : null,
    [activeBootstrapVisibilityApplied, projectBootstrapSettled, sessionSnapshot]
  );
  useEffect(() => {
    if (!projectId || !projectBootstrapSettled) return;
    if (activeBootstrapVisibilityApplied) return;
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
    activeBootstrapVisibilityApplied,
    expectedProjectRestoreVisibilitySignature,
    projectBootstrapSettled,
    projectId,
    projectRuntimeRevision,
  ]);
  const projectBootstrapReady = projectBootstrapSettled && activeBootstrapVisibilityApplied;

  const reducedSnapshotNoticeKeyRef = useRef<string | null>(null);
  const repairPendingNoticeKeyRef = useRef<string | null>(null);
  const activeAutosaveNoticeRef = useRef<ProjectWorkspaceAutosaveNoticeDetails | null>(null);
  const lastImperativeFlushRef = useRef<{
    projectId: string;
    snapshotHash: string | null;
  } | null>(null);
  const imperativeFlushInFlightRef = useRef(
    new Map<string, ProjectWorkspaceImperativeFlushInFlight>()
  );
  const pendingImperativeFlushRef = useRef(
    new Map<string, ProjectWorkspacePendingImperativeFlush>()
  );
  const runImperativeProjectWorkspaceFlushRef = useRef<RunProjectWorkspaceImperativeFlush | null>(
    null
  );
  const quickSlotSaveResultTelemetryRef = useRef<{ key: string; emittedAt: number } | null>(null);
  const autosaveUnlockSignature = useMemo(
    () => resolveProjectAutosaveUnlockSignature(sessionSnapshot),
    [sessionSnapshot]
  );
  const noSnapshotProjectAutosaveBaselineSignature = useMemo(() => {
    if (!projectBootstrapSettled || sessionRestoreCandidate.result !== "no_snapshot") return null;
    return resolveProjectAutosaveUnlockSignature(
      createEmptyAiStudioSessionSnapshot({
        sessionId: sessionId ?? undefined,
      })
    );
  }, [projectBootstrapSettled, sessionId, sessionRestoreCandidate.result]);
  const pendingVisibilityBaselineAutosaveUnlockSignature =
    noSnapshotProjectAutosaveBaselineSignature ?? autosaveUnlockSignature;
  const projectAutosaveReadyAfterUserEdit =
    Boolean(projectId) &&
    projectBootstrapSettled &&
    !activeBootstrapVisibilityApplied &&
    Boolean(expectedProjectRestoreVisibilitySignature) &&
    Boolean(autosaveUnlockSignature) &&
    pendingVisibilityAutosaveBaseline?.projectId === projectId &&
    pendingVisibilityAutosaveBaseline.revision === projectRuntimeRevision &&
    pendingVisibilityAutosaveBaseline.restoreVisibilitySignature ===
      expectedProjectRestoreVisibilitySignature &&
    pendingVisibilityAutosaveBaseline.autosaveUnlockSignature !== autosaveUnlockSignature;
  const projectAutosaveDiffersFromBootstrap =
    Boolean(projectId) &&
    projectBootstrapReady &&
    Boolean(autosaveUnlockSignature) &&
    settledAutosaveBaseline?.projectId === projectId &&
    settledAutosaveBaseline.revision === projectRuntimeRevision &&
    settledAutosaveBaseline.autosaveUnlockSignature !== autosaveUnlockSignature;
  const projectAutosaveUnlockedForBootstrap =
    postBootstrapAutosaveUnlocked?.projectId === projectId &&
    postBootstrapAutosaveUnlocked.revision === projectRuntimeRevision;
  const projectAutosaveReadyAfterBootstrap =
    Boolean(projectId) &&
    projectBootstrapReady &&
    Boolean(autosaveUnlockSignature) &&
    settledAutosaveBaseline?.projectId === projectId &&
    settledAutosaveBaseline.revision === projectRuntimeRevision &&
    (projectAutosaveDiffersFromBootstrap || projectAutosaveUnlockedForBootstrap);
  const projectAutosaveReady =
    projectAutosaveReadyAfterBootstrap || projectAutosaveReadyAfterUserEdit;
  const resolveProjectAutosaveReadyForSnapshot = useCallback(
    (snapshot: AiStudioSessionSnapshot | null): boolean => {
      const currentAutosaveUnlockSignature = resolveProjectAutosaveUnlockSignature(snapshot);
      const currentAutosaveReadyAfterUserEdit =
        Boolean(projectId) &&
        projectBootstrapSettled &&
        !activeBootstrapVisibilityApplied &&
        Boolean(expectedProjectRestoreVisibilitySignature) &&
        Boolean(currentAutosaveUnlockSignature) &&
        pendingVisibilityAutosaveBaseline?.projectId === projectId &&
        pendingVisibilityAutosaveBaseline.revision === projectRuntimeRevision &&
        pendingVisibilityAutosaveBaseline.restoreVisibilitySignature ===
          expectedProjectRestoreVisibilitySignature &&
        pendingVisibilityAutosaveBaseline.autosaveUnlockSignature !==
          currentAutosaveUnlockSignature;
      const currentAutosaveDiffersFromBootstrap =
        Boolean(projectId) &&
        projectBootstrapReady &&
        Boolean(currentAutosaveUnlockSignature) &&
        settledAutosaveBaseline?.projectId === projectId &&
        settledAutosaveBaseline.revision === projectRuntimeRevision &&
        settledAutosaveBaseline.autosaveUnlockSignature !== currentAutosaveUnlockSignature;
      const currentAutosaveUnlockedForBootstrap =
        postBootstrapAutosaveUnlocked?.projectId === projectId &&
        postBootstrapAutosaveUnlocked.revision === projectRuntimeRevision;
      const currentAutosaveReadyAfterBootstrap =
        Boolean(projectId) &&
        projectBootstrapReady &&
        Boolean(currentAutosaveUnlockSignature) &&
        settledAutosaveBaseline?.projectId === projectId &&
        settledAutosaveBaseline.revision === projectRuntimeRevision &&
        (currentAutosaveDiffersFromBootstrap || currentAutosaveUnlockedForBootstrap);

      return currentAutosaveReadyAfterBootstrap || currentAutosaveReadyAfterUserEdit;
    },
    [
      activeBootstrapVisibilityApplied,
      expectedProjectRestoreVisibilitySignature,
      pendingVisibilityAutosaveBaseline,
      postBootstrapAutosaveUnlocked,
      projectBootstrapReady,
      projectBootstrapSettled,
      projectId,
      projectRuntimeRevision,
      settledAutosaveBaseline,
    ]
  );
  const resolveProjectSnapshotMatchesAutosaveBaseline = useCallback(
    (snapshot: AiStudioSessionSnapshot | null): boolean => {
      if (!projectId || !snapshot) return false;
      const currentAutosaveUnlockSignature = resolveProjectAutosaveUnlockSignature(snapshot);
      if (!currentAutosaveUnlockSignature) return false;

      const matchesSettledBaseline =
        settledAutosaveBaseline?.projectId === projectId &&
        settledAutosaveBaseline.revision === projectRuntimeRevision &&
        settledAutosaveBaseline.autosaveUnlockSignature === currentAutosaveUnlockSignature;
      if (matchesSettledBaseline) return true;

      return (
        pendingVisibilityAutosaveBaseline?.projectId === projectId &&
        pendingVisibilityAutosaveBaseline.revision === projectRuntimeRevision &&
        pendingVisibilityAutosaveBaseline.restoreVisibilitySignature ===
          expectedProjectRestoreVisibilitySignature &&
        pendingVisibilityAutosaveBaseline.autosaveUnlockSignature === currentAutosaveUnlockSignature
      );
    },
    [
      expectedProjectRestoreVisibilitySignature,
      pendingVisibilityAutosaveBaseline,
      projectId,
      projectRuntimeRevision,
      settledAutosaveBaseline,
    ]
  );
  const autosaveSnapshotSelectionComputation = useMemo(
    () =>
      resolveProjectAutosaveSnapshotSelectionComputation(
        projectAutosaveReady ? deferredSessionSnapshot : null
      ),
    [deferredSessionSnapshot, projectAutosaveReady]
  );
  const autosaveSnapshotSelection = autosaveSnapshotSelectionComputation.selection;

  const emitProjectAutosaveWarning = useCallback(
    ({
      reason,
      message,
      snapshotHash,
    }: {
      reason: ProjectWorkspaceAutosaveNoticeReason;
      message: string;
      snapshotHash?: string | null;
    }) => {
      if (!projectId) return;
      const details: ProjectWorkspaceAutosaveNoticeDetails = {
        scope: "project_autosave",
        reason,
        projectId,
        snapshotHash: snapshotHash ?? null,
        message,
        recovered: false,
      };
      activeAutosaveNoticeRef.current = details;
      onPersistenceWarning?.(message, details);
    },
    [onPersistenceWarning, projectId]
  );
  const markProjectAutosaveBaselineSaved = useCallback(
    (activeProjectId: string, snapshot: AiStudioSessionSnapshot) => {
      if (activeProjectId !== projectId) return;
      const nextAutosaveUnlockSignature = resolveProjectAutosaveUnlockSignature(snapshot);
      if (!nextAutosaveUnlockSignature) return;
      setSettledAutosaveBaseline((current) => {
        if (current?.projectId !== activeProjectId || current.revision !== projectRuntimeRevision) {
          return current;
        }
        if (current.autosaveUnlockSignature === nextAutosaveUnlockSignature) {
          return current;
        }
        return {
          projectId: activeProjectId,
          revision: projectRuntimeRevision,
          autosaveUnlockSignature: nextAutosaveUnlockSignature,
        };
      });
      setPendingVisibilityAutosaveBaseline((current) => {
        if (current?.projectId !== activeProjectId || current.revision !== projectRuntimeRevision) {
          return current;
        }
        if (current.autosaveUnlockSignature === nextAutosaveUnlockSignature) {
          return current;
        }
        return {
          ...current,
          autosaveUnlockSignature: nextAutosaveUnlockSignature,
        };
      });
      setPostBootstrapAutosaveUnlocked((current) =>
        current?.projectId === activeProjectId && current.revision === projectRuntimeRevision
          ? null
          : current
      );
    },
    [projectId, projectRuntimeRevision]
  );

  const clearRecoveredProjectAutosaveWarning = useCallback(
    (
      activeProjectId: string,
      snapshotHash: string | null | undefined,
      options?: { allowAnySnapshot?: boolean }
    ) => {
      const activeNotice = activeAutosaveNoticeRef.current;
      if (!activeNotice || activeNotice.projectId !== activeProjectId) return;
      const successfulSnapshotHash = snapshotHash ?? null;
      const snapshotMatches =
        options?.allowAnySnapshot === true ||
        activeNotice.snapshotHash == null ||
        activeNotice.snapshotHash === successfulSnapshotHash;
      if (!snapshotMatches) return;
      activeAutosaveNoticeRef.current = null;
      onPersistenceWarning?.(null, {
        ...activeNotice,
        snapshotHash: successfulSnapshotHash,
        recovered: true,
      });
    },
    [onPersistenceWarning]
  );

  const markStaleWorkspaceSaveProject = useCallback(
    (staleProjectId: string) => {
      setStaleWorkspaceSaveProject((current) => {
        if (current?.projectId === staleProjectId && current.revision === projectRuntimeRevision) {
          return current;
        }
        return {
          projectId: staleProjectId,
          revision: projectRuntimeRevision,
        };
      });
    },
    [projectRuntimeRevision]
  );

  useEffect(() => {
    let cancelled = false;
    if (lastImperativeFlushRef.current?.projectId !== projectId) {
      lastImperativeFlushRef.current = null;
    }
    queueMicrotask(() => {
      if (cancelled) return;
      setStaleWorkspaceSaveProject((current) =>
        current?.projectId === projectId && current.revision === projectRuntimeRevision
          ? current
          : null
      );
    });
    const activeNotice = activeAutosaveNoticeRef.current;
    if (!activeNotice || activeNotice.projectId === projectId) {
      return () => {
        cancelled = true;
      };
    }
    activeAutosaveNoticeRef.current = null;
    onPersistenceWarning?.(null, {
      ...activeNotice,
      recovered: true,
    });
    return () => {
      cancelled = true;
    };
  }, [onPersistenceWarning, projectId, projectRuntimeRevision]);

  useLayoutEffect(() => {
    let cancelled = false;
    if (
      !projectId ||
      !projectBootstrapSettled ||
      !expectedProjectRestoreVisibilitySignature ||
      activeBootstrapVisibilityApplied ||
      !pendingVisibilityBaselineAutosaveUnlockSignature
    ) {
      queueMicrotask(() => {
        if (cancelled) return;
        setPendingVisibilityAutosaveBaseline((current) => (current === null ? current : null));
      });
      return () => {
        cancelled = true;
      };
    }
    queueMicrotask(() => {
      if (cancelled) return;
      setPendingVisibilityAutosaveBaseline((current) => {
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
          autosaveUnlockSignature: pendingVisibilityBaselineAutosaveUnlockSignature,
        };
      });
    });
    return () => {
      cancelled = true;
    };
  }, [
    activeBootstrapVisibilityApplied,
    expectedProjectRestoreVisibilitySignature,
    pendingVisibilityBaselineAutosaveUnlockSignature,
    projectBootstrapSettled,
    projectId,
    projectRuntimeRevision,
  ]);

  useLayoutEffect(() => {
    let cancelled = false;
    if (!projectId || !projectBootstrapReady || !autosaveUnlockSignature) {
      queueMicrotask(() => {
        if (cancelled) return;
        setSettledAutosaveBaseline((current) => (current === null ? current : null));
      });
      return () => {
        cancelled = true;
      };
    }
    queueMicrotask(() => {
      if (cancelled) return;
      setSettledAutosaveBaseline((current) => {
        if (current?.projectId === projectId && current.revision === projectRuntimeRevision) {
          return current;
        }
        return {
          projectId,
          revision: projectRuntimeRevision,
          autosaveUnlockSignature,
        };
      });
    });
    return () => {
      cancelled = true;
    };
  }, [autosaveUnlockSignature, projectBootstrapReady, projectId, projectRuntimeRevision]);

  useLayoutEffect(() => {
    let cancelled = false;
    if (!projectId || !projectBootstrapReady || !projectAutosaveDiffersFromBootstrap) {
      queueMicrotask(() => {
        if (cancelled) return;
        setPostBootstrapAutosaveUnlocked((current) =>
          current?.projectId === projectId && current.revision === projectRuntimeRevision
            ? current
            : null
        );
      });
      return () => {
        cancelled = true;
      };
    }
    queueMicrotask(() => {
      if (cancelled) return;
      setPostBootstrapAutosaveUnlocked((current) => {
        if (current?.projectId === projectId && current.revision === projectRuntimeRevision) {
          return current;
        }
        return {
          projectId,
          revision: projectRuntimeRevision,
        };
      });
    });
    return () => {
      cancelled = true;
    };
  }, [
    projectAutosaveDiffersFromBootstrap,
    projectBootstrapReady,
    projectId,
    projectRuntimeRevision,
  ]);

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
    // Fail closed for the decoupled output store before async restore finishes.
    // Snapshot hydration, including empty-project defaults, is owned by the restore hydrator.
    resetAiStudioOutputStore();
  }, [projectRuntimeAuthority, projectRuntimeRevision]);

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
    emitProjectAutosaveWarning({
      reason: "snapshot_reduced",
      snapshotHash: autosaveSnapshotSelection.preparedSnapshot?.hash ?? null,
      message: resolveReducedWorkspaceNotice(
        autosaveSnapshotSelection.fallbackKind as Exclude<
          AiStudioProjectWorkspaceAutosaveCandidateKind,
          "full"
        >
      ),
    });
  }, [
    autosaveSnapshotSelection.preparedSnapshot?.hash,
    autosaveSnapshotSelection.fallbackKind,
    emitProjectAutosaveWarning,
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
      options?: {
        keepalive?: boolean;
        snapshotHash?: string | null;
        preparedSnapshot?: PreparedAiStudioSessionAutosaveSnapshot;
      }
    ) => {
      const savedWorkspace = await saveAiStudioProjectWorkspaceSnapshotViaApi({
        projectId: activeProjectId,
        snapshot,
        keepalive: options?.keepalive,
        serializedSnapshotJson: options?.preparedSnapshot?.serializedJson,
      });
      const localOutputIds = collectProjectSnapshotOutputIds(snapshot);
      const savedSnapshot =
        savedWorkspace.snapshot && typeof savedWorkspace.snapshot === "object"
          ? (savedWorkspace.snapshot as AiStudioSessionSnapshot)
          : null;
      const localQuickSlotDiagnostics = buildProjectWorkspaceQuickSlotDiagnostics(snapshot);
      const savedQuickSlotDiagnostics = buildProjectWorkspaceQuickSlotDiagnostics(savedSnapshot);
      if (
        shouldReportProjectWorkspaceQuickSlotDiagnostics(localQuickSlotDiagnostics) ||
        shouldReportProjectWorkspaceQuickSlotDiagnostics(savedQuickSlotDiagnostics)
      ) {
        const now = Date.now();
        const telemetryKey = [
          activeProjectId,
          savedWorkspace.saveOutcome?.status ?? "saved",
          options?.keepalive === true ? "keepalive" : "normal",
          resolveQuickSlotDiagnosticsTelemetryKey(localQuickSlotDiagnostics),
          resolveQuickSlotDiagnosticsTelemetryKey(savedQuickSlotDiagnostics),
        ].join("|");
        const previousTelemetry = quickSlotSaveResultTelemetryRef.current;
        if (
          previousTelemetry?.key !== telemetryKey ||
          now - previousTelemetry.emittedAt >= PROJECT_WORKSPACE_QUICK_SLOT_DIAGNOSTIC_THROTTLE_MS
        ) {
          quickSlotSaveResultTelemetryRef.current = { key: telemetryKey, emittedAt: now };
          void reportAppError({
            source: "telemetry.ai_studio.project_workspace.quick_slot_save_result",
            scope: "app",
            severity: "low",
            message: "Project workspace save returned Quick Slot diagnostics.",
            metadata: {
              project_id: activeProjectId,
              keepalive: options?.keepalive === true,
              snapshot_updated_at: snapshot.updatedAt,
              saved_snapshot_updated_at: savedSnapshot?.updatedAt ?? null,
              save_outcome: savedWorkspace.saveOutcome?.status ?? "saved",
              quick_slot_count_changed:
                localQuickSlotDiagnostics.quick_slot_count !==
                savedQuickSlotDiagnostics.quick_slot_count,
              quick_slot_missing_changed:
                localQuickSlotDiagnostics.quick_slot_missing_count !==
                savedQuickSlotDiagnostics.quick_slot_missing_count,
              ...prefixProjectWorkspaceQuickSlotDiagnostics("local", localQuickSlotDiagnostics),
              ...prefixProjectWorkspaceQuickSlotDiagnostics("saved", savedQuickSlotDiagnostics),
            },
          });
        }
      }
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
      markProjectAutosaveBaselineSaved(activeProjectId, snapshot);
      if (savedWorkspace.saveOutcome?.status === "saved_with_repair_pending") {
        const noticeKey = [
          activeProjectId,
          snapshot.updatedAt,
          savedWorkspace.saveOutcome.repairStage ?? "repair_pending",
          savedWorkspace.saveOutcome.repairMessage ?? "",
        ].join("|");
        if (repairPendingNoticeKeyRef.current !== noticeKey) {
          repairPendingNoticeKeyRef.current = noticeKey;
          emitProjectAutosaveWarning({
            reason: "repair_pending",
            snapshotHash: options?.snapshotHash ?? null,
            message: resolveProjectRepairPendingNotice(),
          });
        }
      } else {
        clearRecoveredProjectAutosaveWarning(activeProjectId, options?.snapshotHash ?? null, {
          allowAnySnapshot: autosaveSnapshotSelection.fallbackKind === "full",
        });
      }
    },
    [
      autosaveSnapshotSelection.fallbackKind,
      clearRecoveredProjectAutosaveWarning,
      emitProjectAutosaveWarning,
      markProjectAutosaveBaselineSaved,
    ]
  );

  const resolveProjectSnapshotTitle = useCallback(() => null, []);

  const handleProjectPersistError = useCallback(
    (error: Error, details: AiStudioSessionAutosaveError) => {
      if (wasProjectWorkspacePersistErrorReported(error)) {
        return;
      }
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
      emitProjectAutosaveWarning({
        reason: details.reason,
        snapshotHash: details.snapshotHash ?? null,
        message: resolveProjectPersistenceWarningMessage({
          reason: details.reason,
          snapshotBytes: details.snapshotBytes,
          maxSnapshotBytes: details.maxSnapshotBytes,
          error,
          willRetry: details.willRetry,
        }),
      });
    },
    [
      autosaveSnapshotSelection.fallbackKind,
      autosaveSnapshotSelection.snapshot,
      emitProjectAutosaveWarning,
      projectId,
      resolveCachedSnapshotByteBreakdown,
      sessionSnapshot,
    ]
  );
  const activeBootstrapError =
    bootstrapError?.projectId === projectId && bootstrapError.revision === projectRuntimeRevision
      ? bootstrapError
      : null;

  const composeCurrentProjectWorkspaceSnapshot = useCallback(() => {
    prepareCurrentSnapshot?.();
    if (!sessionId || !projectBootstrapSettled) {
      return null;
    }
    const baseSnapshot = buildBaseSessionSnapshot(sessionId);
    return patchSessionSnapshot ? patchSessionSnapshot(baseSnapshot) : baseSnapshot;
  }, [
    buildBaseSessionSnapshot,
    patchSessionSnapshot,
    prepareCurrentSnapshot,
    projectBootstrapSettled,
    sessionId,
  ]);

  const runImperativeProjectWorkspaceFlush = useCallback(
    (
      request: ProjectWorkspaceImperativeFlushRequest
    ): Promise<AiStudioProjectWorkspaceFlushResult> => {
      const activeFlush = imperativeFlushInFlightRef.current.get(request.projectId);
      if (activeFlush) {
        if (activeFlush.snapshotHash === request.snapshotHash) {
          return activeFlush.promise;
        }

        const currentPending = pendingImperativeFlushRef.current.get(request.projectId);
        if (currentPending) {
          const existingRequest = currentPending.request;
          currentPending.request = {
            ...request,
            keepalive: request.keepalive,
            reportPersistError: existingRequest.reportPersistError || request.reportPersistError,
            reason:
              existingRequest.reason === "project_switch" || request.reason === "project_switch"
                ? "project_switch"
                : request.reason,
          };
          return currentPending.promise;
        }

        let resolvePending!: (result: AiStudioProjectWorkspaceFlushResult) => void;
        let rejectPending!: (error: unknown) => void;
        const pendingPromise = new Promise<AiStudioProjectWorkspaceFlushResult>(
          (resolve, reject) => {
            resolvePending = resolve;
            rejectPending = reject;
          }
        );
        pendingImperativeFlushRef.current.set(request.projectId, {
          request,
          promise: pendingPromise,
          resolve: resolvePending,
          reject: rejectPending,
        });
        return pendingPromise;
      }

      const flushPromise = (async (): Promise<AiStudioProjectWorkspaceFlushResult> => {
        const maxSnapshotBytes = PROJECT_WORKSPACE_AUTOSAVE_MAX_SNAPSHOT_BYTES;
        try {
          await persistProjectWorkspaceSnapshot(request.projectId, request.snapshot, {
            keepalive: request.keepalive,
            snapshotHash: request.snapshotHash,
            preparedSnapshot: request.preparedSnapshot,
          });
        } catch (error) {
          const persistError =
            error instanceof Error ? error : new Error("Failed to save workspace.");
          if (isStaleProjectWorkspaceSaveError(persistError)) {
            markStaleWorkspaceSaveProject(request.projectId);
          }
          if (request.reportPersistError) {
            handleProjectPersistError(persistError, {
              sessionId: request.projectId,
              reason: "persist_failed",
              snapshotHash: request.snapshotHash,
              snapshotBytes: request.preparedSnapshot.bytes,
              maxSnapshotBytes,
              keepalive: request.keepalive,
              willRetry: request.reason !== "project_switch",
            });
            throw markProjectWorkspacePersistErrorReported(persistError);
          }
          throw persistError;
        }

        lastImperativeFlushRef.current = {
          projectId: request.projectId,
          snapshotHash: request.snapshotHash,
        };
        return {
          status: "saved",
          projectId: request.projectId,
          snapshotHash: request.snapshotHash,
          keepalive: request.keepalive,
        };
      })();

      imperativeFlushInFlightRef.current.set(request.projectId, {
        projectId: request.projectId,
        snapshotHash: request.snapshotHash,
        promise: flushPromise,
      });

      const drainPendingFlush = () => {
        if (imperativeFlushInFlightRef.current.get(request.projectId)?.promise !== flushPromise) {
          return;
        }
        imperativeFlushInFlightRef.current.delete(request.projectId);
        const pendingFlush = pendingImperativeFlushRef.current.get(request.projectId);
        if (!pendingFlush) return;
        pendingImperativeFlushRef.current.delete(request.projectId);
        const runNextFlush = runImperativeProjectWorkspaceFlushRef.current;
        if (!runNextFlush) {
          pendingFlush.reject(new Error("Project workspace flush queue is unavailable."));
          return;
        }
        runNextFlush(pendingFlush.request).then(pendingFlush.resolve, pendingFlush.reject);
      };

      void flushPromise.then(drainPendingFlush, drainPendingFlush);
      return flushPromise;
    },
    [handleProjectPersistError, markStaleWorkspaceSaveProject, persistProjectWorkspaceSnapshot]
  );

  useEffect(() => {
    runImperativeProjectWorkspaceFlushRef.current = runImperativeProjectWorkspaceFlush;
    return () => {
      if (runImperativeProjectWorkspaceFlushRef.current === runImperativeProjectWorkspaceFlush) {
        runImperativeProjectWorkspaceFlushRef.current = null;
      }
    };
  }, [runImperativeProjectWorkspaceFlush]);

  const writeProjectWorkspaceSnapshot = useCallback(
    async (
      activeProjectId: string,
      snapshot: AiStudioSessionSnapshot,
      options?: {
        keepalive?: boolean;
        snapshotHash?: string | null;
        preparedSnapshot?: PreparedAiStudioSessionAutosaveSnapshot;
      }
    ): Promise<void> => {
      const preparedSnapshot =
        options?.preparedSnapshot ??
        prepareAiStudioSessionAutosaveSnapshot(snapshot, {
          title: null,
        });
      const snapshotHash = options?.snapshotHash?.trim() || preparedSnapshot.hash;
      if (!snapshotHash) {
        throw new Error("Workspace serialization failed.");
      }
      const transportKeepalive =
        options?.keepalive === true &&
        preparedSnapshot.bytes <= PROJECT_WORKSPACE_KEEPALIVE_MAX_SNAPSHOT_BYTES;
      await runImperativeProjectWorkspaceFlush({
        projectId: activeProjectId,
        snapshot,
        snapshotHash,
        keepalive: transportKeepalive,
        preparedSnapshot,
        reportPersistError: false,
      });
    },
    [runImperativeProjectWorkspaceFlush]
  );

  const flushProjectWorkspaceSnapshot = useCallback(
    async (
      options: AiStudioProjectWorkspaceFlushOptions = {}
    ): Promise<AiStudioProjectWorkspaceFlushResult> => {
      const requestedKeepalive = options.keepalive === true;
      if (!projectId) {
        return {
          status: "skipped",
          reason: "not_project",
          projectId: null,
          snapshotHash: null,
          keepalive: requestedKeepalive,
        };
      }
      if (!sessionId || !projectBootstrapSettled || activeBootstrapError) {
        return {
          status: "skipped",
          reason: "not_ready",
          projectId,
          snapshotHash: null,
          keepalive: requestedKeepalive,
        };
      }

      const currentSnapshot = composeCurrentProjectWorkspaceSnapshot();
      if (!currentSnapshot) {
        return {
          status: "skipped",
          reason: "no_snapshot",
          projectId,
          snapshotHash: null,
          keepalive: requestedKeepalive,
        };
      }
      if (!resolveProjectAutosaveReadyForSnapshot(currentSnapshot)) {
        if (resolveProjectSnapshotMatchesAutosaveBaseline(currentSnapshot)) {
          return {
            status: "skipped",
            reason: "unchanged",
            projectId,
            snapshotHash: null,
            keepalive: requestedKeepalive,
          };
        }
        return {
          status: "skipped",
          reason: "not_ready",
          projectId,
          snapshotHash: null,
          keepalive: requestedKeepalive,
        };
      }

      const currentSelectionComputation =
        resolveProjectAutosaveSnapshotSelectionComputation(currentSnapshot);
      const currentSelection = currentSelectionComputation.selection;
      const preparedSnapshot = currentSelection.preparedSnapshot;
      const snapshotHash = preparedSnapshot?.hash ?? null;
      const maxSnapshotBytes = PROJECT_WORKSPACE_AUTOSAVE_MAX_SNAPSHOT_BYTES;

      if (!currentSelection.snapshot || !preparedSnapshot) {
        return {
          status: "skipped",
          reason: "no_snapshot",
          projectId,
          snapshotHash,
          keepalive: requestedKeepalive,
        };
      }

      if (!snapshotHash) {
        handleProjectPersistError(new Error("Workspace serialization failed."), {
          sessionId: projectId,
          reason: "snapshot_serialize_failed",
          snapshotHash,
          snapshotBytes: preparedSnapshot.bytes,
          maxSnapshotBytes,
          keepalive: requestedKeepalive,
          willRetry: options.reason !== "project_switch",
        });
        return {
          status: "skipped",
          reason: "serialization_failed",
          projectId,
          snapshotHash,
          keepalive: requestedKeepalive,
        };
      }

      if (preparedSnapshot.bytes > maxSnapshotBytes) {
        handleProjectPersistError(new Error("Workspace snapshot is too large."), {
          sessionId: projectId,
          reason: "snapshot_too_large",
          snapshotHash,
          snapshotBytes: preparedSnapshot.bytes,
          maxSnapshotBytes,
          keepalive: requestedKeepalive,
          willRetry: options.reason !== "project_switch",
        });
        return {
          status: "skipped",
          reason: "snapshot_too_large",
          projectId,
          snapshotHash,
          keepalive: requestedKeepalive,
        };
      }

      const transportKeepalive =
        requestedKeepalive &&
        preparedSnapshot.bytes <= PROJECT_WORKSPACE_KEEPALIVE_MAX_SNAPSHOT_BYTES;

      const lastFlush = lastImperativeFlushRef.current;
      if (lastFlush?.projectId === projectId && lastFlush.snapshotHash === snapshotHash) {
        return {
          status: "skipped",
          reason: "unchanged",
          projectId,
          snapshotHash,
          keepalive: transportKeepalive,
        };
      }

      return runImperativeProjectWorkspaceFlush({
        projectId,
        snapshot: currentSelection.snapshot,
        snapshotHash,
        keepalive: transportKeepalive,
        preparedSnapshot,
        reason: options.reason,
        reportPersistError: true,
      });
    },
    [
      activeBootstrapError,
      composeCurrentProjectWorkspaceSnapshot,
      handleProjectPersistError,
      projectBootstrapSettled,
      projectId,
      resolveProjectSnapshotMatchesAutosaveBaseline,
      resolveProjectAutosaveReadyForSnapshot,
      runImperativeProjectWorkspaceFlush,
      sessionId,
    ]
  );

  const flushProjectWorkspaceSnapshotInBackground = useCallback(
    (options: AiStudioProjectWorkspaceFlushOptions) => {
      void flushProjectWorkspaceSnapshot(options).catch(() => undefined);
    },
    [flushProjectWorkspaceSnapshot]
  );

  const previousImmediateSaveSignalRef = useRef<string | number | null>(immediateSaveSignal);
  useEffect(() => {
    if (previousImmediateSaveSignalRef.current === immediateSaveSignal) return;
    previousImmediateSaveSignalRef.current = immediateSaveSignal;
    if (immediateSaveSignal == null) return;
    flushProjectWorkspaceSnapshotInBackground({ reason: "critical_save" });
  }, [flushProjectWorkspaceSnapshotInBackground, immediateSaveSignal]);

  useEffect(() => {
    if (!projectId) return;
    const flushCurrentForPageLifecycle = (reason: "visibility_hidden" | "pagehide") => {
      flushProjectWorkspaceSnapshotInBackground({
        reason,
        keepalive: true,
      });
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushCurrentForPageLifecycle("visibility_hidden");
      }
    };
    const handlePageHide = () => {
      flushCurrentForPageLifecycle("pagehide");
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [flushProjectWorkspaceSnapshotInBackground, projectId]);

  useEffect(() => {
    if (!projectId) {
      quickSlotAutosaveCandidateTelemetryKeyRef.current = null;
      return;
    }
    const diagnostics = buildProjectWorkspaceQuickSlotDiagnostics(
      autosaveSnapshotSelection.snapshot
    );
    if (!shouldReportProjectWorkspaceQuickSlotDiagnostics(diagnostics)) return;
    const telemetryKey = [
      projectId,
      autosaveSnapshotSelection.fallbackKind,
      projectAutosaveReady ? "ready" : "not-ready",
      activeBootstrapError ? "bootstrap-error" : "bootstrap-ok",
      resolveQuickSlotDiagnosticsTelemetryKey(diagnostics),
    ].join("|");
    const throttledTelemetryKey = `${telemetryKey}|${Math.floor(
      Date.now() / PROJECT_WORKSPACE_QUICK_SLOT_DIAGNOSTIC_THROTTLE_MS
    )}`;
    if (quickSlotAutosaveCandidateTelemetryKeyRef.current === throttledTelemetryKey) return;
    quickSlotAutosaveCandidateTelemetryKeyRef.current = throttledTelemetryKey;
    void reportAppError({
      source: "telemetry.ai_studio.project_workspace.quick_slot_autosave_candidate",
      scope: "app",
      severity: "low",
      message: "Project workspace autosave candidate contains Quick Slot state.",
      metadata: {
        project_id: projectId,
        runtime_revision: projectRuntimeRevision,
        autosave_enabled: projectAutosaveReady && !activeBootstrapError,
        project_autosave_ready: projectAutosaveReady,
        bootstrap_error_active: Boolean(activeBootstrapError),
        fallback_kind: autosaveSnapshotSelection.fallbackKind,
        snapshot_updated_at: autosaveSnapshotSelection.snapshot?.updatedAt ?? null,
        prepared_snapshot_bytes: autosaveSnapshotSelection.preparedSnapshot?.bytes ?? null,
        ...prefixProjectWorkspaceQuickSlotDiagnostics("candidate", diagnostics),
      },
    });
  }, [
    activeBootstrapError,
    autosaveSnapshotSelection.fallbackKind,
    autosaveSnapshotSelection.preparedSnapshot?.bytes,
    autosaveSnapshotSelection.preparedSnapshot?.hash,
    autosaveSnapshotSelection.snapshot,
    projectAutosaveReady,
    projectId,
    projectRuntimeRevision,
  ]);

  useAiStudioSessionAutosave({
    sessionId: projectId,
    snapshot: autosaveSnapshotSelection.snapshot,
    enabled: projectAutosaveReady && !activeBootstrapError,
    persistSnapshot: writeProjectWorkspaceSnapshot,
    immediateSaveSignal: null,
    resolveSnapshotTitle: resolveProjectSnapshotTitle,
    preparedSnapshot: autosaveSnapshotSelection.preparedSnapshot,
    maxSnapshotBytes: PROJECT_WORKSPACE_AUTOSAVE_MAX_SNAPSHOT_BYTES,
    maxKeepaliveSnapshotBytes: PROJECT_WORKSPACE_KEEPALIVE_MAX_SNAPSHOT_BYTES,
    enableLifecycleFlush: false,
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
    projectBootstrapSettled,
    projectBootstrapApplied: projectBootstrapReady,
    projectBootstrapError:
      activeBootstrapError?.message ??
      (sessionRestoreCandidate.status === "error" ? sessionRestoreCandidate.error : null),
    projectWorkspaceStaleProjectId:
      staleWorkspaceSaveProject?.projectId === projectId &&
      staleWorkspaceSaveProject.revision === projectRuntimeRevision
        ? staleWorkspaceSaveProject.projectId
        : null,
    retryProjectBootstrap,
    flushProjectWorkspaceSnapshot,
    resetProjectWorkspace,
  };
};
