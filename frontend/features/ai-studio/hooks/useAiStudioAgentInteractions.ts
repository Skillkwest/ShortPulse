import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { AgentActions } from "../../../prefabs/agent";
import { normalizePromptText, type PromptOrigin } from "../logic/agentPromptOwnership";

const DEFAULT_AGENT_PROMPT_REFERENCE_TITLE = "Agent prompt";

type UseAiStudioAgentInteractionsParams = {
  expertCreateMode: "standard" | "pulse";
  editPromptToolSelected: boolean;
  setSharedPrompt: (value: string) => void;
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
  clearPulseRuntime?: () => void;
  setAgentActions: Dispatch<SetStateAction<AgentActions | undefined>>;
};

export const useAiStudioAgentInteractions = ({
  expertCreateMode,
  editPromptToolSelected,
  setSharedPrompt,
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
  clearPulseRuntime,
  setAgentActions,
}: UseAiStudioAgentInteractionsParams) => {
  const handleAgentApplyPrompt = useCallback(
    (nextPrompt: string) => {
      if (editPromptToolSelected) return;
      const normalized = normalizePromptText(nextPrompt);
      if (!normalized) return;
      setSharedPrompt(normalized);
      setLatestAgentPrompt(normalized);
      setPromptOrigin("agent");
      trackAgentUiEvent("studio_agent_apply_prompt");
    },
    [
      editPromptToolSelected,
      setLatestAgentPrompt,
      setPromptOrigin,
      setSharedPrompt,
      trackAgentUiEvent,
    ]
  );

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
    setAgentActions(undefined);
    if (expertCreateMode === "pulse") {
      clearPulseRuntime?.();
    }
    setIsAgentChatOpen(false);
    trackAgentUiEvent("studio_agent_chat_cleared");
  }, [
    clearPulseRuntime,
    expertCreateMode,
    resetAgentChat,
    resetAgentComposer,
    setLatestAgentPrompt,
    setPromptOrigin,
    setAgentActions,
    setIsAgentChatOpen,
    trackAgentUiEvent,
  ]);

  const handleCloseAgentChat = useCallback(() => {
    setIsAgentChatOpen(false);
  }, [setIsAgentChatOpen]);

  return {
    handleAgentApplyPrompt,
    handleExpandChat,
    handleAgentAddToGrid,
    handleClearAgentChat,
    handleCloseAgentChat,
  };
};
