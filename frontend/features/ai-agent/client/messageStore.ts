/**
 * Message-store helpers for the Create agent state engine.
 * Keeps UI/history windowing and API payload shaping behavior centralized.
 */
import type { AgentApiMessage, AgentMessage } from "../../../prefabs/agent";

const MAX_UI_MESSAGES = 24;
const MAX_API_HISTORY_MESSAGES = 12;

/**
 * Append a message to the UI history window.
 */
export const appendUiMessage = (messages: AgentMessage[], message: AgentMessage): AgentMessage[] =>
  [...messages, message].slice(-MAX_UI_MESSAGES);

/**
 * Append an assistant response to the UI history window while reserving one slot.
 */
export const appendAssistantMessage = (
  messages: AgentMessage[],
  message: Pick<AgentMessage, "id" | "content"> &
    Pick<
      AgentMessage,
      "outputPrompt" | "canUseAsPrompt" | "outcomeClass" | "reasonCode" | "decision"
    >
): AgentMessage[] => [
  ...messages.slice(-(MAX_UI_MESSAGES - 1)),
  {
    id: message.id,
    role: "assistant",
    content: message.content,
    ...(message.outputPrompt !== undefined ? { outputPrompt: message.outputPrompt } : {}),
    ...(message.canUseAsPrompt !== undefined ? { canUseAsPrompt: message.canUseAsPrompt } : {}),
    ...(message.outcomeClass !== undefined ? { outcomeClass: message.outcomeClass } : {}),
    ...(message.reasonCode !== undefined ? { reasonCode: message.reasonCode } : {}),
    ...(message.decision !== undefined ? { decision: message.decision } : {}),
  },
];

/**
 * Update one message in the UI history by id.
 * Returns the original array when no matching message is found.
 */
export const updateUiMessageById = (
  messages: AgentMessage[],
  messageId: string,
  updater: (message: AgentMessage) => AgentMessage
): AgentMessage[] => {
  let didUpdate = false;
  const next = messages.map((message) => {
    if (message.id !== messageId) return message;
    didUpdate = true;
    return updater(message);
  });
  return didUpdate ? next : messages;
};

/**
 * Remove one message from the UI history by id.
 * Returns the original array when no matching message is found.
 */
export const removeUiMessageById = (
  messages: AgentMessage[],
  messageId: string
): AgentMessage[] => {
  const next = messages.filter((message) => message.id !== messageId);
  return next.length === messages.length ? messages : next;
};

/**
 * Build API message history for the next turn from current local history.
 */
export const buildApiMessagesForTurn = ({
  previousMessages,
  userPayloadForApi,
  skipUserEcho,
  optimisticUserMessageId,
  excludeNonPromptAssistantHistory = true,
}: {
  previousMessages: AgentMessage[];
  userPayloadForApi: string;
  skipUserEcho: boolean;
  optimisticUserMessageId: string | null;
  excludeNonPromptAssistantHistory?: boolean;
}): AgentApiMessage[] => {
  const hasOptimisticUserAtTail =
    skipUserEcho &&
    previousMessages.length > 0 &&
    previousMessages[previousMessages.length - 1]?.id === optimisticUserMessageId;
  const previousMessagesForApi = hasOptimisticUserAtTail
    ? previousMessages.slice(0, -1)
    : previousMessages;

  const baseHistory = previousMessagesForApi.slice(-MAX_API_HISTORY_MESSAGES);
  const normalizedHistory = baseHistory.reduce<AgentApiMessage[]>((acc, message) => {
    const normalizedContent = message.content.trim();
    if (!normalizedContent) {
      return acc;
    }
    if (
      excludeNonPromptAssistantHistory &&
      message.role === "assistant" &&
      message.canUseAsPrompt === false
    ) {
      return acc;
    }
    if (message.role === "user" || message.role === "assistant") {
      acc.push({ role: message.role, content: normalizedContent });
    }
    return acc;
  }, []);

  if (!userPayloadForApi.length) {
    return normalizedHistory;
  }

  return [...normalizedHistory, { role: "user", content: userPayloadForApi }];
};
