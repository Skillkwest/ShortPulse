/**
 * Hook for interacting with the AI Studio Agent API.
 * Manages chat state locally and exposes a send helper with structured responses.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AgentActions,
  AgentApiMessage,
  AgentApiRequest,
  AgentContext,
  AgentMessage,
  AgentResponse,
} from "../../prefabs/agent";
import { removeAspectRatioLanguage, sanitizeGenerationPromptText } from "../agent-core/promptText";
import { buildAgentContext } from "./logic/contextBuilder";
import { fetchWithAuth } from "../../lib/authenticatedFetch";
import { normalizeErrorText } from "../../lib/errorText";

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
const AGENT_SESSION_STORAGE_KEY_PREFIX = "shortpulse.agent.clientSession.v1.";

const randomId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `agent_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const buildSessionStorageKey = (namespace: string): string =>
  `${AGENT_SESSION_STORAGE_KEY_PREFIX}${namespace.trim() || "default"}`;

const loadSessionKey = (namespace: string): string | null => {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.sessionStorage.getItem(buildSessionStorageKey(namespace));
    return stored?.trim() ? stored.trim() : null;
  } catch {
    return null;
  }
};

const persistSessionKey = (namespace: string, value: string): void => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(buildSessionStorageKey(namespace), value);
  } catch {
    // no-op: storage may be unavailable in privacy modes
  }
};

const ensureSessionKey = (namespace: string, seed?: string): string => {
  const fromStorage = loadSessionKey(namespace);
  if (fromStorage) return fromStorage;
  const next = seed?.trim() || randomId();
  persistSessionKey(namespace, next);
  return next;
};

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

  const cleanedApplyPrompt = sanitizeGenerationPromptText(
    typeof applyPrompt === "string" ? applyPrompt : null
  );
  const cleanedReferenceCardPrompt =
    referenceCard && typeof referenceCard === "object"
      ? sanitizeGenerationPromptText(
          (referenceCard as AgentActions["referenceCard"])?.prompt ?? null
        )
      : null;
  const cleanedReferenceCard =
    referenceCard &&
    typeof referenceCard === "object" &&
    (cleanedReferenceCardPrompt || cleanedApplyPrompt)
      ? {
          ...(referenceCard as AgentActions["referenceCard"]),
          prompt: cleanedReferenceCardPrompt ?? cleanedApplyPrompt ?? "",
        }
      : undefined;
  const cleanedVariations = Array.isArray(variations)
    ? (variations as string[])
        .map((entry) => sanitizeGenerationPromptText(entry))
        .filter((entry): entry is string => Boolean(entry))
    : undefined;
  return {
    applyPrompt: cleanedApplyPrompt,
    referenceCard: cleanedReferenceCard,
    variations: cleanedVariations?.length ? cleanedVariations : undefined,
    describeTargets: Array.isArray(describeTargets) ? (describeTargets as string[]) : undefined,
  };
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
    const userMessageId = `agent-user-${randomId()}`;
    const uiUserMessage: AgentMessage = { id: userMessageId, role: "user", content: trimmed };
    const nextUiMessages = [...messagesRef.current, uiUserMessage].slice(-24);
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
        const uiUserMessage: AgentMessage = { role: "user", content: trimmed };
        const nextUiMessages = [...previousMessages, uiUserMessage].slice(-24);
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
        const hasOptimisticUserAtTail =
          skipUserEcho &&
          previousMessages.length > 0 &&
          previousMessages[previousMessages.length - 1]?.id === optimisticUserMessageId;
        const previousMessagesForApi = hasOptimisticUserAtTail
          ? previousMessages.slice(0, -1)
          : previousMessages;
        const baseHistory = previousMessagesForApi.slice(-12); // small window for API
        // Canonical prompt is sent separately; avoid duplicating assistant content in the message list.
        void previousPrompt;
        const apiMessages: AgentApiMessage[] = [
          ...baseHistory,
          { role: "user", content: userPayloadForApi },
        ].reduce<AgentApiMessage[]>((acc, message) => {
          if (message.role === "user" || message.role === "assistant") {
            acc.push({ role: message.role, content: message.content });
          }
          return acc;
        }, []);
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
          canonicalPromptRef.current = sanitizeGenerationPromptText(data.canonicalPrompt);
        } else if (actions?.applyPrompt) {
          canonicalPromptRef.current = sanitizeGenerationPromptText(actions.applyPrompt ?? null);
        }

        // The agent’s role here is to refine/iterate prompts. Always surface the refined prompt in the chat thread.
        const applyPromptText = sanitizeGenerationPromptText(actions?.applyPrompt ?? null) ?? "";
        const messageText = sanitizeGenerationPromptText(data?.message ?? null) ?? "";
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

  return { ...state, send, reset, appendUserMessage };
};
