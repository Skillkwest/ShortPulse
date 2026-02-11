/**
 * Hook for interacting with the AI Studio Agent API.
 * Manages chat state locally and exposes a send helper with structured responses.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AgentActions,
  AgentApiRequest,
  AgentContext,
  AgentMessage,
  AgentResponse,
} from "../../prefabs/agent";
import { buildAgentContext } from "./logic/contextBuilder";
import { randomId } from "../ai-studio/logic/ids";
import { fetchWithAuth } from "../../lib/authenticatedFetch";
import { normalizeErrorText } from "../../lib/errorText";

type UseAiAgentOptions = {
  initialMessages?: AgentMessage[];
  enabled?: boolean;
  conversationId?: string;
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

// Stable default to prevent Fast Refresh issues
const EMPTY_MESSAGES: AgentMessage[] = [];

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const normalizeActions = (
  raw?: AgentActions | Record<string, unknown>
): AgentActions | undefined => {
  if (!raw) return undefined;
  const record = toRecord(raw);
  const applyPrompt = record.applyPrompt ?? record.apply_prompt ?? null;
  const referenceCard = record.referenceCard ?? record.reference_card ?? undefined;
  const variations = record.variations ?? undefined;
  const describeTargets = record.describeTargets ?? record.describe_targets ?? undefined;
  const questions = record.questions ?? undefined;
  return {
    applyPrompt: typeof applyPrompt === "string" || applyPrompt === null ? applyPrompt : null,
    referenceCard:
      referenceCard && typeof referenceCard === "object"
        ? (referenceCard as AgentActions["referenceCard"])
        : undefined,
    variations: Array.isArray(variations) ? (variations as string[]) : undefined,
    describeTargets: Array.isArray(describeTargets) ? (describeTargets as string[]) : undefined,
    questions: Array.isArray(questions) ? (questions as string[]) : undefined,
  };
};

export const useAiAgent = ({
  initialMessages = EMPTY_MESSAGES,
  enabled = true,
  conversationId,
}: UseAiAgentOptions = {}) => {
  const [messages, setMessages] = useState<AgentMessage[]>(initialMessages);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesRef = useRef<AgentMessage[]>(initialMessages);
  // Use a stable ref initialization to prevent Fast Refresh issues
  const conversationIdRef = useRef<string>();
  if (!conversationIdRef.current) {
    conversationIdRef.current = conversationId || randomId();
  }
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

      const previousMessages = messagesRef.current;
      // UI-visible history (keep the user's raw text)
      const uiUserMessage: AgentMessage = { role: "user", content: trimmed };
      const nextUiMessages = [...previousMessages, uiUserMessage].slice(-24);
      setMessages(nextUiMessages);
      messagesRef.current = nextUiMessages;
      setIsSending(true);
      setError(null);

      try {
        const userPayload = payloadText?.trim() || trimmed;
        const baseHistory = previousMessages.slice(-12); // small window for API
        // Canonical prompt is sent separately; avoid duplicating assistant content in the message list.
        void previousPrompt;
        const apiMessages: AgentMessage[] = [
          ...baseHistory,
          { role: "user", content: userPayload } as AgentMessage,
        ];

        const body: AgentApiRequest = {
          messages: apiMessages,
          context: context ? buildAgentContext(context) : undefined,
          conversationId: conversationIdRef.current,
          canonicalPrompt: canonicalPromptRef.current,
        };
        const response = await fetchWithAuth("/api/ai/studio-agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const detail = await response.text();
          setError(
            normalizeErrorText(detail, {
              fallback: `Agent request failed (${response.status})`,
              maxLength: 320,
            })
          );
          return { response: null, actions: undefined };
        }

        const data = (await response.json()) as AgentResponse;
        const actions = normalizeActions(data?.actions);

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
        setError(
          normalizeErrorText(err instanceof Error ? err.message : err, {
            fallback: "Agent request failed",
            maxLength: 320,
          })
        );
        return { response: null, actions: undefined };
      } finally {
        setIsSending(false);
      }
    },
    [enabled]
  );

  const state = useMemo(
    () => ({
      messages,
      isSending,
      error,
    }),
    [messages, isSending, error]
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
