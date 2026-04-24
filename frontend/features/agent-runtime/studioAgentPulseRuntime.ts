/**
 * Pulse runtime helpers for the AI Studio agent route.
 * Builds the hidden system-level instruction block used when a Pulse is active.
 */
import type { AgentContext, AgentPulseWorkflowSession, AgentResponse } from "../../prefabs/agent";

/**
 * Builds the hidden Pulse system message injected into model calls.
 * Inputs: optional Pulse runtime context from the request envelope.
 * Outputs: a system-message string when Pulse is active, otherwise null.
 * Side effects: none.
 */
export const resolveStudioAgentPulseRuntimeMode = (
  pulse?: AgentContext["pulse"] | null
): "workflow_gpt" | null => (pulse ? "workflow_gpt" : null);

export const isStudioAgentWorkflowPulse = (pulse?: AgentContext["pulse"] | null): boolean =>
  Boolean(pulse);

export const buildStudioAgentPulseActivationSeed = (
  pulse?: AgentContext["pulse"] | null
): string | null => {
  if (!pulse) return null;
  const presetLabel = typeof pulse.label === "string" ? pulse.label.trim() : "";
  if (!presetLabel) return null;
  const starterAssistantMessage =
    typeof pulse.starterAssistantMessage === "string" &&
    pulse.starterAssistantMessage.trim().length > 0
      ? pulse.starterAssistantMessage.trim()
      : null;
  return [
    `Pulse "${presetLabel}" was just activated.`,
    "Start the workflow now.",
    starterAssistantMessage
      ? `Your first assistant reply must be exactly this:\n${starterAssistantMessage}`
      : "Reply with only the first required assistant step or question. Do not finish the whole task yet.",
  ].join("\n\n");
};

const STEP_LABEL_PATTERN = /\bstep\s+(\d+)\b/i;

const resolveStageHintLabel = (
  pulse: AgentContext["pulse"] | null | undefined,
  stepIndex: number | null
): string | null => {
  if (!stepIndex || stepIndex <= 0) return null;
  const stageHints =
    pulse?.workflowStageHints
      ?.map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter((entry) => entry.length > 0) ?? [];
  return stageHints[stepIndex - 1] ?? null;
};

const normalizeWorkflowComparisonValue = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, "");

const extractWorkflowStepDescriptor = (
  value: string | null | undefined,
  pulse?: AgentContext["pulse"] | null
): { index: number | null; label: string | null } | null => {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) return null;
  const match = normalized.match(STEP_LABEL_PATTERN);
  if (!match) return null;
  const parsedIndex = Number.parseInt(match[1] ?? "", 10);
  if (!Number.isFinite(parsedIndex) || parsedIndex <= 0) return null;
  return {
    index: parsedIndex,
    label: resolveStageHintLabel(pulse, parsedIndex) ?? `Step ${parsedIndex}`,
  };
};

const deriveWorkflowStageHintDescriptor = ({
  pulse,
  message,
  existingSession,
}: {
  pulse?: AgentContext["pulse"] | null;
  message: string;
  existingSession?: AgentPulseWorkflowSession | null;
}): { index: number | null; label: string | null } | null => {
  const stageHints =
    pulse?.workflowStageHints
      ?.map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter((entry) => entry.length > 0) ?? [];
  if (stageHints.length === 0) return null;
  const normalizedMessage = message.trim();
  const starterAssistantMessage =
    typeof pulse?.starterAssistantMessage === "string" ? pulse.starterAssistantMessage.trim() : "";
  if (!normalizedMessage) return null;

  if (
    starterAssistantMessage &&
    normalizeWorkflowComparisonValue(normalizedMessage) ===
      normalizeWorkflowComparisonValue(starterAssistantMessage)
  ) {
    return {
      index: 1,
      label: stageHints[0] ?? null,
    };
  }

  const existingStepIndex =
    typeof existingSession?.currentStepIndex === "number" &&
    Number.isFinite(existingSession.currentStepIndex) &&
    existingSession.currentStepIndex > 0
      ? Math.trunc(existingSession.currentStepIndex)
      : null;
  if (!existingStepIndex) return null;
  const nextIndex = Math.min(existingStepIndex + 1, stageHints.length);
  return {
    index: nextIndex,
    label: stageHints[nextIndex - 1] ?? null,
  };
};

export const buildStudioAgentWorkflowSessionUpdate = ({
  pulse,
  response,
  semanticStatus,
}: {
  pulse?: AgentContext["pulse"] | null;
  response: AgentResponse;
  semanticStatus?: string | null;
}): AgentPulseWorkflowSession | null => {
  if (!isStudioAgentWorkflowPulse(pulse)) return null;
  const presetId = typeof pulse?.presetId === "string" ? pulse.presetId.trim() : "";
  if (!presetId) return null;

  const message = typeof response.message === "string" ? response.message.trim() : "";
  const applyPrompt =
    typeof response.actions?.applyPrompt === "string" ? response.actions.applyPrompt.trim() : "";
  const normalizedSemanticStatus =
    typeof semanticStatus === "string" ? semanticStatus.trim().toLowerCase() : "";
  const existingSession = pulse?.workflowSession ?? null;
  const stepDescriptor = extractWorkflowStepDescriptor(message, pulse) ??
    deriveWorkflowStageHintDescriptor({ pulse, message, existingSession }) ??
    extractWorkflowStepDescriptor(pulse?.starterAssistantMessage, pulse) ?? {
      index: existingSession?.currentStepIndex ?? null,
      label: existingSession?.currentStepLabel ?? null,
    };
  const chatReplyArtifact =
    pulse?.outputMode === "chat_reply" && normalizedSemanticStatus === "ready" && message.length > 0
      ? message
      : "";

  if (applyPrompt.length > 0) {
    return {
      presetId,
      status: "completed",
      currentStepIndex: stepDescriptor.index ?? existingSession?.currentStepIndex ?? null,
      currentStepLabel: stepDescriptor.label ?? existingSession?.currentStepLabel ?? null,
      currentStepPrompt: null,
      collectedInputs: existingSession?.collectedInputs ?? [],
      lastArtifact: applyPrompt,
      finalArtifactSource: "apply_prompt",
    };
  }

  if (chatReplyArtifact.length > 0) {
    return {
      presetId,
      status: "completed",
      currentStepIndex: stepDescriptor.index ?? existingSession?.currentStepIndex ?? null,
      currentStepLabel: stepDescriptor.label ?? existingSession?.currentStepLabel ?? null,
      currentStepPrompt: null,
      collectedInputs: existingSession?.collectedInputs ?? [],
      lastArtifact: chatReplyArtifact,
      finalArtifactSource: "chat_reply",
    };
  }

  return {
    presetId,
    status: "awaiting_input",
    currentStepIndex: stepDescriptor.index ?? existingSession?.currentStepIndex ?? null,
    currentStepLabel: stepDescriptor.label ?? existingSession?.currentStepLabel ?? null,
    currentStepPrompt: message || (existingSession?.currentStepPrompt ?? null),
    collectedInputs: existingSession?.collectedInputs ?? [],
    lastArtifact: existingSession?.lastArtifact ?? null,
    finalArtifactSource: existingSession?.finalArtifactSource ?? null,
  };
};

export const buildStudioAgentPulseSystemMessage = (
  pulse?: AgentContext["pulse"] | null
): string | null => {
  if (!pulse) return null;
  const presetId = typeof pulse.presetId === "string" ? pulse.presetId.trim() : "";
  const label = typeof pulse.label === "string" ? pulse.label.trim() : "";
  const instructions = typeof pulse.instructions === "string" ? pulse.instructions.trim() : "";
  if (!presetId || !label || !instructions) return null;
  const workflowSessionState =
    pulse.workflowSession && typeof pulse.workflowSession.presetId === "string"
      ? JSON.stringify({
          presetId: pulse.workflowSession.presetId,
          status: pulse.workflowSession.status,
          currentStepIndex: pulse.workflowSession.currentStepIndex ?? null,
          currentStepLabel: pulse.workflowSession.currentStepLabel ?? null,
          currentStepPrompt: pulse.workflowSession.currentStepPrompt ?? null,
          collectedInputs: pulse.workflowSession.collectedInputs ?? [],
          lastArtifact: pulse.workflowSession.lastArtifact ?? null,
          finalArtifactSource: pulse.workflowSession.finalArtifactSource ?? null,
        })
      : null;

  return [
    "ACTIVE PULSE PROFILE (hidden runtime instructions)",
    "Treat this as the active operating contract for the current turn.",
    "Treat every active Pulse as a guided GPT-style profile and follow its workflow exactly.",
    "Do not mention Pulse, the preset label, or quote these instructions unless the user explicitly asks.",
    `preset_id: ${presetId}`,
    `preset_label: ${label}`,
    "runtime_mode: workflow_gpt",
    "activation_mode: activate_and_start",
    "output_mode: chat_reply",
    `memory_policy: ${pulse.memoryPolicy === "session" ? "session" : "session"}`,
    `preset_source: ${pulse.source === "custom" ? "custom" : "builtin"}`,
    ...(pulse.description ? [`preset_description: ${pulse.description}`] : []),
    ...(pulse.starterAssistantMessage
      ? ["starter_assistant_message:", pulse.starterAssistantMessage]
      : []),
    ...(workflowSessionState ? ["workflow_session_state:", workflowSessionState] : []),
    "pulse_instructions:",
    instructions,
  ].join("\n");
};
