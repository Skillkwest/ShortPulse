/**
 * Hook for interacting with the AI Studio Agent API.
 * Manages chat state locally and exposes a send helper with structured responses.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AgentActions,
  AgentApiContext,
  AgentApiRequest,
  AgentContext,
  AgentMessage,
  AgentResponse,
} from "../../prefabs/agent";
import { removeAspectRatioLanguage, sanitizeGenerationPromptText } from "../agent-core/promptText";
import {
  resolveStudioAgentSafetyInputPrecheckFieldModes,
  runStudioAgentSafetyInputPrecheck,
} from "../agent-runtime/studioAgentSafetyInputPrecheck";
import { STUDIO_AGENT_INFRA_FALLBACK_MESSAGE } from "../agent-runtime/studioAgentFailurePolicy";
import { resolveSafetyEnvironment } from "../agent-runtime/safetyPolicy/decisionEngine";
import type { SafetyModality } from "../agent-runtime/safetyPolicy/types";
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

const resolveClientSafetyModality = (context: AgentApiContext | undefined): SafetyModality => {
  if (context?.mode === "video") return "video";
  if (context?.mode === "image") return "image";
  if ((context?.media?.length ?? 0) > 0) return "image";
  return "text";
};

const isClientInputPrecheckEnabled = (): boolean =>
  process.env.NEXT_PUBLIC_STUDIO_AGENT_SAFETY_INPUT_PRECHECK_ENABLED !== "false";

const resolveClientSafetyProfileId = (): string | null =>
  process.env.NEXT_PUBLIC_STUDIO_AGENT_SAFETY_PROFILE_ACTIVE ?? null;

const isClientDevAbsoluteZeroEnabled = (): boolean =>
  process.env.NEXT_PUBLIC_STUDIO_AGENT_SAFETY_DEV_ABSOLUTE_ZERO_ENABLED === "true";

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
  const sessionIdentityRef = useRef<string | null>(null);
  if (!clientSessionKeyRef.current) {
    clientSessionKeyRef.current = ensureSessionKey(sessionNamespace, conversationId);
  }
  const canonicalPromptRef = useRef<string | null>(null);

  useEffect(() => {
    const identity = `${sessionNamespace}::${conversationId?.trim() ?? ""}`;
    const previousIdentity = sessionIdentityRef.current;
    clientSessionKeyRef.current = ensureSessionKey(sessionNamespace, conversationId);
    if (previousIdentity && previousIdentity !== identity) {
      setMessages([]);
      messagesRef.current = [];
      canonicalPromptRef.current = null;
      setError(null);
      setIsSending(false);
    }
    sessionIdentityRef.current = identity;
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
        const safeContext = context ? buildAgentContext(context) : undefined;
        const precheckContext: AgentApiContext = safeContext ?? {};
        const inputPrecheckResult = runStudioAgentSafetyInputPrecheck({
          enabled: isClientInputPrecheckEnabled(),
          messages: apiMessages,
          context: precheckContext,
          canonicalPrompt: canonicalPromptRef.current,
          modality: resolveClientSafetyModality(safeContext),
          profileId: resolveClientSafetyProfileId(),
          environment: resolveSafetyEnvironment(process.env.NODE_ENV),
          devAbsoluteZeroEnabled: isClientDevAbsoluteZeroEnabled(),
          rewriteRecheckMode: "allow_or_rewrite",
          fieldModes: resolveStudioAgentSafetyInputPrecheckFieldModes({
            sharedRawValue: process.env.NEXT_PUBLIC_STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES,
            scopedRawValue:
              process.env.NEXT_PUBLIC_STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES_STUDIO_AGENT,
          }),
        });
        if (inputPrecheckResult.outcome === "refusal") {
          const nextAssistantMessages = appendAssistantMessage(messagesRef.current, {
            id: createAgentMessageId("assistant"),
            content: SAFETY_REFUSAL_MESSAGE,
          });
          setMessages(nextAssistantMessages);
          messagesRef.current = nextAssistantMessages;
          return {
            response: { message: SAFETY_REFUSAL_MESSAGE, actions: undefined },
            actions: undefined,
          };
        }
        const precheckedApiMessages = inputPrecheckResult.messages.map((message) => {
          const role: "user" | "assistant" = message.role === "assistant" ? "assistant" : "user";
          return {
            role,
            content: message.content,
          };
        });
        const precheckedContext =
          Object.keys(inputPrecheckResult.context).length > 0
            ? inputPrecheckResult.context
            : undefined;

        const body: AgentApiRequest = {
          messages: precheckedApiMessages,
          context: precheckedContext,
          clientSessionKey,
          conversationId: clientSessionKey,
          traceId: `agent-${randomId()}`,
          canonicalPrompt: inputPrecheckResult.canonicalPrompt,
        };
        const transportResult = await sendStudioAgentTurn(body);
        if (!transportResult.ok) {
          const machineDecision = transportResult.parsedError?.decision;
          const machineOutcomeClass = transportResult.parsedError?.outcome_class;
          if (machineDecision === "refuse") {
            const refusalText =
              resolveSafetyRefusalText(
                transportResult.parsedError?.message ??
                  transportResult.parsedError?.detail ??
                  transportResult.parsedError?.error
              ) ?? SAFETY_REFUSAL_MESSAGE;
            const nextAssistantMessages = appendAssistantMessage(messagesRef.current, {
              id: createAgentMessageId("assistant"),
              content: refusalText,
            });
            setMessages(nextAssistantMessages);
            messagesRef.current = nextAssistantMessages;
            return {
              response: {
                message: refusalText,
                actions: undefined,
                decision: "refuse",
                outcome_class: machineOutcomeClass ?? "refusal_safety",
                reason_code: transportResult.parsedError?.reason_code,
                retryable: transportResult.parsedError?.retryable,
                fallback_reason: transportResult.parsedError?.fallback_reason,
              },
              actions: undefined,
            };
          }
          if (machineDecision === "allow" && machineOutcomeClass === "fallback_infra") {
            const fallbackText = normalizeErrorText(
              transportResult.parsedError?.message ??
                transportResult.parsedError?.detail ??
                transportResult.parsedError?.error,
              {
                fallback: STUDIO_AGENT_INFRA_FALLBACK_MESSAGE,
                maxLength: 160,
              }
            );
            const nextAssistantMessages = appendAssistantMessage(messagesRef.current, {
              id: createAgentMessageId("assistant"),
              content: fallbackText,
            });
            setMessages(nextAssistantMessages);
            messagesRef.current = nextAssistantMessages;
            return {
              response: {
                message: fallbackText,
                actions: undefined,
                decision: "allow",
                outcome_class: "fallback_infra",
                reason_code: transportResult.parsedError?.reason_code,
                retryable: transportResult.parsedError?.retryable,
                fallback_reason: transportResult.parsedError?.fallback_reason,
              },
              actions: undefined,
            };
          }
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
