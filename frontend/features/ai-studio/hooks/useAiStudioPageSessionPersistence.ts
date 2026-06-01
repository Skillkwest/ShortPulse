/**
 * AI Studio page session-persistence bridge.
 * Keeps page-owned snapshot wiring and warning hydration out of the page component while preserving the existing controller contract.
 */
import { useCallback, useMemo } from "react";
import type {
  AiStudioSessionAgentV1,
  AiStudioSessionAgentRuntimesV2,
  AiStudioSessionSnapshot,
} from "../logic/sessionSnapshot";
import type { AiStudioSessionHydrationPayload } from "../logic/sessionSnapshotHydrator";
import { useAiStudioProjectWorkspacePersistenceController } from "./useAiStudioProjectWorkspacePersistenceController";
import type { AiStudioSessionCanvasState } from "../logic/sessionSnapshotCanvas";
import type { AiStudioPersistenceController } from "./aiStudioPersistenceControllerContract";

type BuildPageSessionSnapshotArgs = {
  sessionId: string;
  agentRuntime: AiStudioSessionAgentV1;
  agentRuntimes?: AiStudioSessionAgentRuntimesV2;
};

type StandardCreatePersistenceRuntime = {
  kind: "standard";
  agentRuntime: AiStudioSessionAgentV1;
  agentRuntimes?: AiStudioSessionAgentRuntimesV2;
};

type PulseCreatePersistenceRuntime = {
  kind: "pulse";
  agentRuntime: AiStudioSessionAgentV1;
  agentRuntimes: AiStudioSessionAgentRuntimesV2;
};

type CreatePersistenceRuntime = StandardCreatePersistenceRuntime | PulseCreatePersistenceRuntime;

type UseAiStudioPageSessionPersistenceParams = {
  projectId?: string | null;
  projectBootstrapId?: string | null;
  projectRouteRequested?: boolean;
  sessionId: string | null;
  sessionTitleOverride?: string | null;
  buildBaseSessionSnapshot: (args: BuildPageSessionSnapshotArgs) => AiStudioSessionSnapshot;
  patchSessionSnapshot?: (snapshot: AiStudioSessionSnapshot) => AiStudioSessionSnapshot;
  createPersistenceRuntime: CreatePersistenceRuntime;
  hydrateFromSessionSnapshot: (
    snapshot: AiStudioSessionSnapshot
  ) => AiStudioSessionHydrationPayload;
  hydrateFromSessionAgentSnapshot: (
    payload: Pick<AiStudioSessionHydrationPayload, "workspace" | "agent" | "agentRuntimes">
  ) => void;
  hydrateFromSessionCanvasSnapshot?: (canvas: AiStudioSessionCanvasState | null) => void;
  applyEmptyProjectState?: () => void;
  resetProjectAgentConversation?: () => void;
  setUiNotice: (message: string | null) => void;
};

/**
 * Wires AI Studio page state into the project workspace persistence controller.
 * Non-project `sid` sessions keep runtime identity only and do not restore/autosave.
 */
export const useAiStudioPageSessionPersistence = ({
  projectId = null,
  projectBootstrapId = projectId,
  projectRouteRequested = false,
  sessionId,
  sessionTitleOverride,
  buildBaseSessionSnapshot,
  patchSessionSnapshot,
  createPersistenceRuntime,
  hydrateFromSessionSnapshot,
  hydrateFromSessionAgentSnapshot,
  hydrateFromSessionCanvasSnapshot,
  applyEmptyProjectState,
  resetProjectAgentConversation,
  setUiNotice,
}: UseAiStudioPageSessionPersistenceParams) => {
  const buildSessionSnapshotForSessionId = useMemo(
    () => (activeSessionId: string) =>
      buildBaseSessionSnapshot({
        sessionId: activeSessionId,
        agentRuntime: createPersistenceRuntime.agentRuntime,
        ...(createPersistenceRuntime.agentRuntimes
          ? { agentRuntimes: createPersistenceRuntime.agentRuntimes }
          : {}),
      }),
    [buildBaseSessionSnapshot, createPersistenceRuntime]
  );
  const patchSessionSnapshotForPersistence = useMemo(
    () =>
      patchSessionSnapshot ? patchSessionSnapshot : (snapshot: AiStudioSessionSnapshot) => snapshot,
    [patchSessionSnapshot]
  );

  const handleSessionPersistenceWarning = useCallback(
    (message: string) => {
      setUiNotice(message);
    },
    [setUiNotice]
  );

  const projectWorkspacePersistence = useAiStudioProjectWorkspacePersistenceController({
    projectId: projectBootstrapId,
    projectRouteRequested,
    sessionId,
    buildBaseSessionSnapshot: buildSessionSnapshotForSessionId,
    patchSessionSnapshot: patchSessionSnapshotForPersistence,
    hydrateFromSessionSnapshot,
    hydrateFromSessionAgentSnapshot,
    hydrateFromSessionCanvasSnapshot,
    applyEmptyProjectState,
    resetProjectAgentConversation,
    onPersistenceWarning: handleSessionPersistenceWarning,
  });

  const inertSessionPersistence: AiStudioPersistenceController = {
    sessionId: projectBootstrapId || projectRouteRequested ? null : sessionId,
    sessionSnapshot: null,
    sessionRestoreCandidate: {
      status: "idle",
      result: "idle",
      snapshot: null,
      source: "none",
      error: null,
      retry: () => undefined,
    },
    setSkipRestoreApplyForSessionId: () => undefined,
    projectBootstrapSettled: true,
    projectBootstrapApplied: true,
    projectBootstrapError: null,
    retryProjectBootstrap: () => undefined,
    resetProjectWorkspace: async () => undefined,
  };

  void sessionTitleOverride;
  void hydrateFromSessionSnapshot;
  void hydrateFromSessionCanvasSnapshot;
  void handleSessionPersistenceWarning;

  return projectBootstrapId || projectRouteRequested
    ? projectWorkspacePersistence
    : inertSessionPersistence;
};
