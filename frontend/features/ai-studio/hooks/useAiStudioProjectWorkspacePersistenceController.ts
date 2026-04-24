/**
 * AI Studio project-workspace persistence controller.
 * Orchestrates project-owned restore/apply and debounced write shadow against project workspace authority.
 */
import { useCallback, useMemo } from "react";
import type { AiStudioSessionSnapshot } from "../logic/sessionSnapshot";
import type { AiStudioSessionHydrationPayload } from "../logic/sessionSnapshotHydrator";
import { saveAiStudioProjectWorkspaceSnapshotViaApi } from "../logic/projectWorkspaceApiClient";
import { useAiStudioSessionWriteShadow } from "./useAiStudioSessionWriteShadow";
import { useAiStudioProjectWorkspaceRestoreCandidate } from "./useAiStudioProjectWorkspaceRestoreCandidate";
import { useAiStudioProjectWorkspaceRestoreHydration } from "./useAiStudioProjectWorkspaceRestoreHydration";

type UseAiStudioProjectWorkspacePersistenceControllerParams = {
  projectId: string | null;
  sessionId: string | null;
  buildSessionSnapshot: (sessionId: string) => AiStudioSessionSnapshot;
  hydrateFromSessionSnapshot: (
    snapshot: AiStudioSessionSnapshot
  ) => AiStudioSessionHydrationPayload;
  hydrateFromSessionAgentSnapshot: (
    payload: Pick<AiStudioSessionHydrationPayload, "workspace" | "agent" | "agentRuntimes">
  ) => void;
  hydrateFromSessionExpertEditSnapshot?: (
    expertEdit: AiStudioSessionHydrationPayload["expertEdit"]
  ) => void;
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
  sessionId,
  buildSessionSnapshot,
  hydrateFromSessionSnapshot,
  hydrateFromSessionAgentSnapshot,
  hydrateFromSessionExpertEditSnapshot,
  onPersistenceWarning,
}: UseAiStudioProjectWorkspacePersistenceControllerParams) => {
  const sessionSnapshot = useMemo(
    () => (projectId && sessionId ? buildSessionSnapshot(sessionId) : null),
    [buildSessionSnapshot, projectId, sessionId]
  );

  const sessionRestoreCandidate = useAiStudioProjectWorkspaceRestoreCandidate({
    projectId,
    enabled: Boolean(projectId),
  });

  useAiStudioProjectWorkspaceRestoreHydration({
    projectId,
    projectWorkspaceRestoreCandidate: sessionRestoreCandidate,
    hydrateFromSessionSnapshot,
    hydrateFromSessionAgentSnapshot,
    hydrateFromSessionExpertEditSnapshot,
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
    enabled: Boolean(projectId),
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
  };
};
