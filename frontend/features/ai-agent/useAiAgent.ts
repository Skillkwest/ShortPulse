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
  const persistHistory = useRef<boolean>(persist);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Hydrate from session storage on mount
  useEffect(() => {
    if (!persistHistory.current || typeof window === "undefined") return;
    try {
      const key = `aiAgentChat:${conversationIdRef.current}`;
      const raw = window.sessionStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.messages)) {
        setMessages(parsed.messages as AgentMessage[]);
        messagesRef.current = parsed.messages as AgentMessage[];
      }
    } catch {
      // ignore hydration errors
    }
  }, []);

  // Persist whenever messages change
  useEffect(() => {
    if (!persistHistory.current || typeof window === "undefined") return;
    try {
      const key = `aiAgentChat:${conversationIdRef.current}`;
      window.sessionStorage.setItem(key, JSON.stringify({ messages }));
    } catch {
      // ignore persist errors
    }
  }, [messages]);

  const send = useCallback(
    async ({ text, context }: SendParams): Promise<SendResult> => {
      if (!enabled) {
        setError("Agent is disabled");
        return { response: null, actions: undefined };
      }
      const trimmed = text.trim();
      if (!trimmed) {
        return { response: null, actions: undefined };
      }

      const userMessage: AgentMessage = { role: "user", content: trimmed };
      const nextMessages = [...messagesRef.current, userMessage].slice(-24);
      setMessages(nextMessages);
      messagesRef.current = nextMessages;
      setIsSending(true);
      setError(null);

      try {
        const body: AgentApiRequest = {
          messages: nextMessages.length ? nextMessages : messagesRef.current,
          context: context ? buildAgentContext(context) : undefined,
          conversationId: conversationIdRef.current,
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
