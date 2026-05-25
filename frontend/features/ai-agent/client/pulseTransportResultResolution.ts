/**
 * Pulse Create response parser.
 * Owns workflow-session parsing for guided Pulse turns.
 */
import type {
  AgentActions,
  AgentPulseWorkflowSession,
  AgentResponse,
} from "../../../prefabs/agent";
import { sanitizeGenerationPromptText } from "../../agent-core/promptText";
import { normalizeActions } from "./actionNormalizer";

export type PulseCreateAgentTransportSuccess = {
  actions: AgentActions | undefined;
  workflowSession: AgentPulseWorkflowSession | null;
  canonicalPrompt: string | null;
  assistantContent: string;
  assistantOutputPrompt: string | null;
};

const resolveWorkflowSession = (
  response: AgentResponse | null | undefined
): AgentPulseWorkflowSession | null => {
  const workflowSession = response?.workflowSession;
  if (!workflowSession || typeof workflowSession.presetId !== "string") {
    return null;
  }
  return {
    presetId: workflowSession.presetId.trim(),
    status:
      workflowSession.status === "running" ||
      workflowSession.status === "awaiting_input" ||
      workflowSession.status === "completed"
        ? workflowSession.status
        : "idle",
    currentStepIndex:
      typeof workflowSession.currentStepIndex === "number" &&
      Number.isFinite(workflowSession.currentStepIndex)
        ? Math.max(1, Math.trunc(workflowSession.currentStepIndex))
        : null,
    currentStepLabel:
      typeof workflowSession.currentStepLabel === "string" &&
      workflowSession.currentStepLabel.trim().length > 0
        ? workflowSession.currentStepLabel.trim()
        : null,
    currentStepPrompt:
      typeof workflowSession.currentStepPrompt === "string" &&
      workflowSession.currentStepPrompt.trim().length > 0
        ? workflowSession.currentStepPrompt.trim()
        : null,
    collectedInputs: Array.isArray(workflowSession.collectedInputs)
      ? workflowSession.collectedInputs
          .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
          .filter((entry) => entry.length > 0)
      : [],
    lastArtifact:
      typeof workflowSession.lastArtifact === "string" &&
      workflowSession.lastArtifact.trim().length > 0
        ? workflowSession.lastArtifact.trim()
        : null,
    finalArtifactSource:
      workflowSession.finalArtifactSource === "apply_prompt" ||
      workflowSession.finalArtifactSource === "chat_reply"
        ? workflowSession.finalArtifactSource
        : null,
  };
};

const normalizeExactArtifactText = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const resolvePulseCreateAgentTransportSuccess = (
  response: AgentResponse
): PulseCreateAgentTransportSuccess => {
  const actions = normalizeActions(response.actions);
  const workflowSession = resolveWorkflowSession(response);
  const canonicalPrompt = sanitizeGenerationPromptText(
    response.canonicalPrompt ?? actions?.applyPrompt ?? null
  );
  const applyPromptText = sanitizeGenerationPromptText(actions?.applyPrompt ?? null) ?? "";
  const completedChatReplyArtifact =
    workflowSession?.status === "completed" && workflowSession.finalArtifactSource === "chat_reply"
      ? (normalizeExactArtifactText(workflowSession.lastArtifact) ?? "")
      : "";
  const messageText = typeof response.message === "string" ? response.message.trim() : "";
  const workflowStepPrompt =
    workflowSession?.status !== "completed"
      ? (normalizeExactArtifactText(workflowSession?.currentStepPrompt) ?? "")
      : "";
  return {
    actions,
    workflowSession,
    canonicalPrompt,
    assistantContent:
      completedChatReplyArtifact || applyPromptText || messageText || workflowStepPrompt,
    assistantOutputPrompt: completedChatReplyArtifact || applyPromptText || null,
  };
};
