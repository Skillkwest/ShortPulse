/**
 * AI Studio page session-persistence bridge.
 * Keeps page-owned snapshot wiring and warning hydration out of the page component while preserving the existing controller contract.
 */
import { useCallback, useMemo, useRef, type Dispatch, type SetStateAction } from "react";
import type {
  AiStudioSessionAgentV1,
  AiStudioSessionAgentRuntimesV2,
  AiStudioSessionSnapshot,
} from "../logic/sessionSnapshot";
import type { AiStudioSessionHydrationPayload } from "../logic/sessionSnapshotHydrator";
import {
  useAiStudioProjectWorkspacePersistenceController,
  type ProjectWorkspaceAutosaveNoticeDetails,
} from "./useAiStudioProjectWorkspacePersistenceController";
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
  isAutosaveWorkDeferred?: boolean;
  immediateSaveSignal?: string | number | null;
  applyEmptyProjectState?: () => void;
  resetProjectAgentConversation?: () => void;
  setUiNotice: Dispatch<SetStateAction<string | null>>;
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
  isAutosaveWorkDeferred = false,
  immediateSaveSignal = null,
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
  const activeAutosaveNoticeMessageRef = useRef<string | null>(null);

  const handleSessionPersistenceWarning = useCallback(
    (message: string | null, details: ProjectWorkspaceAutosaveNoticeDetails) => {
      if (message) {
        activeAutosaveNoticeMessageRef.current = message;
        setUiNotice(message);
        return;
      }
      if (!details.recovered) return;
      const ownedMessage = activeAutosaveNoticeMessageRef.current;
      activeAutosaveNoticeMessageRef.current = null;
      if (!ownedMessage) return;
      setUiNotice((current) => (current === ownedMessage ? null : current));
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
    isAutosaveWorkDeferred,
    immediateSaveSignal,
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
