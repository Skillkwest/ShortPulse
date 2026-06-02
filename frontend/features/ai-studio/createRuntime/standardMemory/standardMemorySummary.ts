/**
 * Standard memory summary helpers.
 * Derives the lightweight working state used by Standard runtime memory.
 */
import type { AgentAttachment, AgentMessage } from "../../../../prefabs/agent";
import type { PromptOrigin } from "../../logic/agentPromptOwnership";
import { canUseAssistantMessageAsPrompt } from "../agentRuntimeShared";

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
  currentTask: string | null;
  constraints: string[];
  decisionsMade: string[];
  openQuestions: string[];
  referencesInPlay: string[];
  lastAcceptedPrompt: string | null;
  nextBestAction: string | null;
  promptOrigin: PromptOrigin;
  attachedReferenceIntent: StandardAttachedReferenceIntent;
};

type LatestRoleContent = {
  role: "user" | "assistant";
  content: string;
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

const resolveLatestRoleContent = (messages: AgentMessage[]): LatestRoleContent | null => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || (message.role !== "user" && message.role !== "assistant")) continue;
    const trimmed = message.content.trim();
    if (!trimmed.length) continue;
    return { role: message.role, content: trimmed };
  }
  return null;
};

const resolvePreviousUserIntent = (messages: AgentMessage[]): string | null => {
  let seenLatestUser = false;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || message.role !== "user") continue;
    const trimmed = message.content.trim();
    if (!trimmed.length) continue;
    if (!seenLatestUser) {
      seenLatestUser = true;
      continue;
    }
    return trimmed;
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

const normalizeListItem = (value: string, maxLength = 140): string | null =>
  clipSummaryField(value, maxLength);

const splitConstraintCandidates = (value: string | null): string[] => {
  if (!value) return [];
  return value
    .split(/\n+|[;•]/)
    .map((part) => normalizeListItem(part))
    .filter((part): part is string => Boolean(part));
};

const uniqueLimited = (values: Array<string | null | undefined>, maxItems = 3): string[] =>
  Array.from(
    new Set(values.filter((value): value is string => Boolean(value && value.trim())))
  ).slice(0, maxItems);

const resolveTranscriptAcceptedPrompt = (messages: AgentMessage[]): string | null => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || !canUseAssistantMessageAsPrompt(message)) continue;
    const trimmed = message.outputPrompt?.trim() ?? "";
    if (trimmed.length > 0) return trimmed;
  }
  return null;
};

const resolveOpenQuestions = (latestAssistantCommitment: string | null): string[] => {
  if (!latestAssistantCommitment || !latestAssistantCommitment.includes("?")) {
    return [];
  }
  const matches = latestAssistantCommitment.match(/[^?]*\?/g) ?? [];
  return uniqueLimited(
    matches.map((match) => normalizeListItem(match.trim(), 160)),
    2
  );
};

const resolveCurrentTask = ({
  latestUserIntent,
  previousUserIntent,
  latestAssistantCommitment,
  latestRoleContent,
}: {
  latestUserIntent: string | null;
  previousUserIntent: string | null;
  latestAssistantCommitment: string | null;
  latestRoleContent: LatestRoleContent | null;
}): string | null => {
  if (!latestUserIntent) {
    return null;
  }
  if (
    latestRoleContent?.role === "user" &&
    previousUserIntent &&
    latestAssistantCommitment?.includes("?")
  ) {
    return previousUserIntent;
  }
  return latestUserIntent;
};

const resolveReferencesInPlay = ({
  promptOrigin,
  attachedReferenceIntent,
}: {
  promptOrigin: PromptOrigin;
  attachedReferenceIntent: StandardAttachedReferenceIntent;
}): string[] => {
  const items: string[] = [];
  if (attachedReferenceIntent.referenceIds.length > 0) {
    items.push(
      `${attachedReferenceIntent.referenceIds.length} selected reference${
        attachedReferenceIntent.referenceIds.length === 1 ? "" : "s"
      }`
    );
  }
  if (attachedReferenceIntent.hasImageAttachment) {
    items.push("image attachments");
  }
  if (attachedReferenceIntent.promptText) {
    items.push("attached prompt references");
  }
  if (promptOrigin === "reference") {
    items.push("reference-authored prompt");
  }
  return uniqueLimited(items, 4);
};

const resolveDecisionsMade = ({
  lastAcceptedPrompt,
  promptOrigin,
}: {
  lastAcceptedPrompt: string | null;
  promptOrigin: PromptOrigin;
}): string[] => {
  const items: string[] = [];
  if (lastAcceptedPrompt) {
    items.push("A reusable prompt is available.");
  }
  if (promptOrigin === "agent") {
    items.push("The current prompt source is the assistant.");
  } else if (promptOrigin === "reference") {
    items.push("The current prompt source is references.");
  }
  return uniqueLimited(items, 3);
};

const resolveNextBestAction = ({
  currentTask,
  lastAcceptedPrompt,
  openQuestions,
  referencesInPlay,
}: {
  currentTask: string | null;
  lastAcceptedPrompt: string | null;
  openQuestions: string[];
  referencesInPlay: string[];
}): string | null => {
  if (openQuestions.length > 0) {
    return "Answer the assistant's open question before refining further.";
  }
  if (lastAcceptedPrompt) {
    return "Refine or generate from the accepted prompt.";
  }
  if (referencesInPlay.length > 0) {
    return "Use the active references to shape the next reply or prompt.";
  }
  if (currentTask) {
    return "Respond directly to the current task.";
  }
  return null;
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
}): StandardSessionWorkingState => {
  const latestRoleContent = resolveLatestRoleContent(transcriptWindow);
  const latestUserIntent = resolveLatestMessageContent(transcriptWindow, "user");
  const latestAssistantCommitment = resolveLatestMessageContent(transcriptWindow, "assistant");
  const previousUserIntent = resolvePreviousUserIntent(transcriptWindow);
  const lastAcceptedPrompt =
    latestPromptArtifact?.trim() || resolveTranscriptAcceptedPrompt(transcriptWindow);
  const attachedReferenceIntent = resolveAttachedReferenceIntent(attachments);
  const currentTask = resolveCurrentTask({
    latestUserIntent,
    previousUserIntent,
    latestAssistantCommitment,
    latestRoleContent,
  });
  const constraints = uniqueLimited(
    splitConstraintCandidates(attachedReferenceIntent.promptText),
    3
  );
  const openQuestions =
    latestRoleContent?.role === "assistant" ? resolveOpenQuestions(latestAssistantCommitment) : [];
  const referencesInPlay = resolveReferencesInPlay({
    promptOrigin,
    attachedReferenceIntent,
  });
  const decisionsMade = resolveDecisionsMade({
    lastAcceptedPrompt,
    promptOrigin,
  });
  return {
    latestUserIntent,
    latestAssistantCommitment,
    currentTask,
    constraints,
    decisionsMade,
    openQuestions,
    referencesInPlay,
    lastAcceptedPrompt,
    nextBestAction: resolveNextBestAction({
      currentTask,
      lastAcceptedPrompt,
      openQuestions,
      referencesInPlay,
    }),
    promptOrigin,
    attachedReferenceIntent,
  };
};

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
  const latestPromptArtifact = clipSummaryField(workingState.lastAcceptedPrompt);
  const attachedPromptText = clipSummaryField(workingState.attachedReferenceIntent.promptText, 160);
  const activeConstraints =
    workingState.constraints.length > 0 ? workingState.constraints.join(" | ") : null;
  const decisionsMade =
    workingState.decisionsMade.length > 0 ? workingState.decisionsMade.join(" | ") : null;
  const openQuestions =
    workingState.openQuestions.length > 0 ? workingState.openQuestions.join(" | ") : null;
  const referencesInPlay =
    workingState.referencesInPlay.length > 0 ? workingState.referencesInPlay.join(" | ") : null;
  const nextBestAction = clipSummaryField(workingState.nextBestAction, 160);

  if (latestUserIntent) {
    lines.push(`Latest user intent: ${latestUserIntent}`);
  }
  if (latestAssistantCommitment) {
    lines.push(`Latest assistant commitment: ${latestAssistantCommitment}`);
  }
  if (latestPromptArtifact) {
    lines.push(`Latest reusable prompt artifact: ${latestPromptArtifact}`);
  }
  if (activeConstraints) {
    lines.push(`Active constraints: ${activeConstraints}`);
  }
  if (decisionsMade) {
    lines.push(`Decisions carried forward: ${decisionsMade}`);
  }
  if (openQuestions) {
    lines.push(`Open questions: ${openQuestions}`);
  }
  if (referencesInPlay) {
    lines.push(`References in play: ${referencesInPlay}`);
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
  if (nextBestAction) {
    lines.push(`Next best action: ${nextBestAction}`);
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
