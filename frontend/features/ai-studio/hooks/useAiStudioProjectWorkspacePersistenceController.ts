/**
 * AI Studio project-workspace persistence controller.
 * Orchestrates project-owned restore/apply and debounced write shadow against project workspace authority.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createAiStudioProjectWorkspaceSnapshot,
  type AiStudioSessionSnapshot,
} from "../logic/sessionSnapshot";
import type { AiStudioSessionHydrationPayload } from "../logic/sessionSnapshotHydrator";
import { saveAiStudioProjectWorkspaceSnapshotViaApi } from "../logic/projectWorkspaceApiClient";
import type { AiStudioSessionPersistenceController } from "./useAiStudioSessionPersistenceController";
import { useAiStudioSessionWriteShadow } from "./useAiStudioSessionWriteShadow";
import { useAiStudioProjectWorkspaceRestoreCandidate } from "./useAiStudioProjectWorkspaceRestoreCandidate";
import { useAiStudioProjectWorkspaceRestoreHydration } from "./useAiStudioProjectWorkspaceRestoreHydration";
import { resetAiStudioOutputStore } from "./aiStudioOutputStore";
import type { AiStudioSessionCanvasState } from "../logic/sessionSnapshotCanvas";

type UseAiStudioProjectWorkspacePersistenceControllerParams = {
  projectId: string | null;
  projectRouteRequested?: boolean;
  sessionId: string | null;
  buildSessionSnapshot: (sessionId: string) => AiStudioSessionSnapshot;
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
  buildSessionSnapshot,
  hydrateFromSessionSnapshot,
  hydrateFromSessionCanvasSnapshot,
  hydrateFromSessionExpertEditSnapshot,
  applyEmptyProjectState,
  resetProjectAgentConversation,
  onPersistenceWarning,
}: UseAiStudioProjectWorkspacePersistenceControllerParams): AiStudioSessionPersistenceController => {
  const [bootstrappedProjectId, setBootstrappedProjectId] = useState<string | null>(null);
  const invalidatedAuthorityRef = useRef<string | null>(null);
  const projectRuntimeAuthority = projectRouteRequested
    ? projectId
      ? `project:${projectId}`
      : "project:pending"
    : null;
  const sessionRestoreCandidate = useAiStudioProjectWorkspaceRestoreCandidate({
    projectId,
    enabled: Boolean(projectId),
  });
  const projectBootstrapReady =
    Boolean(projectId) &&
    sessionRestoreCandidate.status === "ready" &&
    bootstrappedProjectId === projectId;
  const sessionSnapshot = useMemo(
    () =>
      sessionId && projectBootstrapReady
        ? createAiStudioProjectWorkspaceSnapshot(buildSessionSnapshot(sessionId))
        : null,
    [buildSessionSnapshot, projectBootstrapReady, sessionId]
  );

  useEffect(() => {
    if (!projectRuntimeAuthority) {
      invalidatedAuthorityRef.current = null;
      setBootstrappedProjectId(null);
      return;
    }
    if (invalidatedAuthorityRef.current === projectRuntimeAuthority) return;
    invalidatedAuthorityRef.current = projectRuntimeAuthority;
    setBootstrappedProjectId(null);
    // Fail closed for decoupled selector-store surfaces before async restore finishes.
    resetAiStudioOutputStore();
    applyEmptyProjectState?.();
  }, [applyEmptyProjectState, projectRuntimeAuthority]);

  useAiStudioProjectWorkspaceRestoreHydration({
    projectId,
    projectWorkspaceRestoreCandidate: sessionRestoreCandidate,
    hydrateFromSessionSnapshot,
    hydrateFromSessionCanvasSnapshot,
    hydrateFromSessionExpertEditSnapshot,
    applyEmptyProjectState,
    resetProjectAgentConversation,
    onProjectBootstrapSettled: setBootstrappedProjectId,
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

  useAiStudioSessionWriteShadow({
    sessionId: projectId,
    snapshot: sessionSnapshot,
    enabled: projectBootstrapReady,
    persistSnapshot: (activeProjectId, snapshot, options) =>
      persistProjectWorkspaceSnapshot(activeProjectId, snapshot, {
        keepalive: options?.keepalive,
      }),
    resolveSnapshotTitle: () => null,
    onPersistError: (error, details) => {
      onPersistenceWarning?.(
        resolveProjectPersistenceWarningMessage({
          reason: details.reason,
          snapshotBytes: details.snapshotBytes,
          maxSnapshotBytes: details.maxSnapshotBytes,
          error,
        })
      );
    },
  });

  return {
    sessionId,
    sessionSnapshot,
    sessionRestoreCandidate,
    setSkipRestoreApplyForSessionId: () => undefined,
    projectBootstrapApplied: projectBootstrapReady,
    projectBootstrapError:
      sessionRestoreCandidate.status === "error" ? sessionRestoreCandidate.error : null,
    retryProjectBootstrap: sessionRestoreCandidate.retry,
  };
};
