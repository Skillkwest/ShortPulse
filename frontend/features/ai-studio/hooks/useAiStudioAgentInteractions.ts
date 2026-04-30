import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { PromptOrigin } from "../logic/agentPromptOwnership";

type UseAiStudioAgentInteractionsParams = {
  setLatestAgentPrompt: Dispatch<SetStateAction<string | null>>;
  setPromptOrigin: Dispatch<SetStateAction<PromptOrigin>>;
  trackAgentUiEvent: (message: string, data?: Record<string, unknown>) => void;
  resetAgentChat: () => void;
  resetAgentComposer: (options?: {
    preserveInput?: boolean;
    preserveAttachments?: boolean;
  }) => void;
  clearActiveRuntime?: () => void;
};

export const useAiStudioAgentInteractions = ({
  setLatestAgentPrompt,
  setPromptOrigin,
  trackAgentUiEvent,
  resetAgentChat,
  resetAgentComposer,
  clearActiveRuntime,
}: UseAiStudioAgentInteractionsParams) => {
  const handleClearAgentChat = useCallback(() => {
    resetAgentChat();
    resetAgentComposer({ preserveAttachments: false });
    setLatestAgentPrompt(null);
    setPromptOrigin("manual");
    clearActiveRuntime?.();
    trackAgentUiEvent("studio_agent_chat_cleared");
  }, [
    clearActiveRuntime,
    resetAgentChat,
    resetAgentComposer,
    setLatestAgentPrompt,
    setPromptOrigin,
    trackAgentUiEvent,
  ]);

  return {
    handleClearAgentChat,
  };
};
