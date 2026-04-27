/**
 * AI Studio page session-persistence bridge.
 * Keeps page-owned snapshot wiring and warning hydration out of the page component while preserving the existing controller contract.
 */
import { useCallback } from "react";
import type { AgentMessage } from "../../ai-agent/types";
import type { AgentPulseWorkflowSession } from "../../../prefabs/agent";
import type { PromptOrigin } from "../logic/agentPromptOwnership";
import type {
  AiStudioSessionAgentRuntimesV2,
  AiStudioSessionSnapshot,
} from "../logic/sessionSnapshot";
import type { AiStudioSessionHydrationPayload } from "../logic/sessionSnapshotHydrator";
import { useAiStudioSessionPersistenceController } from "./useAiStudioSessionPersistenceController";
import { useAiStudioProjectWorkspacePersistenceController } from "./useAiStudioProjectWorkspacePersistenceController";
import type { ExpertEditSessionState } from "../components/edit/expertEditSessionState";
import type { AiStudioSessionCanvasState } from "../logic/sessionSnapshotCanvas";

type BuildPageSessionSnapshotArgs = {
  sessionId: string;
  agentMessages: AgentMessage[];
  agentInput: string;
  latestAgentPrompt: string | null;
  promptOrigin: PromptOrigin;
  chatModeEnabled: boolean;
  pulseWorkflowSession?: AgentPulseWorkflowSession | null;
  agentRuntimes?: AiStudioSessionAgentRuntimesV2;
  expertEditSessionState?: ExpertEditSessionState | null;
};

type UseAiStudioPageSessionPersistenceParams = {
  projectId?: string | null;
  projectRouteRequested?: boolean;
  sessionId: string | null;
  sessionTitleOverride?: string | null;
  buildSessionSnapshot: (args: BuildPageSessionSnapshotArgs) => AiStudioSessionSnapshot;
  agentMessages: AgentMessage[];
  agentInput: string;
  latestAgentPrompt: string | null;
  promptOrigin: PromptOrigin;
  chatModeEnabled: boolean;
  pulseWorkflowSession?: AgentPulseWorkflowSession | null;
  agentRuntimes?: AiStudioSessionAgentRuntimesV2;
  expertEditSessionState?: ExpertEditSessionState | null;
  hydrateFromSessionSnapshot: (
    snapshot: AiStudioSessionSnapshot
  ) => AiStudioSessionHydrationPayload;
  hydrateFromSessionAgentSnapshot: (
    payload: Pick<AiStudioSessionHydrationPayload, "workspace" | "agent" | "agentRuntimes">
  ) => void;
  hydrateFromSessionCanvasSnapshot?: (canvas: AiStudioSessionCanvasState | null) => void;
  hydrateFromSessionExpertEditSnapshot?: (
    expertEdit: AiStudioSessionHydrationPayload["expertEdit"]
  ) => void;
  applyEmptyProjectState?: () => void;
  resetProjectAgentConversation?: () => void;
  setUiNotice: (message: string | null) => void;
};

/**
 * Wires AI Studio page state into the shared session-persistence controller.
 */
export const useAiStudioPageSessionPersistence = ({
  projectId = null,
  projectRouteRequested = false,
  sessionId,
  sessionTitleOverride,
  buildSessionSnapshot,
  agentMessages,
  agentInput,
  latestAgentPrompt,
  promptOrigin,
  chatModeEnabled,
  pulseWorkflowSession,
  agentRuntimes,
  expertEditSessionState,
  hydrateFromSessionSnapshot,
  hydrateFromSessionAgentSnapshot,
  hydrateFromSessionCanvasSnapshot,
  hydrateFromSessionExpertEditSnapshot,
  applyEmptyProjectState,
  resetProjectAgentConversation,
  setUiNotice,
}: UseAiStudioPageSessionPersistenceParams) => {
  const buildSessionSnapshotForSessionId = useCallback(
    (activeSessionId: string) =>
      buildSessionSnapshot({
        sessionId: activeSessionId,
        agentMessages,
        agentInput,
        latestAgentPrompt,
        promptOrigin,
        chatModeEnabled,
        pulseWorkflowSession,
        agentRuntimes,
        expertEditSessionState,
      }),
    [
      agentInput,
      agentMessages,
      buildSessionSnapshot,
      chatModeEnabled,
      expertEditSessionState,
      agentRuntimes,
      latestAgentPrompt,
      pulseWorkflowSession,
      promptOrigin,
    ]
  );

  const handleSessionPersistenceWarning = useCallback(
    (message: string) => {
      setUiNotice(message);
    },
    [setUiNotice]
  );

  const projectWorkspacePersistence = useAiStudioProjectWorkspacePersistenceController({
    projectId,
    projectRouteRequested,
    sessionId,
    buildSessionSnapshot: buildSessionSnapshotForSessionId,
    hydrateFromSessionSnapshot,
    hydrateFromSessionCanvasSnapshot,
    hydrateFromSessionExpertEditSnapshot,
    applyEmptyProjectState,
    resetProjectAgentConversation,
    onPersistenceWarning: handleSessionPersistenceWarning,
  });

  const sessionPersistence = useAiStudioSessionPersistenceController({
    sessionId: projectId || projectRouteRequested ? null : sessionId,
    buildSessionSnapshot: buildSessionSnapshotForSessionId,
    sessionTitleOverride,
    hydrateFromSessionSnapshot,
    hydrateFromSessionAgentSnapshot,
    hydrateFromSessionCanvasSnapshot,
    hydrateFromSessionExpertEditSnapshot,
    onPersistenceWarning: handleSessionPersistenceWarning,
  });

  return projectId || projectRouteRequested ? projectWorkspacePersistence : sessionPersistence;
};
