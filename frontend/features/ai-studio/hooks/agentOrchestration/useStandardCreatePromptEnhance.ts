import { useCallback, useState } from "react";
import { normalizePromptText } from "../../logic/agentPromptOwnership";
import type { UseAiStudioAgentOrchestrationParams } from "./types";

type UseStandardCreatePromptEnhanceParams = Pick<
  UseAiStudioAgentOrchestrationParams,
  | "agentBootstrapReady"
  | "prompt"
  | "latestAgentPrompt"
  | "setLatestAgentPrompt"
  | "setSharedPrompt"
  | "setPromptOrigin"
  | "sendToAgent"
  | "getAgentContext"
  | "addAgentPromptReference"
  | "lastAssistantMessage"
> & {
  notifyBootstrapPending: () => void;
};

const extractAgentResponseMessage = (response: unknown): string | null => {
  if (!response || typeof response !== "object") return null;
  const message = (response as { message?: unknown }).message;
  return typeof message === "string" ? message : null;
};

/**
 * Standard Create prompt enhancement. It owns direct prompt refinement and
 * always uses Standard prompt context.
 */
export const useStandardCreatePromptEnhance = ({
  agentBootstrapReady,
  prompt,
  latestAgentPrompt,
  setLatestAgentPrompt,
  setSharedPrompt,
  setPromptOrigin,
  sendToAgent,
  getAgentContext,
  addAgentPromptReference,
  lastAssistantMessage,
  notifyBootstrapPending,
}: UseStandardCreatePromptEnhanceParams) => {
  const [isPromptRefining, setIsPromptRefining] = useState(false);

  const handleAgentEnhanceSend = useCallback(async () => {
    if (!agentBootstrapReady) {
      notifyBootstrapPending();
      return;
    }
    if (!prompt.trim()) return;
    setIsPromptRefining(true);
    try {
      const context = getAgentContext({
        lastAssistantMessage,
        selectedOverride: null,
        includeActiveOutput: false,
        modeHint: "text",
      });
      const { response, actions, discarded } = await sendToAgent({
        text: prompt,
        payloadText: prompt,
        previousPrompt: latestAgentPrompt ?? null,
        context,
        isolateHistory: true,
        skipUserEcho: true,
      });
      if (discarded) {
        return;
      }
      const refinedPrompt = normalizePromptText(
        actions?.applyPrompt ?? extractAgentResponseMessage(response)
      );
      if (refinedPrompt) {
        setSharedPrompt(refinedPrompt);
        setLatestAgentPrompt(refinedPrompt);
        addAgentPromptReference(refinedPrompt, "Refined prompt");
        setPromptOrigin("agent");
      }
    } finally {
      setIsPromptRefining(false);
    }
  }, [
    addAgentPromptReference,
    agentBootstrapReady,
    getAgentContext,
    lastAssistantMessage,
    latestAgentPrompt,
    notifyBootstrapPending,
    prompt,
    sendToAgent,
    setLatestAgentPrompt,
    setPromptOrigin,
    setSharedPrompt,
  ]);

  return {
    isPromptRefining,
    handleAgentEnhanceSend,
  };
};
