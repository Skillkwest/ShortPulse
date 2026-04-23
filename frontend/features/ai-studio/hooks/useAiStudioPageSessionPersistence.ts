/**
 * AI Studio page session-persistence bridge.
 * Keeps page-owned snapshot wiring and warning hydration out of the page component while preserving the existing controller contract.
 */
import { useCallback } from "react";
import type { AgentMessage } from "../../ai-agent/types";
import type { AgentPulseWorkflowSession } from "../../../prefabs/agent";
import type { PromptOrigin } from "../logic/agentPromptOwnership";
import type { AiStudioSessionSnapshot } from "../logic/sessionSnapshot";
import type { AiStudioSessionHydrationPayload } from "../logic/sessionSnapshotHydrator";
import { useAiStudioSessionPersistenceController } from "./useAiStudioSessionPersistenceController";
import type { ExpertEditSessionState } from "../components/edit/expertEditSessionState";

type BuildPageSessionSnapshotArgs = {
  sessionId: string;
  agentMessages: AgentMessage[];
  agentInput: string;
  latestAgentPrompt: string | null;
  promptOrigin: PromptOrigin;
  chatModeEnabled: boolean;
  pulseWorkflowSession?: AgentPulseWorkflowSession | null;
  expertEditSessionState?: ExpertEditSessionState | null;
};

type UseAiStudioPageSessionPersistenceParams = {
  sessionId: string | null;
  sessionTitleOverride?: string | null;
  buildSessionSnapshot: (args: BuildPageSessionSnapshotArgs) => AiStudioSessionSnapshot;
  agentMessages: AgentMessage[];
  agentInput: string;
  latestAgentPrompt: string | null;
  promptOrigin: PromptOrigin;
  chatModeEnabled: boolean;
  pulseWorkflowSession?: AgentPulseWorkflowSession | null;
  expertEditSessionState?: ExpertEditSessionState | null;
  hydrateFromSessionSnapshot: (
    snapshot: AiStudioSessionSnapshot
  ) => AiStudioSessionHydrationPayload;
  hydrateFromSessionAgentSnapshot: (agent: AiStudioSessionHydrationPayload["agent"]) => void;
  hydrateFromSessionExpertEditSnapshot?: (
    expertEdit: AiStudioSessionHydrationPayload["expertEdit"]
  ) => void;
  setUiNotice: (message: string | null) => void;
};

/**
 * Wires AI Studio page state into the shared session-persistence controller.
 */
export const useAiStudioPageSessionPersistence = ({
  sessionId,
  sessionTitleOverride,
  buildSessionSnapshot,
  agentMessages,
  agentInput,
  latestAgentPrompt,
  promptOrigin,
  chatModeEnabled,
  pulseWorkflowSession,
  expertEditSessionState,
  hydrateFromSessionSnapshot,
  hydrateFromSessionAgentSnapshot,
  hydrateFromSessionExpertEditSnapshot,
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
        expertEditSessionState,
      }),
    [
      agentInput,
      agentMessages,
      buildSessionSnapshot,
      chatModeEnabled,
      expertEditSessionState,
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

  return useAiStudioSessionPersistenceController({
    sessionId,
    buildSessionSnapshot: buildSessionSnapshotForSessionId,
    sessionTitleOverride,
    hydrateFromSessionSnapshot,
    hydrateFromSessionAgentSnapshot,
    hydrateFromSessionExpertEditSnapshot,
    onPersistenceWarning: handleSessionPersistenceWarning,
  });
};
