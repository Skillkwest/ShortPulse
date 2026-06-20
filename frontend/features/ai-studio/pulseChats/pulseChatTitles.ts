/**
 * Pulse saved-chat title and timestamp helpers.
 * Keeps left-rail chat labels deterministic without adding provider calls or new persistence authority.
 */
import type { AiStudioSessionAgentV1 } from "../logic/sessionSnapshot";
import type { PulseChatThreadSnapshot } from "./pulseChatThread";

const DEFAULT_THREAD_TITLE = "New chat";
const MAX_THREAD_TITLE_LENGTH = 56;
const MAX_THREAD_TITLE_WORDS = 5;
const TITLE_WORD_PATTERN = /[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)?/gu;

const normalizeText = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length > 0 ? normalized : null;
};

const stripActivationSeed = (value: string): string | null => {
  if (!value.startsWith("pulse_activation_seed:")) return value;
  return null;
};

const firstSentence = (value: string): string => {
  const sentenceMatch = value.match(/^(.+?[.!?])(?:\s|$)/);
  return sentenceMatch?.[1] ?? value;
};

const clipTitle = (value: string): string => {
  const normalized = value.trim().replace(/\s+/g, " ");
  const words = normalized.match(TITLE_WORD_PATTERN);
  const wordLimited = words?.slice(0, MAX_THREAD_TITLE_WORDS).join(" ") ?? normalized;
  if (wordLimited.length <= MAX_THREAD_TITLE_LENGTH) return wordLimited;
  return `${wordLimited.slice(0, MAX_THREAD_TITLE_LENGTH - 3).trimEnd()}...`;
};

const resolveMessageContent = (
  messages: AiStudioSessionAgentV1["messages"],
  role: "user" | "assistant"
): string | null => {
  for (const message of messages) {
    if (message.role !== role) continue;
    const content = normalizeText(message.content);
    if (!content) continue;
    const visibleContent = stripActivationSeed(content);
    if (visibleContent) return visibleContent;
  }
  return null;
};

/**
 * Normalizes user-authored chat titles for project snapshot persistence.
 */
export const normalizePulseChatTitle = (value: unknown): string | null => {
  const normalized = normalizeText(value);
  return normalized ? clipTitle(normalized) : null;
};

/**
 * Derives a stable, local-only title from a Pulse chat snapshot.
 */
export const resolvePulseChatThreadTitle = (snapshot: PulseChatThreadSnapshot): string => {
  const userMessage = resolveMessageContent(snapshot.runtime.messages, "user");
  if (userMessage) return clipTitle(firstSentence(userMessage));

  const assistantMessage = resolveMessageContent(snapshot.runtime.messages, "assistant");
  if (assistantMessage) return clipTitle(firstSentence(assistantMessage));

  return clipTitle(snapshot.meta.presetLabel ?? DEFAULT_THREAD_TITLE);
};

/**
 * Formats saved-chat recency as a compact explicit date and time.
 */
export const formatPulseChatTimestamp = (value: string): string => {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
};
