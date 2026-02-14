import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { AgentActions, AgentMessage } from "../../../prefabs/agent";
import { normalizePromptText, type PromptOrigin } from "../logic/agentPromptOwnership";

type UseAiStudioAgentInteractionsParams = {
  editPromptToolSelected: boolean;
  setSharedPrompt: (value: string) => void;
  setLatestAgentPrompt: Dispatch<SetStateAction<string | null>>;
  setPromptOrigin: Dispatch<SetStateAction<PromptOrigin>>;
  trackAgentUiEvent: (message: string, data?: Record<string, unknown>) => void;
  setAgentInput: Dispatch<SetStateAction<string>>;
  addAgentPromptReference: (promptText: string, title?: string) => void;
  setIsAgentChatOpen: Dispatch<SetStateAction<boolean>>;
  agentSessionEnabled: boolean;
  setAgentSessionEnabled: Dispatch<SetStateAction<boolean>>;
  latestAgentPrompt: string | null;
  agentActions: AgentActions | undefined;
  resetAgentChat: () => void;
  resetAgentComposer: () => void;
  setAgentActions: Dispatch<SetStateAction<AgentActions | undefined>>;
};

export const useAiStudioAgentInteractions = ({
  editPromptToolSelected,
  setSharedPrompt,
  setLatestAgentPrompt,
  setPromptOrigin,
  trackAgentUiEvent,
  setAgentInput,
  addAgentPromptReference,
  setIsAgentChatOpen,
  agentSessionEnabled,
  setAgentSessionEnabled,
  latestAgentPrompt,
  agentActions,
  resetAgentChat,
  resetAgentComposer,
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

  const handleAgentSelectVariation = useCallback(
    (variation: string) => {
      const normalized = normalizePromptText(variation);
      if (!normalized) return;
      setAgentInput(normalized);
      handleAgentApplyPrompt(normalized);
      trackAgentUiEvent("studio_agent_select_variation");
    },
    [handleAgentApplyPrompt, setAgentInput, trackAgentUiEvent]
  );

  const handleAgentUseQuestion = useCallback(
    (question: string) => {
      const normalized = normalizePromptText(question);
      if (!normalized) return;
      setAgentInput(normalized);
      trackAgentUiEvent("studio_agent_use_question");
    },
    [setAgentInput, trackAgentUiEvent]
  );

  const handleAgentMessageClick = useCallback(
    (message: AgentMessage) => {
      const normalizedMessagePrompt = normalizePromptText(message.content);
      if (!normalizedMessagePrompt) return;
      if (message.role === "assistant") {
        setLatestAgentPrompt(normalizedMessagePrompt);
        setPromptOrigin("agent");
      } else {
        setPromptOrigin("manual");
      }
      addAgentPromptReference(message.content);
      setIsAgentChatOpen(false);
    },
    [addAgentPromptReference, setIsAgentChatOpen, setLatestAgentPrompt, setPromptOrigin]
  );

  const handleExpandChat = useCallback(() => {
    if (!agentSessionEnabled) setAgentSessionEnabled(true);
    setIsAgentChatOpen((prev) => !prev);
  }, [agentSessionEnabled, setAgentSessionEnabled, setIsAgentChatOpen]);

  const handleAgentAddToGrid = useCallback(() => {
    if (latestAgentPrompt) {
      addAgentPromptReference(latestAgentPrompt, agentActions?.referenceCard?.title);
      setPromptOrigin("agent");
      trackAgentUiEvent("studio_agent_add_to_grid");
    }
    setIsAgentChatOpen(false);
  }, [
    addAgentPromptReference,
    agentActions?.referenceCard?.title,
    latestAgentPrompt,
    setIsAgentChatOpen,
    setPromptOrigin,
    trackAgentUiEvent,
  ]);

  const handleClearAgentChat = useCallback(() => {
    resetAgentChat();
    resetAgentComposer();
    setLatestAgentPrompt(null);
    setPromptOrigin("manual");
    setAgentActions(undefined);
    setIsAgentChatOpen(false);
    trackAgentUiEvent("studio_agent_chat_cleared");
  }, [
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
    handleAgentSelectVariation,
    handleAgentUseQuestion,
    handleAgentMessageClick,
    handleExpandChat,
    handleAgentAddToGrid,
    handleClearAgentChat,
    handleCloseAgentChat,
  };
};
