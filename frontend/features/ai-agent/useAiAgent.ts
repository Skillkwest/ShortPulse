/**
 * Hook for interacting with the AI Studio Agent API.
 * Manages chat state locally and exposes a send helper with structured responses.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AgentActions, AgentApiRequest, AgentContext, AgentMessage, AgentResponse } from "./types";
import { postGeneratePrompt } from "../ai-studio/logic/promptGeneration";
import { buildAgentContext } from "./logic/contextBuilder";
import { randomId } from "../ai-studio/logic/ids";

type UseAiAgentOptions = {
  initialMessages?: AgentMessage[];
  enabled?: boolean;
  conversationId?: string;
  persist?: boolean; // session-only persistence of chat history
};

type SendParams = {
  text: string;
  payloadText?: string;
  previousPrompt?: string | null;
  context?: AgentContext;
};

type SendResult = {
  response: AgentResponse | null;
  actions: AgentActions | undefined;
};

export const useAiAgent = ({ initialMessages = [], enabled = true, conversationId, persist = true }: UseAiAgentOptions = {}) => {
  const [messages, setMessages] = useState<AgentMessage[]>(initialMessages);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesRef = useRef<AgentMessage[]>(initialMessages);
  const conversationIdRef = useRef<string>(conversationId || randomId());
  const canonicalPromptRef = useRef<string | null>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const send = useCallback(
    async ({ text, payloadText, previousPrompt, context }: SendParams): Promise<SendResult> => {
      if (!enabled) {
        setError("Agent is disabled");
        return { response: null, actions: undefined };
      }
      const trimmed = text.trim();
      if (!trimmed) {
        return { response: null, actions: undefined };
      }

      // UI-visible history (keep the user's raw text)
      const uiUserMessage: AgentMessage = { role: "user", content: trimmed };
      const nextUiMessages = [...messagesRef.current, uiUserMessage].slice(-24);
      setMessages(nextUiMessages);
      messagesRef.current = nextUiMessages;
      setIsSending(true);
      setError(null);

      try {
      const userPayload = payloadText?.trim() || trimmed;
      const baseHistory = messagesRef.current.slice(-12); // small window for API
      const syntheticPrev =
        previousPrompt && previousPrompt.trim().length
          ? ({ role: "assistant", content: previousPrompt.trim() } as AgentMessage)
          : null;
      const apiMessages = [...baseHistory, ...(syntheticPrev ? [syntheticPrev] : []), { role: "user", content: userPayload }];

      const body: AgentApiRequest = {
        messages: apiMessages,
        context: context ? buildAgentContext(context) : undefined,
        conversationId: conversationIdRef.current,
        canonicalPrompt: canonicalPromptRef.current,
      };
        const response = await fetch("/api/ai/studio-agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const detail = await response.text();
          setError(detail || "Agent request failed");
          return { response: null, actions: undefined };
        }

        let data = (await response.json()) as AgentResponse;
        let actions = data?.actions;

        // Fallback: if agent didn’t supply apply_prompt, run refine to keep UX unblocked.
        if (!actions?.apply_prompt) {
          const refined = await postGeneratePrompt(trimmed);
          if (refined?.prompt) {
            actions = {
              ...actions,
              apply_prompt: refined.prompt,
              reference_card: { title: actions?.reference_card?.title ?? "Refined Prompt", prompt: refined.prompt },
            };
            data = { ...data, actions };
          }
        }

        if (data?.canonicalPrompt) {
          canonicalPromptRef.current = data.canonicalPrompt;
        } else if (actions?.apply_prompt) {
          canonicalPromptRef.current = actions.apply_prompt ?? null;
        }

        const assistantContent = actions?.apply_prompt ?? data?.message ?? "";
        const assistantMessage: AgentMessage = {
          role: "assistant",
          content: assistantContent,
        };
        const nextAssistantMessages = [...messagesRef.current.slice(-23), assistantMessage];
        setMessages(nextAssistantMessages);
        messagesRef.current = nextAssistantMessages;
        return { response: data ?? null, actions };
      } catch (err) {
        setError(typeof err === "string" ? err : "Agent request failed");
        return { response: null, actions: undefined };
      } finally {
        setIsSending(false);
      }
    },
    [enabled],
  );

  const state = useMemo(
    () => ({
      messages,
      isSending,
      error,
    }),
    [messages, isSending, error],
  );

  return { ...state, send };
};
