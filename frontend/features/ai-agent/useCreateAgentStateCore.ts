/**
 * Neutral Create agent state core.
 * Owns local chat state, safety precheck, and send orchestration while callers
 * bind their own mode-specific transport and response contract.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type {
  AgentActions,
  AgentApiContext,
  AgentApiRequest,
  AgentAttachment,
  AgentMessage,
  AgentResponse,
  AgentRuntimeMode,
} from "../../prefabs/agent";
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
  updateUiMessageById,
} from "./client/messageStore";
import { resolveStudioAgentTransportFailure } from "./client/transportFailureResolution";
import { ensureSessionKey, persistSessionKey, randomId } from "./client/sessionController";
import { EMPTY_MESSAGES, type SendParams, type SendResult } from "./createAgentStateTypes";
import type { StudioAgentTransportResult } from "./client/studioAgentTransport";

type CreateAgentTransportSuccess = {
  actions: AgentActions | undefined;
  workflowSession?: SendResult["workflowSession"];
  canonicalPrompt: string | null;
  assistantContent: string;
  assistantOutputPrompt: string | null;
};

type UseCreateAgentStateCoreOptions = {
  initialMessages?: AgentMessage[];
  enabled?: boolean;
  conversationId?: string;
  sessionNamespace?: string;
  requestRuntimeMode: AgentRuntimeMode;
  allowSessionNamespaceOverride: boolean;
  sessionNamespaceOverrideErrorText?: string;
  buildAgentContext: (
    context: NonNullable<SendParams["context"]>
  ) => AgentApiContext | Promise<AgentApiContext>;
  sendAgentTurn: (body: AgentApiRequest) => Promise<StudioAgentTransportResult>;
  resolveTransportSuccess: (
    response: AgentResponse
  ) => CreateAgentTransportSuccess | Promise<CreateAgentTransportSuccess>;
};
const createAgentMessageId = (role: "user" | "assistant") => `agent-${role}-${randomId()}`;
const cloneAgentAttachments = (attachments: AgentAttachment[] = []): AgentAttachment[] =>
  attachments.map((attachment) => ({ ...attachment }));
const areAgentMessagesEqual = (left: AgentMessage[], right: AgentMessage[]): boolean => {
  if (left === right) return true;
  if (left.length !== right.length) return false;
  return left.every((message, index) => {
    const other = right[index];
    if (!other) return false;
    const leftAttachments = message.attachments ?? [];
    const rightAttachments = other.attachments ?? [];
    return (
      message.id === other.id &&
      message.role === other.role &&
      message.content === other.content &&
      (message.outputPrompt ?? null) === (other.outputPrompt ?? null) &&
      (message.canUseAsPrompt ?? null) === (other.canUseAsPrompt ?? null) &&
      (message.outcomeClass ?? null) === (other.outcomeClass ?? null) &&
      (message.reasonCode ?? null) === (other.reasonCode ?? null) &&
      (message.decision ?? null) === (other.decision ?? null) &&
      leftAttachments.length === rightAttachments.length &&
      leftAttachments.every((attachment, attachmentIndex) => {
        const otherAttachment = rightAttachments[attachmentIndex];
        return (
          attachment.id === otherAttachment?.id &&
          attachment.kind === otherAttachment?.kind &&
          (attachment.referenceId ?? null) === (otherAttachment?.referenceId ?? null) &&
          (attachment.text ?? null) === (otherAttachment?.text ?? null) &&
          (attachment.imageUrl ?? null) === (otherAttachment?.imageUrl ?? null) &&
          (attachment.aspect ?? null) === (otherAttachment?.aspect ?? null) &&
          (attachment.deliveryStatus ?? null) === (otherAttachment?.deliveryStatus ?? null) &&
          (attachment.deliveryError ?? null) === (otherAttachment?.deliveryError ?? null)
        );
      })
    );
  });
};
export const useCreateAgentStateCore = ({
  initialMessages = EMPTY_MESSAGES,
  enabled = true,
  conversationId,
  sessionNamespace = "ai-studio-default",
  requestRuntimeMode,
  allowSessionNamespaceOverride,
  sessionNamespaceOverrideErrorText = "Agent cannot send to an override session namespace.",
  buildAgentContext,
  sendAgentTurn,
  resolveTransportSuccess,
}: UseCreateAgentStateCoreOptions) => {
  const [messages, setMessages] = useState<AgentMessage[]>(initialMessages);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesRef = useRef<AgentMessage[]>(initialMessages);
  const clientSessionKeyRef = useRef<string>();
  const sessionIdentityRef = useRef<string | null>(null);
  const canonicalPromptBySessionIdentityRef = useRef<Map<string, string | null>>(new Map());
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

      const previousMessages = isolateHistory ? EMPTY_MESSAGES : messagesRef.current;
      const getResponseBaseMessages = () =>
        isolateHistory ? previousMessages : messagesRef.current;
      const requestCanonicalPrompt =
        canonicalPromptBySessionIdentityRef.current.get(requestSessionIdentity) ?? null;
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
        const payloadCandidate = payloadTrimmed || trimmed;
        const shouldBypassStandardLocalProcessing = requestRuntimeMode === "standard";
        const cleanedUserPayload =
          shouldBypassStandardLocalProcessing || !payloadCandidate
            ? payloadCandidate
            : (removeAspectRatioLanguage(payloadCandidate) ?? payloadCandidate);
        const userPayloadForApi = cleanedUserPayload || (allowContextOnlyTurn ? " " : trimmed);
        // Canonical prompt is sent separately; avoid duplicating assistant content in the message list.
        void previousPrompt;
        const apiMessages = buildApiMessagesForTurn({
          previousMessages,
          userPayloadForApi,
          skipUserEcho,
          optimisticUserMessageId,
          excludeNonPromptAssistantHistory: !shouldBypassStandardLocalProcessing,
        });
        const clientSessionKey = ensureSessionKey(requestSessionNamespace, conversationId);
        clientSessionKeyRef.current = clientSessionKey;
        const safeContext = context ? await buildAgentContext(context) : undefined;
        const precheckContext: AgentApiContext = safeContext ?? {};
        const inputPrecheckResult = shouldBypassStandardLocalProcessing
          ? null
          : runStudioAgentSafetyInputPrecheck({
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
                sharedRawValue:
                  process.env.NEXT_PUBLIC_STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES,
                scopedRawValue:
                  process.env
                    .NEXT_PUBLIC_STUDIO_AGENT_SAFETY_INPUT_PRECHECK_FIELD_MODES_STUDIO_AGENT,
              }),
            });
        if (inputPrecheckResult?.outcome === "refusal") {
          const nextAssistantMessages = appendAssistantMessage(getResponseBaseMessages(), {
            id: createAgentMessageId("assistant"),
            content: SAFETY_REFUSAL_MESSAGE,
            canUseAsPrompt: false,
            outcomeClass: "refusal_safety",
            reasonCode: "SAFETY_INPUT_REFUSAL",
            decision: "refuse",
          });
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
        const outboundContext = inputPrecheckResult
          ? Object.keys(inputPrecheckResult.context).length > 0
            ? inputPrecheckResult.context
            : undefined
          : safeContext && Object.keys(safeContext).length > 0
            ? safeContext
            : undefined;

        const body: AgentApiRequest = {
          messages: outboundMessages,
          context: outboundContext,
          clientSessionKey,
          clientSessionNamespace: requestSessionNamespace,
          conversationId: clientSessionKey,
          traceId: `agent-${randomId()}`,
          canonicalPrompt:
            shouldBypassStandardLocalProcessing || requestRuntimeMode === "pulse"
              ? null
              : (inputPrecheckResult?.canonicalPrompt ?? null),
          runtimeMode: requestRuntimeMode,
        };
        const transportResult = await sendAgentTurn(body);
        if (isStaleRequest()) {
          return discardedResult;
        }
        if (!transportResult.ok) {
          const failureResolution = resolveStudioAgentTransportFailure(transportResult);
          if (failureResolution.assistantMessage) {
            const nextAssistantMessages = appendAssistantMessage(getResponseBaseMessages(), {
              id: createAgentMessageId("assistant"),
              content: failureResolution.assistantMessage,
              canUseAsPrompt: false,
              outcomeClass: failureResolution.response?.outcome_class ?? null,
              reasonCode: failureResolution.response?.reason_code ?? null,
              decision: failureResolution.response?.decision ?? null,
            });
            setMessages(nextAssistantMessages);
            messagesRef.current = nextAssistantMessages;
            return {
              response: failureResolution.response,
              actions: undefined,
              workflowSession: null,
            };
          }
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
          assistantContent,
          assistantOutputPrompt,
        } = await resolveTransportSuccess(data);
        if (canonicalPrompt) {
          canonicalPromptBySessionIdentityRef.current.set(requestSessionIdentity, canonicalPrompt);
        }

        if (assistantContent) {
          const canUseAssistantMessageAsPrompt =
            Boolean(assistantOutputPrompt) &&
            data.decision !== "refuse" &&
            data.outcome_class !== "refusal_safety" &&
            data.outcome_class !== "refusal_model";
          const nextAssistantMessages = appendAssistantMessage(getResponseBaseMessages(), {
            id: createAgentMessageId("assistant"),
            content: assistantContent,
            outputPrompt: assistantOutputPrompt,
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
          return discardedResult;
        }
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
        setIsSending(false);
      }
    },
    [
      conversationId,
      enabled,
      allowSessionNamespaceOverride,
      buildAgentContext,
      requestRuntimeMode,
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
    clientSessionKeyRef.current = randomId();
    persistSessionKey(sessionNamespace, clientSessionKeyRef.current);
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

  return { ...state, send, reset, appendUserMessage, updateMessageById, replaceMessages };
};
