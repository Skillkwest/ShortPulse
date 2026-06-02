/**
 * Standard memory summary helpers.
 * Derives the lightweight working state used by Standard runtime memory.
 */
import type { AgentAttachment, AgentMessage } from "../../../../prefabs/agent";
import type { PromptOrigin } from "../../logic/agentPromptOwnership";

export type StandardSessionMemorySummary = {
  text: string | null;
  source: "derived_working_state" | "empty";
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

const clipSummaryField = (value: string | null, maxLength = 220): string | null => {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized.length) return null;
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}...`;
};

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

/**
 * Builds the compact Standard memory summary injected into outbound Standard turns.
 */
export const buildStandardMemorySummary = ({
  workingState,
}: {
  workingState: StandardSessionWorkingState;
}): StandardSessionMemorySummary => {
  const lines: string[] = [];
  const latestUserIntent = clipSummaryField(workingState.latestUserIntent);
  const latestAssistantCommitment = clipSummaryField(workingState.latestAssistantCommitment);
  const latestPromptArtifact = clipSummaryField(workingState.latestPromptArtifact);
  const attachedPromptText = clipSummaryField(workingState.attachedReferenceIntent.promptText, 160);

  if (latestUserIntent) {
    lines.push(`Latest user intent: ${latestUserIntent}`);
  }
  if (latestAssistantCommitment) {
    lines.push(`Latest assistant commitment: ${latestAssistantCommitment}`);
  }
  if (latestPromptArtifact) {
    lines.push(`Latest reusable prompt artifact: ${latestPromptArtifact}`);
  }
  if (attachedPromptText) {
    lines.push(`Attached prompt references: ${attachedPromptText}`);
  }
  if (workingState.attachedReferenceIntent.referenceIds.length > 0) {
    lines.push(
      `Attached reference count: ${workingState.attachedReferenceIntent.referenceIds.length}`
    );
  }
  if (workingState.attachedReferenceIntent.hasImageAttachment) {
    lines.push("Image attachments are present in this turn.");
  }

  if (!lines.length) {
    return {
      text: null,
      source: "empty",
    };
  }

  return {
    text: `Standard session memory:\n${lines.join("\n")}`,
    source: "derived_working_state",
  };
};
