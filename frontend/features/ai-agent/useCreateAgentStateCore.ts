/**
 * Neutral Create agent state core.
 * Owns local chat state, safety precheck, and send orchestration while callers
 * bind their own mode-specific transport and response contract.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type {
  AgentApiContext,
  AgentApiRequest,
  AgentAttachment,
  AgentConversationState,
  AgentMessage,
} from "../../prefabs/agent";
import { isAgentMachineFailure } from "../../prefabs/agent";
import { removeAspectRatioLanguage } from "../agent-core/promptText";
import {
  resolveStudioAgentSafetyInputPrecheckFieldModes,
  runStudioAgentSafetyInputPrecheck,
} from "../agent-runtime/studioAgentSafetyInputPrecheck";
import { resolveSafetyEnvironment } from "../agent-runtime/safetyPolicy/decisionEngine";
import { normalizeErrorText } from "../../lib/errorText";
import {
  SAFETY_REFUSAL_MESSAGE,
  isClientDevAbsoluteZeroEnabled,
  isClientInputPrecheckEnabled,
  resolveClientSafetyModality,
  resolveClientSafetyProfileId,
} from "./agentClientSafety";
import {
  appendAssistantMessage,
  appendUiMessage,
  buildApiMessagesForTurn,
  removeUiMessageById,
  updateUiMessageById,
} from "./client/messageStore";
import { resolveStudioAgentTransportFailure } from "./client/transportFailureResolution";
import { ensureSessionKey, persistSessionKey, randomId } from "./client/sessionController";
import { EMPTY_MESSAGES, type SendParams, type SendResult } from "./createAgentStateTypes";
import { resolveOutboundAgentContext } from "./logic/pulseContextPreservation";
import {
  areAgentMessagesEqual,
  cloneAgentAttachments,
  createAgentMessageId,
  resolveAssistantMessagePayload,
  type UseCreateAgentStateCoreOptions,
} from "./createAgentStateCoreHelpers";
export const useCreateAgentStateCore = ({
  initialMessages = EMPTY_MESSAGES,
  enabled = true,
  conversationId,
  sessionNamespace = "ai-studio-default",
  requestRuntimeMode,
  allowSessionNamespaceOverride,
  sessionNamespaceOverrideErrorText = "Agent cannot send to an override session namespace.",
  buildAgentContext,
  resolveRequestHistory,
  sendAgentTurn,
  resolveTransportSuccess,
}: UseCreateAgentStateCoreOptions) => {
  const [messages, setMessages] = useState<AgentMessage[]>(initialMessages);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesRef = useRef<AgentMessage[]>(initialMessages);
  const clientSessionKeyRef = useRef<string>();
  const sessionIdentityRef = useRef<string | null>(null);
  const pendingSendCountRef = useRef(0);
  const canonicalPromptBySessionIdentityRef = useRef<Map<string, string | null>>(new Map());
  const conversationStateBySessionIdentityRef = useRef<Map<string, AgentConversationState | null>>(
    new Map()
  );
  if (!clientSessionKeyRef.current) {
    clientSessionKeyRef.current = ensureSessionKey(sessionNamespace, conversationId);
  }
  useLayoutEffect(() => {
    const identity = `${sessionNamespace}::${conversationId?.trim() ?? ""}`;
    const previousIdentity = sessionIdentityRef.current;
    clientSessionKeyRef.current = ensureSessionKey(sessionNamespace, conversationId);
    if (previousIdentity && previousIdentity !== identity) {
      setMessages([]);
      messagesRef.current = [];
      setError(null);
      pendingSendCountRef.current = 0;
      setIsSending(false);
    }
    sessionIdentityRef.current = identity;
  }, [conversationId, sessionNamespace]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const appendUserMessage = useCallback((text: string, attachments: AgentAttachment[] = []) => {
    const trimmed = text.trim();
    const normalizedAttachments = cloneAgentAttachments(attachments);
    if (!trimmed && normalizedAttachments.length === 0) return null;
    const userMessageId = createAgentMessageId("user");
    const uiUserMessage: AgentMessage = {
      id: userMessageId,
      role: "user",
      content: trimmed,
      attachments: normalizedAttachments.length > 0 ? normalizedAttachments : undefined,
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
      memoryMessages = [],
      context,
      sessionNamespaceOverride,
      isolateHistory = false,
      skipUserEcho = false,
      optimisticUserMessageId = null,
    }: SendParams): Promise<SendResult> => {
      const requestSessionNamespace = sessionNamespaceOverride ?? sessionNamespace;
      const requestSessionIdentity = `${requestSessionNamespace}::${conversationId?.trim() ?? ""}`;
      const isNamespaceOverrideSend =
        typeof sessionNamespaceOverride === "string" &&
        sessionNamespaceOverride !== sessionNamespace;
      const previousSessionIdentity = sessionIdentityRef.current;
      if (!allowSessionNamespaceOverride && isNamespaceOverrideSend) {
        const errorText = sessionNamespaceOverrideErrorText;
        setError(errorText);
        return {
          response: null,
          actions: undefined,
          workflowSession: null,
          errorText,
          failureKind: "transport_error",
        };
      }
      if (!sessionIdentityRef.current) {
        sessionIdentityRef.current = requestSessionIdentity;
      } else if (isNamespaceOverrideSend) {
        sessionIdentityRef.current = requestSessionIdentity;
      }
      const isStaleRequest = () => sessionIdentityRef.current !== requestSessionIdentity;
      const restorePreviousSessionIdentity = () => {
        if (!isNamespaceOverrideSend) return;
        if (sessionIdentityRef.current !== requestSessionIdentity) return;
        sessionIdentityRef.current = previousSessionIdentity;
      };
      const discardedResult: SendResult = {
        response: null,
        actions: undefined,
        workflowSession: null,
        discarded: true,
        errorText: null,
      };
      if (!enabled) {
        setError("Agent is disabled");
        return { response: null, actions: undefined };
      }
      const trimmed = text.trim();
      const payloadTrimmed = payloadText?.trim() ?? "";
      const hasMediaContext = (context?.media?.length ?? 0) > 0;
      const allowContextOnlyTurn = !trimmed && (hasMediaContext || payloadTrimmed.length > 0);
      if (!trimmed && !allowContextOnlyTurn) {
        return { response: null, actions: undefined };
      }

      const originalSessionMessages = messagesRef.current;
      const previousMessages = isolateHistory ? EMPTY_MESSAGES : originalSessionMessages;
      const requestHistoryMessages = resolveRequestHistory
        ? resolveRequestHistory(previousMessages)
        : previousMessages;
      const getResponseBaseMessages = ({
        restoreFallback = false,
      }: {
        restoreFallback?: boolean;
      } = {}) =>
        restoreFallback && isolateHistory && isNamespaceOverrideSend
          ? originalSessionMessages
          : isolateHistory
            ? previousMessages
            : messagesRef.current;
      const requestCanonicalPrompt =
        canonicalPromptBySessionIdentityRef.current.get(requestSessionIdentity) ?? null;
      const requestConversationState =
        requestRuntimeMode === "standard"
          ? (conversationStateBySessionIdentityRef.current.get(requestSessionIdentity) ?? null)
          : null;
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
      pendingSendCountRef.current += 1;
      setIsSending(true);
      setError(null);

      try {
        const payloadCandidate = payloadTrimmed || trimmed;
        const shouldPreserveStandardPromptSemantics = requestRuntimeMode === "standard";
        const cleanedUserPayload =
          shouldPreserveStandardPromptSemantics || !payloadCandidate
            ? payloadCandidate
            : (removeAspectRatioLanguage(payloadCandidate) ?? payloadCandidate);
        const userPayloadForApi = cleanedUserPayload || (allowContextOnlyTurn ? " " : trimmed);
        // Canonical prompt is sent separately; avoid duplicating assistant content in the message list.
        void previousPrompt;
        const apiMessages = buildApiMessagesForTurn({
          previousMessages: requestHistoryMessages,
          userPayloadForApi,
          memoryMessages,
          skipUserEcho,
          optimisticUserMessageId,
          // Pulse follow-up turns need the prior assistant step/question in history.
          // Filtering non-prompt assistant replies makes workflow and chat pulses feel
          // like they restart from the beginning on every turn.
          excludeNonPromptAssistantHistory: false,
        });
        const clientSessionKey = ensureSessionKey(requestSessionNamespace, conversationId);
        clientSessionKeyRef.current = clientSessionKey;
        const safeContext = context ? await buildAgentContext(context) : undefined;
        const precheckContext: AgentApiContext = safeContext ?? {};
        const inputPrecheckResult = runStudioAgentSafetyInputPrecheck({
          enabled: isClientInputPrecheckEnabled(),
          messages: apiMessages,
          context: precheckContext,
          canonicalPrompt: requestCanonicalPrompt,
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
        if (inputPrecheckResult?.outcome === "refusal") {
          restorePreviousSessionIdentity();
          const nextAssistantMessages = appendAssistantMessage(
            getResponseBaseMessages({ restoreFallback: true }),
            {
              id: createAgentMessageId("assistant"),
              content: SAFETY_REFUSAL_MESSAGE,
              canUseAsPrompt: false,
              outcomeClass: "refusal_safety",
              reasonCode: "SAFETY_INPUT_REFUSAL",
              decision: "refuse",
            }
          );
          setMessages(nextAssistantMessages);
          messagesRef.current = nextAssistantMessages;
          return {
            response: { message: SAFETY_REFUSAL_MESSAGE, actions: undefined },
            actions: undefined,
            workflowSession: null,
          };
        }
        const outboundMessages = inputPrecheckResult
          ? inputPrecheckResult.messages.map((message) => {
              const role: "user" | "assistant" =
                message.role === "assistant" ? "assistant" : "user";
              return {
                role,
                content: message.content,
              };
            })
          : apiMessages;
        const outboundContext = resolveOutboundAgentContext({
          requestRuntimeMode,
          safeContext,
          precheckedContext: inputPrecheckResult?.context,
        });

        const body: AgentApiRequest = {
          messages: outboundMessages,
          context: outboundContext,
          conversationState: requestConversationState,
          clientSessionKey,
          clientSessionNamespace: requestSessionNamespace,
          conversationId: clientSessionKey,
          traceId: `agent-${randomId()}`,
          canonicalPrompt:
            shouldPreserveStandardPromptSemantics || requestRuntimeMode === "pulse"
              ? null
              : (inputPrecheckResult?.canonicalPrompt ?? null),
          runtimeMode: requestRuntimeMode,
        };
        const transportResult = await sendAgentTurn(body);
        if (isStaleRequest()) {
          restorePreviousSessionIdentity();
          return discardedResult;
        }
        if (!transportResult.ok) {
          const failureResolution = resolveStudioAgentTransportFailure(transportResult);
          if (failureResolution.assistantMessage) {
            restorePreviousSessionIdentity();
            const nextAssistantMessages = appendAssistantMessage(
              getResponseBaseMessages({ restoreFallback: true }),
              {
                id: createAgentMessageId("assistant"),
                content: failureResolution.assistantMessage,
                canUseAsPrompt: false,
                outcomeClass: failureResolution.response?.outcome_class ?? null,
                reasonCode: failureResolution.response?.reason_code ?? null,
                decision: failureResolution.response?.decision ?? null,
              }
            );
            setMessages(nextAssistantMessages);
            messagesRef.current = nextAssistantMessages;
            return {
              response: failureResolution.response,
              actions: undefined,
              workflowSession: null,
            };
          }
          restorePreviousSessionIdentity();
          setError(failureResolution.errorText);
          return {
            response: null,
            actions: undefined,
            workflowSession: null,
            errorText: failureResolution.errorText,
            failureKind: "transport_error",
          };
        }

        const data = transportResult.data;
        const {
          actions,
          workflowSession = null,
          canonicalPrompt,
          assistantReply,
          promptArtifact,
          assistantContent,
          assistantOutputPrompt,
          conversationState,
        } = await resolveTransportSuccess(data);
        if (canonicalPrompt) {
          canonicalPromptBySessionIdentityRef.current.set(requestSessionIdentity, canonicalPrompt);
        }
        if (requestRuntimeMode === "standard") {
          const nextPreviousResponseId =
            typeof conversationState?.previousResponseId === "string"
              ? conversationState.previousResponseId.trim()
              : "";
          if (nextPreviousResponseId.length > 0) {
            conversationStateBySessionIdentityRef.current.set(requestSessionIdentity, {
              previousResponseId: nextPreviousResponseId,
            });
          } else {
            conversationStateBySessionIdentityRef.current.delete(requestSessionIdentity);
          }
        }

        const assistantMessagePayload = resolveAssistantMessagePayload({
          assistantReply,
          promptArtifact,
          assistantContent,
          assistantOutputPrompt,
        });

        if (assistantMessagePayload.content) {
          const canUseAssistantMessageAsPrompt =
            Boolean(assistantMessagePayload.outputPrompt) &&
            !isAgentMachineFailure({
              decision: data.decision ?? null,
              outcomeClass: data.outcome_class ?? null,
            });
          const nextAssistantMessages = appendAssistantMessage(getResponseBaseMessages(), {
            id: createAgentMessageId("assistant"),
            content: assistantMessagePayload.content,
            outputPrompt: assistantMessagePayload.outputPrompt,
            canUseAsPrompt: canUseAssistantMessageAsPrompt,
            outcomeClass: data.outcome_class ?? null,
            reasonCode: data.reason_code ?? null,
            decision: data.decision ?? null,
          });
          setMessages(nextAssistantMessages);
          messagesRef.current = nextAssistantMessages;
        }
        return { response: data ?? null, actions, workflowSession };
      } catch (err) {
        if (isStaleRequest()) {
          restorePreviousSessionIdentity();
          return discardedResult;
        }
        restorePreviousSessionIdentity();
        setError(
          normalizeErrorText(err instanceof Error ? err.message : err, {
            fallback: "Agent request failed",
            maxLength: 320,
          })
        );
        return {
          response: null,
          actions: undefined,
          workflowSession: null,
          errorText: normalizeErrorText(err instanceof Error ? err.message : err, {
            fallback: "Agent request failed",
            maxLength: 320,
          }),
          failureKind: "transport_error",
        };
      } finally {
        pendingSendCountRef.current = Math.max(0, pendingSendCountRef.current - 1);
        setIsSending(pendingSendCountRef.current > 0);
      }
    },
    [
      conversationId,
      enabled,
      allowSessionNamespaceOverride,
      buildAgentContext,
      requestRuntimeMode,
      resolveRequestHistory,
      resolveTransportSuccess,
      sendAgentTurn,
      sessionNamespaceOverrideErrorText,
      sessionNamespace,
    ]
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
    const currentSessionIdentity =
      sessionIdentityRef.current ?? `${sessionNamespace}::${conversationId?.trim() ?? ""}`;
    setMessages([]);
    messagesRef.current = [];
    canonicalPromptBySessionIdentityRef.current.delete(currentSessionIdentity);
    conversationStateBySessionIdentityRef.current.delete(currentSessionIdentity);
    clientSessionKeyRef.current = randomId();
    persistSessionKey(sessionNamespace, clientSessionKeyRef.current);
    pendingSendCountRef.current = 0;
    setIsSending(false);
    setError(null);
  }, [conversationId, sessionNamespace]);

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
    if (areAgentMessagesEqual(messagesRef.current, nextMessages)) {
      setError(null);
      return;
    }
    setMessages(nextMessages);
    messagesRef.current = nextMessages;
    setError(null);
  }, []);

  const removeMessageById = useCallback((messageId: string) => {
    const nextMessages = removeUiMessageById(messagesRef.current, messageId);
    if (nextMessages === messagesRef.current) return false;
    setMessages(nextMessages);
    messagesRef.current = nextMessages;
    return true;
  }, []);

  return {
    ...state,
    send,
    reset,
    appendUserMessage,
    updateMessageById,
    removeMessageById,
    replaceMessages,
  };
};
