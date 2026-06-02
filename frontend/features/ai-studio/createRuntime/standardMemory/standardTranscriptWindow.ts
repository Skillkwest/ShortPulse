/**
 * Standard transcript window policy.
 * Defines which visible Standard messages remain in session memory for sends and persistence.
 */
import type { AgentMessage } from "../../../../prefabs/agent";
import { canUseAssistantMessageAsPrompt } from "../agentRuntimeShared";

export type ResolveStandardTranscriptWindowOptions = {
  messageCap?: number;
  retainLatestReusableAssistantPrompt?: boolean;
};

const DEFAULT_STANDARD_TRANSCRIPT_WINDOW_MESSAGE_CAP = 8;

const normalizeMessageCap = (value?: number): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_STANDARD_TRANSCRIPT_WINDOW_MESSAGE_CAP;
  }
  return Math.max(1, Math.trunc(value));
};

/**
 * Returns the Standard transcript window used as session memory and outbound request history.
 * The active Standard lane favors a bounded recent window while retaining the latest reusable
 * assistant prompt artifact when it would otherwise fall out of the window.
 */
export const resolveStandardTranscriptWindow = (
  messages: AgentMessage[],
  options?: ResolveStandardTranscriptWindowOptions
): AgentMessage[] => {
  const normalizedCap = normalizeMessageCap(options?.messageCap);
  const baseWindow = messages.slice(-normalizedCap);
  const shouldRetainLatestReusableAssistantPrompt =
    options?.retainLatestReusableAssistantPrompt !== false;

  if (!shouldRetainLatestReusableAssistantPrompt) {
    return baseWindow;
  }

  const latestReusableAssistantPrompt = [...messages]
    .reverse()
    .find((message) => canUseAssistantMessageAsPrompt(message));

  if (!latestReusableAssistantPrompt) {
    return baseWindow;
  }

  if (baseWindow.some((message) => message.id === latestReusableAssistantPrompt.id)) {
    return baseWindow;
  }

  return [latestReusableAssistantPrompt, ...baseWindow];
};
