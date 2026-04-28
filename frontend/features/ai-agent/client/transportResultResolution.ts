import type { AgentPulseWorkflowSession, AgentResponse } from "../../../prefabs/agent";
import { normalizeErrorText } from "../../../lib/errorText";
import { sanitizeGenerationPromptText } from "../../agent-core/promptText";
import { STUDIO_AGENT_INFRA_FALLBACK_MESSAGE } from "../../agent-runtime/studioAgentFailurePolicy";
import { SAFETY_REFUSAL_MESSAGE, resolveSafetyRefusalText } from "../agentClientSafety";
import { normalizeActions } from "./actionNormalizer";
import type { StudioAgentTransportResult } from "./studioAgentTransport";

type StudioAgentTransportFailureResult = Extract<StudioAgentTransportResult, { ok: false }>;

type TransportFailureResolution = {
  assistantMessage: string | null;
  response: AgentResponse | null;
  errorText: string | null;
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

export const resolveStudioAgentTransportFailure = (
  transportResult: StudioAgentTransportFailureResult
): TransportFailureResolution => {
  const machineDecision = transportResult.parsedError?.decision;
  const machineOutcomeClass = transportResult.parsedError?.outcome_class;
  if (machineDecision === "refuse") {
    const refusalText =
      resolveSafetyRefusalText(
        transportResult.parsedError?.message ??
          transportResult.parsedError?.detail ??
          transportResult.parsedError?.error
      ) ?? SAFETY_REFUSAL_MESSAGE;
    return {
      assistantMessage: refusalText,
      response: {
        message: refusalText,
        actions: undefined,
        decision: "refuse",
        outcome_class: machineOutcomeClass ?? "refusal_safety",
        reason_code: transportResult.parsedError?.reason_code,
        retryable: transportResult.parsedError?.retryable,
        fallback_reason: transportResult.parsedError?.fallback_reason,
      },
      errorText: null,
    };
  }
  if (machineDecision === "allow" && machineOutcomeClass === "fallback_infra") {
    const fallbackText = normalizeErrorText(
      transportResult.parsedError?.message ??
        transportResult.parsedError?.detail ??
        transportResult.parsedError?.error,
      {
        fallback: STUDIO_AGENT_INFRA_FALLBACK_MESSAGE,
        maxLength: 160,
      }
    );
    return {
      assistantMessage: fallbackText,
      response: {
        message: fallbackText,
        actions: undefined,
        decision: "allow",
        outcome_class: "fallback_infra",
        reason_code: transportResult.parsedError?.reason_code,
        retryable: transportResult.parsedError?.retryable,
        fallback_reason: transportResult.parsedError?.fallback_reason,
      },
      errorText: null,
    };
  }
  const refusalText = resolveSafetyRefusalText(
    transportResult.parsedError ?? transportResult.detail
  );
  if (refusalText) {
    return {
      assistantMessage: refusalText,
      response: { message: refusalText, actions: undefined },
      errorText: null,
    };
  }
  const structuredErrorText =
    transportResult.parsedError?.message ??
    transportResult.parsedError?.detail ??
    transportResult.parsedError?.error;
  return {
    assistantMessage: null,
    response: null,
    errorText: normalizeErrorText(structuredErrorText ?? transportResult.detail, {
      fallback: `Agent request failed (${transportResult.status})`,
      maxLength: 320,
    }),
  };
};

export const resolveStudioAgentTransportSuccess = (response: AgentResponse) => {
  const actions = normalizeActions(response.actions);
  const canonicalPrompt = sanitizeGenerationPromptText(
    response.canonicalPrompt ?? actions?.applyPrompt ?? null
  );
  const applyPromptText = sanitizeGenerationPromptText(actions?.applyPrompt ?? null) ?? "";
  const messageText = sanitizeGenerationPromptText(response.message ?? null) ?? "";
  return {
    actions,
    workflowSession: resolveWorkflowSession(response),
    canonicalPrompt,
    assistantContent: applyPromptText || messageText,
    assistantOutputPrompt: applyPromptText || null,
  };
};
