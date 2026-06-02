/**
 * Standard memory summary helpers.
 * Derives the lightweight working state used by Standard runtime memory.
 */
import type { AgentAttachment, AgentMessage } from "../../../../prefabs/agent";
import type { PromptOrigin } from "../../logic/agentPromptOwnership";

export type StandardSessionMemorySummary = {
  text: string | null;
  source: "not_computed";
};

export type StandardAttachedReferenceIntent = {
  promptText: string | null;
  referenceIds: string[];
  hasImageAttachment: boolean;
};

export type StandardSessionWorkingState = {
  latestUserIntent: string | null;
  latestAssistantCommitment: string | null;
  latestPromptArtifact: string | null;
  promptOrigin: PromptOrigin;
  attachedReferenceIntent: StandardAttachedReferenceIntent;
};

const resolveLatestMessageContent = (
  messages: AgentMessage[],
  role: "user" | "assistant"
): string | null => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || message.role !== role) continue;
    const trimmed = message.content.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return null;
};

const resolveAttachedPromptText = (attachments: AgentAttachment[]): string | null => {
  const text = attachments
    .filter((attachment) => attachment.kind === "prompt")
    .map((attachment) => attachment.text?.trim() ?? "")
    .filter((value) => value.length > 0)
    .join("\n\n")
    .trim();
  return text.length > 0 ? text : null;
};

const resolveAttachedReferenceIntent = (
  attachments: AgentAttachment[]
): StandardAttachedReferenceIntent => ({
  promptText: resolveAttachedPromptText(attachments),
  referenceIds: Array.from(
    new Set(
      attachments
        .map((attachment) => attachment.referenceId)
        .filter((referenceId): referenceId is string => Boolean(referenceId))
    )
  ),
  hasImageAttachment: attachments.some((attachment) => attachment.kind === "image"),
});

export const buildStandardMemorySummary = (): StandardSessionMemorySummary => ({
  text: null,
  source: "not_computed",
});

export const buildStandardSessionWorkingState = ({
  transcriptWindow,
  latestPromptArtifact,
  promptOrigin,
  attachments = [],
}: {
  transcriptWindow: AgentMessage[];
  latestPromptArtifact: string | null;
  promptOrigin: PromptOrigin;
  attachments?: AgentAttachment[];
}): StandardSessionWorkingState => ({
  latestUserIntent: resolveLatestMessageContent(transcriptWindow, "user"),
  latestAssistantCommitment: resolveLatestMessageContent(transcriptWindow, "assistant"),
  latestPromptArtifact: latestPromptArtifact?.trim() || null,
  promptOrigin,
  attachedReferenceIntent: resolveAttachedReferenceIntent(attachments),
});
