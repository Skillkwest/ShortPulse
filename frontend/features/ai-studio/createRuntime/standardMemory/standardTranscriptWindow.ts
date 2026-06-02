/**
 * Standard transcript window policy.
 * Defines which visible Standard messages remain in session memory for sends and persistence.
 */
import type { AgentMessage } from "../../../../prefabs/agent";

export type ResolveStandardTranscriptWindowOptions = {
  messageCap?: number;
};

const DEFAULT_STANDARD_TRANSCRIPT_WINDOW_MESSAGE_CAP = Number.POSITIVE_INFINITY;

const normalizeMessageCap = (value?: number): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_STANDARD_TRANSCRIPT_WINDOW_MESSAGE_CAP;
  }
  return Math.max(1, Math.trunc(value));
};

/**
 * Returns the Standard transcript window used as session memory.
 * Phase 2 keeps the full visible transcript while making the policy explicit.
 */
export const resolveStandardTranscriptWindow = (
  messages: AgentMessage[],
  options?: ResolveStandardTranscriptWindowOptions
): AgentMessage[] => {
  const normalizedCap = normalizeMessageCap(options?.messageCap);
  if (normalizedCap === DEFAULT_STANDARD_TRANSCRIPT_WINDOW_MESSAGE_CAP) {
    return messages.slice();
  }
  return messages.slice(-normalizedCap);
};
