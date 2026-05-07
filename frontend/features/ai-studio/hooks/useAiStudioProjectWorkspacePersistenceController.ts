/**
 * AI Studio project-workspace persistence controller.
 * Orchestrates project-owned restore/apply and debounced autosave against project workspace authority.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createAiStudioProjectWorkspaceSnapshot,
  type AiStudioSessionSnapshot,
} from "../logic/sessionSnapshot";
import type { AiStudioSessionHydrationPayload } from "../logic/sessionSnapshotHydrator";
import { saveAiStudioProjectWorkspaceSnapshotViaApi } from "../logic/projectWorkspaceApiClient";
import {
  useAiStudioSessionAutosave,
  type AiStudioSessionAutosaveError,
} from "./useAiStudioSessionAutosave";
import { useAiStudioProjectWorkspaceRestoreCandidate } from "./useAiStudioProjectWorkspaceRestoreCandidate";
import { useAiStudioProjectWorkspaceRestoreHydration } from "./useAiStudioProjectWorkspaceRestoreHydration";
import { resetAiStudioOutputStore } from "./aiStudioOutputStore";
import type { AiStudioSessionCanvasState } from "../logic/sessionSnapshotCanvas";
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
  hydrateFromSessionCanvasSnapshot?: (canvas: AiStudioSessionCanvasState | null) => void;
  hydrateFromSessionExpertEditSnapshot?: (
    expertEdit: AiStudioSessionHydrationPayload["expertEdit"]
  ) => void;
  applyEmptyProjectState?: () => void;
  resetProjectAgentConversation?: () => void;
  onPersistenceWarning?: (message: string) => void;
};

const resolveProjectPersistenceWarningMessage = ({
  reason,
  snapshotBytes,
  maxSnapshotBytes,
  error,
}: {
  reason: "snapshot_too_large" | "snapshot_serialize_failed" | "persist_failed";
  snapshotBytes?: number;
  maxSnapshotBytes: number;
  error: Error;
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
      return `Project autosave is retrying in the background: ${error.message}`;
  }
};

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
  hydrateFromSessionCanvasSnapshot,
  hydrateFromSessionExpertEditSnapshot,
  applyEmptyProjectState,
  resetProjectAgentConversation,
  onPersistenceWarning,
}: UseAiStudioProjectWorkspacePersistenceControllerParams): AiStudioPersistenceController => {
  const [bootstrappedProject, setBootstrappedProject] = useState<{
    projectId: string;
    revision: number;
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
  const projectBootstrapReady =
    Boolean(projectId) &&
    sessionRestoreCandidate.status === "ready" &&
    bootstrappedProject?.projectId === projectId &&
    bootstrappedProject.revision === projectRuntimeRevision;
  const baseSessionSnapshot = useMemo(
    () =>
      sessionId && projectBootstrapReady
        ? createAiStudioProjectWorkspaceSnapshot(buildBaseSessionSnapshot(sessionId))
        : null,
    [buildBaseSessionSnapshot, projectBootstrapReady, sessionId]
  );
  const sessionSnapshot = useMemo(
    () =>
      baseSessionSnapshot && patchSessionSnapshot
        ? patchSessionSnapshot(baseSessionSnapshot)
        : baseSessionSnapshot,
    [baseSessionSnapshot, patchSessionSnapshot]
  );

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

  const handleProjectBootstrapSettled = useCallback(
    (activeProjectId: string) => {
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
    hydrateFromSessionCanvasSnapshot,
    hydrateFromSessionExpertEditSnapshot,
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
      await saveAiStudioProjectWorkspaceSnapshotViaApi({
        projectId: activeProjectId,
        snapshot,
        keepalive: options?.keepalive,
      });
    },
    []
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
      onPersistenceWarning?.(
        resolveProjectPersistenceWarningMessage({
          reason: details.reason,
          snapshotBytes: details.snapshotBytes,
          maxSnapshotBytes: details.maxSnapshotBytes,
          error,
        })
      );
    },
    [onPersistenceWarning]
  );
  const activeBootstrapError =
    bootstrapError?.projectId === projectId && bootstrapError.revision === projectRuntimeRevision
      ? bootstrapError
      : null;

  useAiStudioSessionAutosave({
    sessionId: projectId,
    snapshot: sessionSnapshot,
    enabled: projectBootstrapReady && !activeBootstrapError,
    persistSnapshot: writeProjectWorkspaceSnapshot,
    resolveSnapshotTitle: resolveProjectSnapshotTitle,
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
  };
};
