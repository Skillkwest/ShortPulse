import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { PromptOrigin } from "../logic/agentPromptOwnership";

const DEFAULT_AGENT_PROMPT_REFERENCE_TITLE = "Agent prompt";

type UseAiStudioAgentInteractionsParams = {
  setLatestAgentPrompt: Dispatch<SetStateAction<string | null>>;
  setPromptOrigin: Dispatch<SetStateAction<PromptOrigin>>;
  trackAgentUiEvent: (message: string, data?: Record<string, unknown>) => void;
  addAgentPromptReference: (promptText: string, title?: string) => void;
  setIsAgentChatOpen: Dispatch<SetStateAction<boolean>>;
  agentSessionEnabled: boolean;
  setAgentSessionEnabled: Dispatch<SetStateAction<boolean>>;
  latestAgentPrompt: string | null;
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
  addAgentPromptReference,
  setIsAgentChatOpen,
  agentSessionEnabled,
  setAgentSessionEnabled,
  latestAgentPrompt,
  resetAgentChat,
  resetAgentComposer,
  clearActiveRuntime,
}: UseAiStudioAgentInteractionsParams) => {
  const handleExpandChat = useCallback(() => {
    if (!agentSessionEnabled) setAgentSessionEnabled(true);
    setIsAgentChatOpen((prev) => !prev);
  }, [agentSessionEnabled, setAgentSessionEnabled, setIsAgentChatOpen]);

  const handleAgentAddToGrid = useCallback(() => {
    if (latestAgentPrompt) {
      addAgentPromptReference(latestAgentPrompt, DEFAULT_AGENT_PROMPT_REFERENCE_TITLE);
      setPromptOrigin("agent");
      trackAgentUiEvent("studio_agent_add_to_grid");
    }
    setIsAgentChatOpen(false);
  }, [
    addAgentPromptReference,
    latestAgentPrompt,
    setIsAgentChatOpen,
    setPromptOrigin,
    trackAgentUiEvent,
  ]);

  const handleClearAgentChat = useCallback(() => {
    resetAgentChat();
    resetAgentComposer({ preserveAttachments: false });
    setLatestAgentPrompt(null);
    setPromptOrigin("manual");
    clearActiveRuntime?.();
    setIsAgentChatOpen(false);
    trackAgentUiEvent("studio_agent_chat_cleared");
  }, [
    clearActiveRuntime,
    resetAgentChat,
    resetAgentComposer,
    setLatestAgentPrompt,
    setPromptOrigin,
    setIsAgentChatOpen,
    trackAgentUiEvent,
  ]);

  const handleCloseAgentChat = useCallback(() => {
    setIsAgentChatOpen(false);
  }, [setIsAgentChatOpen]);

  return {
    handleExpandChat,
    handleAgentAddToGrid,
    handleClearAgentChat,
    handleCloseAgentChat,
  };
};
