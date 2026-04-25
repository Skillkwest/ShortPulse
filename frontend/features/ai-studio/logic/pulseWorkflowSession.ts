import type { AgentMessage, AgentPulseWorkflowSession } from "../../../prefabs/agent";

type PulseWorkflowPreset = {
  presetId: string;
  runtimeMode?: "prompt_editor" | "workflow_gpt";
  starterAssistantMessage?: string | null;
  workflowStageHints?: readonly string[] | null;
};

type WorkflowStepDescriptor = {
  index: number | null;
  label: string;
};

const resolveStageHintLabel = (
  stageHints: readonly string[] | null | undefined,
  stepIndex: number | null
): string | null => {
  if (!stepIndex || stepIndex <= 0) return null;
  const normalizedHints =
    stageHints?.map((entry) => entry.trim()).filter((entry) => entry.length > 0) ?? [];
  return normalizedHints[stepIndex - 1] ?? null;
};

const STEP_LABEL_PATTERN = /\bstep\s+(\d+)\b/i;

export const extractPulseWorkflowStepDescriptor = (
  value: string | null | undefined,
  stageHints?: readonly string[] | null
): WorkflowStepDescriptor | null => {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) return null;
  const match = normalized.match(STEP_LABEL_PATTERN);
  if (!match) return null;
  const parsedIndex = Number.parseInt(match[1] ?? "", 10);
  if (!Number.isFinite(parsedIndex) || parsedIndex <= 0) return null;
  return {
    index: parsedIndex,
    label: resolveStageHintLabel(stageHints, parsedIndex) ?? `Step ${parsedIndex}`,
  };
};

export const derivePulseWorkflowStageHintDescriptor = (
  stageHints: readonly string[] | null | undefined,
  assistantMessages: readonly AgentMessage[],
  userInputCount: number
): WorkflowStepDescriptor | null => {
  const hints = stageHints?.map((entry) => entry.trim()).filter((entry) => entry.length > 0) ?? [];
  if (hints.length === 0) return null;
  const hasAssistantMessages = assistantMessages.length > 0;
  const baseIndex = hasAssistantMessages ? userInputCount : 0;
  const resolvedIndex = Math.max(0, Math.min(baseIndex, hints.length - 1));
  const resolvedLabel = hints[resolvedIndex] ?? null;
  if (!resolvedLabel) return null;
  return {
    index: resolvedIndex + 1,
    label: resolvedLabel,
  };
};

const resolveInitialPulseWorkflowStepDescriptor = ({
  starterAssistantMessage,
  workflowStageHints,
}: {
  starterAssistantMessage?: string | null;
  workflowStageHints?: readonly string[] | null;
}): WorkflowStepDescriptor | null =>
  extractPulseWorkflowStepDescriptor(starterAssistantMessage, workflowStageHints) ??
  derivePulseWorkflowStageHintDescriptor(workflowStageHints, [], 0);

export const buildPendingPulseWorkflowSessionForStart = ({
  preset,
}: {
  preset?: PulseWorkflowPreset | null;
}): AgentPulseWorkflowSession | null => {
  if (!preset || preset.runtimeMode !== "workflow_gpt") return null;
  const presetId = typeof preset.presetId === "string" ? preset.presetId.trim() : "";
  if (!presetId) return null;
  const stepDescriptor = resolveInitialPulseWorkflowStepDescriptor(preset);
  const starterPrompt = preset.starterAssistantMessage?.trim() ?? null;
  return {
    presetId,
    status: "running",
    currentStepIndex: stepDescriptor?.index ?? null,
    currentStepLabel: stepDescriptor?.label ?? null,
    currentStepPrompt: starterPrompt || null,
    collectedInputs: [],
    lastArtifact: null,
    finalArtifactSource: null,
  };
};

export const buildPendingPulseWorkflowSessionForUserInput = ({
  preset,
  existingSession,
  userInput,
}: {
  preset?: PulseWorkflowPreset | null;
  existingSession?: AgentPulseWorkflowSession | null;
  userInput: string;
}): AgentPulseWorkflowSession | null => {
  if (!preset || preset.runtimeMode !== "workflow_gpt") return null;
  const presetId = typeof preset.presetId === "string" ? preset.presetId.trim() : "";
  if (!presetId) return null;
  const currentSession =
    existingSession?.presetId === presetId
      ? existingSession
      : buildPendingPulseWorkflowSessionForStart({ preset });
  const normalizedInput = userInput.trim();
  return {
    presetId,
    status: "running",
    currentStepIndex: currentSession?.currentStepIndex ?? null,
    currentStepLabel: currentSession?.currentStepLabel ?? null,
    currentStepPrompt:
      currentSession?.currentStepPrompt ?? preset.starterAssistantMessage?.trim() ?? null,
    collectedInputs:
      normalizedInput.length > 0
        ? [...(currentSession?.collectedInputs ?? []), normalizedInput]
        : [...(currentSession?.collectedInputs ?? [])],
    lastArtifact:
      currentSession?.status === "completed" ? null : (currentSession?.lastArtifact ?? null),
    finalArtifactSource: null,
  };
};

export const derivePulseWorkflowSession = ({
  preset,
  agentMessages,
  isSending,
}: {
  preset?: PulseWorkflowPreset | null;
  agentMessages: readonly AgentMessage[];
  isSending: boolean;
}): AgentPulseWorkflowSession | null => {
  if (!preset || preset.runtimeMode !== "workflow_gpt") return null;
  const presetId = typeof preset.presetId === "string" ? preset.presetId.trim() : "";
  if (!presetId) return null;

  const assistantMessages = agentMessages.filter(
    (message) => message.role === "assistant" && message.content.trim().length > 0
  );
  const userInputs = agentMessages
    .filter((message) => message.role === "user")
    .map((message) => message.content.trim())
    .filter((content) => content.length > 0);
  if (assistantMessages.length === 0 && userInputs.length === 0) {
    return null;
  }
  const latestAssistantMessage = assistantMessages.at(-1)?.content.trim() ?? null;
  const fallbackPrompt = latestAssistantMessage ?? preset.starterAssistantMessage?.trim() ?? null;
  const currentStepDescriptor =
    extractPulseWorkflowStepDescriptor(latestAssistantMessage, preset.workflowStageHints) ??
    (assistantMessages.length > 0
      ? derivePulseWorkflowStageHintDescriptor(
          preset.workflowStageHints,
          assistantMessages,
          userInputs.length
        )
      : null) ??
    extractPulseWorkflowStepDescriptor(preset.starterAssistantMessage, preset.workflowStageHints) ??
    (assistantMessages.length === 0
      ? derivePulseWorkflowStageHintDescriptor(
          preset.workflowStageHints,
          assistantMessages,
          userInputs.length
        )
      : null);

  return {
    presetId,
    status: isSending
      ? "running"
      : latestAssistantMessage
        ? "awaiting_input"
        : userInputs.length > 0
          ? "running"
          : "idle",
    currentStepIndex: currentStepDescriptor?.index ?? null,
    currentStepLabel: currentStepDescriptor?.label ?? null,
    currentStepPrompt: fallbackPrompt,
    collectedInputs: userInputs,
    lastArtifact: null,
    finalArtifactSource: null,
  };
};

export const reconcilePulseWorkflowSession = ({
  authoritative,
  derived,
  isSending,
}: {
  authoritative?: AgentPulseWorkflowSession | null;
  derived?: AgentPulseWorkflowSession | null;
  isSending: boolean;
}): AgentPulseWorkflowSession | null => {
  if (!authoritative && !derived) return null;
  if (!authoritative) return derived ?? null;
  if (!derived) return authoritative;
  if (authoritative.presetId !== derived.presetId) return derived;
  return {
    presetId: derived.presetId,
    status:
      authoritative.status === "completed"
        ? "completed"
        : isSending
          ? "running"
          : authoritative.status,
    currentStepIndex: authoritative.currentStepIndex ?? derived.currentStepIndex ?? null,
    currentStepLabel: authoritative.currentStepLabel ?? derived.currentStepLabel ?? null,
    currentStepPrompt:
      authoritative.status === "completed"
        ? null
        : (authoritative.currentStepPrompt ?? derived.currentStepPrompt ?? null),
    collectedInputs: derived.collectedInputs,
    lastArtifact: authoritative.lastArtifact ?? derived.lastArtifact ?? null,
    finalArtifactSource: authoritative.finalArtifactSource ?? derived.finalArtifactSource ?? null,
  };
};

export const arePulseWorkflowSessionsEqual = (
  left: AgentPulseWorkflowSession | null | undefined,
  right: AgentPulseWorkflowSession | null | undefined
): boolean => {
  if (!left && !right) return true;
  if (!left || !right) return false;
  if (left.presetId !== right.presetId) return false;
  if (left.status !== right.status) return false;
  if ((left.currentStepIndex ?? null) !== (right.currentStepIndex ?? null)) return false;
  if ((left.currentStepLabel ?? null) !== (right.currentStepLabel ?? null)) return false;
  if ((left.currentStepPrompt ?? null) !== (right.currentStepPrompt ?? null)) return false;
  if ((left.lastArtifact ?? null) !== (right.lastArtifact ?? null)) return false;
  if ((left.finalArtifactSource ?? null) !== (right.finalArtifactSource ?? null)) return false;
  if (left.collectedInputs.length !== right.collectedInputs.length) return false;
  return left.collectedInputs.every((value, index) => value === right.collectedInputs[index]);
};
