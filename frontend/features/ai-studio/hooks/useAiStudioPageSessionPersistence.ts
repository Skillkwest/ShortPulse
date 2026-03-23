/**
 * AI Studio page session-persistence bridge.
 * Keeps page-owned snapshot wiring and warning hydration out of the page component while preserving the existing controller contract.
 */
import { useCallback } from "react";
import type { AgentMessage } from "../../ai-agent/types";
import type { PromptOrigin } from "../logic/agentPromptOwnership";
import type { AiStudioSessionSnapshot } from "../logic/sessionSnapshot";
import type { AiStudioSessionCanvasState } from "../logic/sessionSnapshotCanvas";
import type { AiStudioSessionHydrationPayload } from "../logic/sessionSnapshotHydrator";
import { useAiStudioSessionPersistenceController } from "./useAiStudioSessionPersistenceController";

type BuildPageSessionSnapshotArgs = {
  sessionId: string;
  agentMessages: AgentMessage[];
  agentInput: string;
  latestAgentPrompt: string | null;
  promptOrigin: PromptOrigin;
  chatModeEnabled: boolean;
  canvasState: AiStudioSessionCanvasState;
};

type UseAiStudioPageSessionPersistenceParams = {
  sessionId: string | null;
  buildSessionSnapshot: (args: BuildPageSessionSnapshotArgs) => AiStudioSessionSnapshot;
  agentMessages: AgentMessage[];
  agentInput: string;
  latestAgentPrompt: string | null;
  promptOrigin: PromptOrigin;
  chatModeEnabled: boolean;
  canvasSessionState: AiStudioSessionCanvasState;
  hydrateFromSessionSnapshot: (
    snapshot: AiStudioSessionSnapshot
  ) => AiStudioSessionHydrationPayload;
  hydrateFromSessionAgentSnapshot: (agent: AiStudioSessionHydrationPayload["agent"]) => void;
  hydrateSessionState: (snapshot: AiStudioSessionCanvasState) => void;
  setUiNotice: (message: string | null) => void;
};

/**
 * Wires AI Studio page state into the shared session-persistence controller.
 */
export const useAiStudioPageSessionPersistence = ({
  sessionId,
  buildSessionSnapshot,
  agentMessages,
  agentInput,
  latestAgentPrompt,
  promptOrigin,
  chatModeEnabled,
  canvasSessionState,
  hydrateFromSessionSnapshot,
  hydrateFromSessionAgentSnapshot,
  hydrateSessionState,
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
        canvasState: canvasSessionState,
      }),
    [
      agentInput,
      agentMessages,
      buildSessionSnapshot,
      canvasSessionState,
      chatModeEnabled,
      latestAgentPrompt,
      promptOrigin,
    ]
  );

  const hydrateFromSessionCanvasSnapshot = useCallback(
    (canvasPayload: AiStudioSessionHydrationPayload["canvas"]) => {
      if (!canvasPayload) return;
      hydrateSessionState(canvasPayload);
    },
    [hydrateSessionState]
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
    hydrateFromSessionSnapshot,
    hydrateFromSessionAgentSnapshot,
    hydrateFromSessionCanvasSnapshot,
    onPersistenceWarning: handleSessionPersistenceWarning,
  });
};
