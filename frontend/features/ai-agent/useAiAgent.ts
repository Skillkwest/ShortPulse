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
import { removeAspectRatioLanguage, sanitizeGenerationPromptText } from "../agent-core/promptText";
import { buildAgentContext } from "./logic/contextBuilder";
import { normalizeErrorText } from "../../lib/errorText";
import { normalizeActions } from "./client/actionNormalizer";
import {
  appendAssistantMessage,
  appendUiMessage,
  buildApiMessagesForTurn,
  updateUiMessageById,
} from "./client/messageStore";
import { ensureSessionKey, persistSessionKey, randomId } from "./client/sessionController";
import { sendStudioAgentTurn } from "./client/studioAgentTransport";

type UseAiAgentOptions = {
  initialMessages?: AgentMessage[];
  enabled?: boolean;
  conversationId?: string;
  sessionNamespace?: string;
};

type SendParams = {
  text: string;
  payloadText?: string;
  previousPrompt?: string | null;
  context?: AgentContext;
  skipUserEcho?: boolean;
  optimisticUserMessageId?: string | null;
};

type SendResult = {
  response: AgentResponse | null;
  actions: AgentActions | undefined;
};

// Stable default to prevent Fast Refresh issues
const EMPTY_MESSAGES: AgentMessage[] = [];
const SAFETY_REFUSAL_MESSAGE = "I cannot describe this.";
const createAgentMessageId = (role: "user" | "assistant") => `agent-${role}-${randomId()}`;

const resolveSafetyRefusalText = (value: unknown): typeof SAFETY_REFUSAL_MESSAGE | null => {
  const raw = normalizeErrorText(value, { fallback: "", maxLength: 120 });
  if (raw === SAFETY_REFUSAL_MESSAGE) return SAFETY_REFUSAL_MESSAGE;
  return null;
};

export const useAiAgent = ({
  initialMessages = EMPTY_MESSAGES,
  enabled = true,
  conversationId,
  sessionNamespace = "ai-studio-default",
}: UseAiAgentOptions = {}) => {
  const [messages, setMessages] = useState<AgentMessage[]>(initialMessages);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesRef = useRef<AgentMessage[]>(initialMessages);
  const clientSessionKeyRef = useRef<string>();
  if (!clientSessionKeyRef.current) {
    clientSessionKeyRef.current = ensureSessionKey(sessionNamespace, conversationId);
  }
  const canonicalPromptRef = useRef<string | null>(null);

  useEffect(() => {
    clientSessionKeyRef.current = ensureSessionKey(sessionNamespace, conversationId);
  }, [conversationId, sessionNamespace]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const appendUserMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return null;
    const userMessageId = createAgentMessageId("user");
    const uiUserMessage: AgentMessage = {
      id: userMessageId,
      role: "user",
      content: trimmed,
    };
    const nextUiMessages = appendUiMessage(messagesRef.current, uiUserMessage);
    setMessages(nextUiMessages);
    messagesRef.current = nextUiMessages;
    setError(null);
    return userMessageId;
  }, []);

  const send = useCallback(
    async ({
      text,
      payloadText,
      previousPrompt,
      context,
      skipUserEcho = false,
      optimisticUserMessageId = null,
    }: SendParams): Promise<SendResult> => {
      if (!enabled) {
        setError("Agent is disabled");
        return { response: null, actions: undefined };
      }
      const trimmed = text.trim();
      const hasMediaContext = (context?.media?.length ?? 0) > 0;
      const allowContextOnlyTurn = !trimmed && hasMediaContext;
      if (!trimmed && !allowContextOnlyTurn) {
        return { response: null, actions: undefined };
      }

      const previousMessages = messagesRef.current;
      if (!skipUserEcho && !allowContextOnlyTurn) {
        // UI-visible history (keep the user's raw text)
        const uiUserMessage: AgentMessage = {
          id: createAgentMessageId("user"),
          role: "user",
          content: trimmed,
        };
        const nextUiMessages = appendUiMessage(previousMessages, uiUserMessage);
        setMessages(nextUiMessages);
        messagesRef.current = nextUiMessages;
      }
      setIsSending(true);
      setError(null);

      try {
        const payloadCandidate = payloadText?.trim() || trimmed;
        const cleanedUserPayload = payloadCandidate
          ? (removeAspectRatioLanguage(payloadCandidate) ?? payloadCandidate)
          : "";
        const userPayloadForApi = cleanedUserPayload || (allowContextOnlyTurn ? " " : trimmed);
        // Canonical prompt is sent separately; avoid duplicating assistant content in the message list.
        void previousPrompt;
        const apiMessages = buildApiMessagesForTurn({
          previousMessages,
          userPayloadForApi,
          skipUserEcho,
          optimisticUserMessageId,
        });
        const clientSessionKey =
          clientSessionKeyRef.current ?? ensureSessionKey(sessionNamespace, conversationId);
        clientSessionKeyRef.current = clientSessionKey;

        const body: AgentApiRequest = {
          messages: apiMessages,
          context: context ? buildAgentContext(context) : undefined,
          clientSessionKey,
          conversationId: clientSessionKey,
          traceId: `agent-${randomId()}`,
          canonicalPrompt: canonicalPromptRef.current,
        };
        const transportResult = await sendStudioAgentTurn(body);
        if (!transportResult.ok) {
          const refusalText = resolveSafetyRefusalText(
            transportResult.parsedError ?? transportResult.detail
          );
          if (refusalText) {
            const nextAssistantMessages = appendAssistantMessage(messagesRef.current, {
              id: createAgentMessageId("assistant"),
              content: refusalText,
            });
            setMessages(nextAssistantMessages);
            messagesRef.current = nextAssistantMessages;
            return {
              response: { message: refusalText, actions: undefined },
              actions: undefined,
            };
          }

          const structuredErrorText =
            transportResult.parsedError?.message ??
            transportResult.parsedError?.detail ??
            transportResult.parsedError?.error;
          setError(
            normalizeErrorText(structuredErrorText ?? transportResult.detail, {
              fallback: `Agent request failed (${transportResult.status})`,
              maxLength: 320,
            })
          );
          return { response: null, actions: undefined };
        }

        const data = transportResult.data;
        const actions = normalizeActions(data?.actions);

        if (data?.canonicalPrompt) {
          canonicalPromptRef.current = sanitizeGenerationPromptText(data.canonicalPrompt);
        } else if (actions?.applyPrompt) {
          canonicalPromptRef.current = sanitizeGenerationPromptText(actions.applyPrompt ?? null);
        }

        // The agent’s role here is to refine/iterate prompts. Always surface the refined prompt in the chat thread.
        const applyPromptText = sanitizeGenerationPromptText(actions?.applyPrompt ?? null) ?? "";
        const messageText = sanitizeGenerationPromptText(data?.message ?? null) ?? "";
        const assistantContent = applyPromptText || messageText;

        if (assistantContent) {
          const nextAssistantMessages = appendAssistantMessage(messagesRef.current, {
            id: createAgentMessageId("assistant"),
            content: assistantContent,
          });
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
    [conversationId, enabled, sessionNamespace]
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
    clientSessionKeyRef.current = randomId();
    persistSessionKey(sessionNamespace, clientSessionKeyRef.current);
    setError(null);
  }, [sessionNamespace]);

  const updateMessageById = useCallback(
    (messageId: string, updater: (message: AgentMessage) => AgentMessage) => {
      const nextMessages = updateUiMessageById(messagesRef.current, messageId, updater);
      if (nextMessages === messagesRef.current) return false;
      setMessages(nextMessages);
      messagesRef.current = nextMessages;
      return true;
    },
    []
  );

  const replaceMessages = useCallback((nextMessages: AgentMessage[]) => {
    setMessages(nextMessages);
    messagesRef.current = nextMessages;
    setError(null);
  }, []);

  return { ...state, send, reset, appendUserMessage, updateMessageById, replaceMessages };
};
