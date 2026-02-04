/**
 * Hook for interacting with the AI Studio Agent API.
 * Manages chat state locally and exposes a send helper with structured responses.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AgentActions, AgentApiRequest, AgentContext, AgentMessage, AgentResponse } from "../../prefabs/agent";
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

const normalizeActions = (raw?: AgentActions | Record<string, any>): AgentActions | undefined => {
  if (!raw) return undefined;
  const applyPrompt = (raw as any).applyPrompt ?? (raw as any).apply_prompt ?? null;
  const referenceCard = (raw as any).referenceCard ?? (raw as any).reference_card ?? undefined;
  const variations = (raw as any).variations ?? undefined;
  const describeTargets = (raw as any).describeTargets ?? (raw as any).describe_targets ?? undefined;
  const questions = (raw as any).questions ?? undefined;
  return {
    applyPrompt,
    referenceCard,
    variations,
    describeTargets,
    questions,
  };
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
        let actions = normalizeActions(data?.actions);

        if (data?.canonicalPrompt) {
          canonicalPromptRef.current = data.canonicalPrompt;
        } else if (actions?.applyPrompt) {
          canonicalPromptRef.current = actions.applyPrompt ?? null;
        }

        // The agent’s role here is to refine/iterate prompts. Always surface the refined prompt in the chat thread.
        const applyPromptText = actions?.applyPrompt?.trim() ?? "";
        const messageText = data?.message?.trim() ?? "";
        const assistantContent = applyPromptText || messageText;

        if (assistantContent) {
          const assistantMessage: AgentMessage = { role: "assistant", content: assistantContent };
          const nextAssistantMessages = [...messagesRef.current.slice(-23), assistantMessage];
          setMessages(nextAssistantMessages);
          messagesRef.current = nextAssistantMessages;
        }
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

  const reset = useCallback(() => {
    setMessages([]);
    messagesRef.current = [];
    canonicalPromptRef.current = null;
    conversationIdRef.current = randomId();
    setError(null);
  }, []);

  return { ...state, send, reset };
};
