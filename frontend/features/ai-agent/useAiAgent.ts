/**
 * Hook for interacting with the AI Studio Agent API.
 * Manages chat state locally and exposes a send helper with structured responses.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AgentApiContext,
  AgentApiRequest,
  AgentAttachment,
  AgentMessage,
  AgentPulseWorkflowSession,
} from "../../prefabs/agent";
import { removeAspectRatioLanguage, sanitizeGenerationPromptText } from "../agent-core/promptText";
import {
  resolveStudioAgentSafetyInputPrecheckFieldModes,
  runStudioAgentSafetyInputPrecheck,
} from "../agent-runtime/studioAgentSafetyInputPrecheck";
import { STUDIO_AGENT_INFRA_FALLBACK_MESSAGE } from "../agent-runtime/studioAgentFailurePolicy";
import { resolveSafetyEnvironment } from "../agent-runtime/safetyPolicy/decisionEngine";
import { buildAgentContext } from "./logic/contextBuilder";
import { normalizeErrorText } from "../../lib/errorText";
import {
  SAFETY_REFUSAL_MESSAGE,
  isClientDevAbsoluteZeroEnabled,
  isClientInputPrecheckEnabled,
  resolveClientSafetyModality,
  resolveClientSafetyProfileId,
  resolveSafetyRefusalText,
} from "./agentClientSafety";
import { normalizeActions } from "./client/actionNormalizer";
import {
  appendAssistantMessage,
  appendUiMessage,
  buildApiMessagesForTurn,
  updateUiMessageById,
} from "./client/messageStore";
import { ensureSessionKey, persistSessionKey, randomId } from "./client/sessionController";
import { sendStudioAgentTurn } from "./client/studioAgentTransport";
import {
  EMPTY_MESSAGES,
  type SendParams,
  type SendResult,
  type UseAiAgentOptions,
} from "./useAiAgentTypes";
const createAgentMessageId = (role: "user" | "assistant") => `agent-${role}-${randomId()}`;
const cloneAgentAttachments = (attachments: AgentAttachment[] = []): AgentAttachment[] =>
  attachments.map((attachment) => ({ ...attachment }));
export const useAiAgent = ({
  initialMessages = EMPTY_MESSAGES,
  enabled = true,
  conversationId,
  sessionNamespace = "ai-studio-default",
  directOpenAiBypassEnabled = false,
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
      isolateHistory = false,
      skipUserEcho = false,
      optimisticUserMessageId = null,
    }: SendParams): Promise<SendResult> => {
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
            workflowSession: null,
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
          directOpenAiBypass: directOpenAiBypassEnabled,
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
              workflowSession: null,
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
              workflowSession: null,
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
              workflowSession: null,
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
        const workflowSession =
          data?.workflowSession && typeof data.workflowSession.presetId === "string"
            ? ({
                presetId: data.workflowSession.presetId.trim(),
                status:
                  data.workflowSession.status === "running" ||
                  data.workflowSession.status === "awaiting_input" ||
                  data.workflowSession.status === "completed"
                    ? data.workflowSession.status
                    : "idle",
                currentStepIndex:
                  typeof data.workflowSession.currentStepIndex === "number" &&
                  Number.isFinite(data.workflowSession.currentStepIndex)
                    ? Math.max(1, Math.trunc(data.workflowSession.currentStepIndex))
                    : null,
                currentStepLabel:
                  typeof data.workflowSession.currentStepLabel === "string" &&
                  data.workflowSession.currentStepLabel.trim().length > 0
                    ? data.workflowSession.currentStepLabel.trim()
                    : null,
                currentStepPrompt:
                  typeof data.workflowSession.currentStepPrompt === "string" &&
                  data.workflowSession.currentStepPrompt.trim().length > 0
                    ? data.workflowSession.currentStepPrompt.trim()
                    : null,
                collectedInputs: Array.isArray(data.workflowSession.collectedInputs)
                  ? data.workflowSession.collectedInputs
                      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
                      .filter((entry) => entry.length > 0)
                  : [],
                lastArtifact:
                  typeof data.workflowSession.lastArtifact === "string" &&
                  data.workflowSession.lastArtifact.trim().length > 0
                    ? data.workflowSession.lastArtifact.trim()
                    : null,
                finalArtifactSource:
                  data.workflowSession.finalArtifactSource === "apply_prompt" ||
                  data.workflowSession.finalArtifactSource === "chat_reply"
                    ? data.workflowSession.finalArtifactSource
                    : null,
              } satisfies AgentPulseWorkflowSession)
            : null;

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
        return { response: data ?? null, actions, workflowSession };
      } catch (err) {
        setError(
          normalizeErrorText(err instanceof Error ? err.message : err, {
            fallback: "Agent request failed",
            maxLength: 320,
          })
        );
        return { response: null, actions: undefined, workflowSession: null };
      } finally {
        setIsSending(false);
      }
    },
    [conversationId, directOpenAiBypassEnabled, enabled, sessionNamespace]
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
