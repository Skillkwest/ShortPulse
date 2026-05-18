/**
 * Helpers to build the context payload sent to the agent API.
 * Keeps filtering and size caps in one place so UI code stays lean.
 */
import type {
  AgentApiContext,
  AgentApiMediaPreview,
  AgentContext,
  AgentPulseWorkflowSession,
  AgentPulseRuntimeContext,
  AgentReferenceSummary,
} from "../../../prefabs/agent";
import { pickSafeAgentImageMediaUrls } from "../../../prefabs/agent/mediaUrlPolicy";

const GUIDED_PULSE_RUNTIME_MODE = "workflow_gpt" as const;
const GUIDED_PULSE_ACTIVATION_MODE = "activate_and_start" as const;
const GUIDED_PULSE_OUTPUT_MODE = "chat_reply" as const;
const GUIDED_PULSE_KIND = "guided_workflow" as const;
const CUSTOM_PULSE_KIND = "custom_gpt" as const;

const normalizePulseArtifactTarget = (
  value: AgentPulseRuntimeContext["artifactTarget"]
): AgentPulseRuntimeContext["artifactTarget"] | undefined =>
  value === "image_prompt" ||
  value === "video_prompt" ||
  value === "storyboard" ||
  value === "text_artifact"
    ? value
    : undefined;

const pickMediaPreviews = (media?: AgentContext["media"]): AgentApiMediaPreview[] => {
  if (!media || !media.length) return [];
  return pickSafeAgentImageMediaUrls(
    media
      // Videos are not processed by the agent; exclude them from vision payloads.
      .filter((item) => item.kind === "image" && typeof item.url === "string")
      .map((item) => ({
        id: item.id,
        url: item.url as string,
        thumbnailAlt: item.thumbnailAlt ?? undefined,
      }))
  ).map((item) => ({
    id: item.id,
    kind: "image" as const,
    url: item.url,
    thumbnailAlt: item.thumbnailAlt ?? undefined,
  }));
};

const pickPulseRuntime = (
  pulse?: AgentContext["pulse"] | null
): AgentPulseRuntimeContext | undefined => {
  if (!pulse) return undefined;
  const presetId = typeof pulse.presetId === "string" ? pulse.presetId.trim() : "";
  const label = typeof pulse.label === "string" ? pulse.label.trim() : "";
  const instructions = typeof pulse.instructions === "string" ? pulse.instructions.trim() : "";
  const description =
    typeof pulse.description === "string" && pulse.description.trim().length > 0
      ? pulse.description.trim()
      : null;
  const starterAssistantMessage =
    typeof pulse.starterAssistantMessage === "string" &&
    pulse.starterAssistantMessage.trim().length > 0
      ? pulse.starterAssistantMessage.trim()
      : null;
  const workflowStageHints = Array.isArray(pulse.workflowStageHints)
    ? pulse.workflowStageHints
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter((entry) => entry.length > 0)
    : null;
  const workflowSession =
    pulse.workflowSession && typeof pulse.workflowSession.presetId === "string"
      ? ({
          presetId: pulse.workflowSession.presetId.trim(),
          status: (pulse.workflowSession.status === "running" ||
          pulse.workflowSession.status === "awaiting_input" ||
          pulse.workflowSession.status === "completed"
            ? pulse.workflowSession.status
            : "idle") as AgentPulseWorkflowSession["status"],
          currentStepIndex:
            typeof pulse.workflowSession.currentStepIndex === "number" &&
            Number.isFinite(pulse.workflowSession.currentStepIndex)
              ? Math.max(1, Math.trunc(pulse.workflowSession.currentStepIndex))
              : null,
          currentStepLabel:
            typeof pulse.workflowSession.currentStepLabel === "string" &&
            pulse.workflowSession.currentStepLabel.trim().length > 0
              ? pulse.workflowSession.currentStepLabel.trim()
              : null,
          currentStepPrompt:
            typeof pulse.workflowSession.currentStepPrompt === "string" &&
            pulse.workflowSession.currentStepPrompt.trim().length > 0
              ? pulse.workflowSession.currentStepPrompt.trim()
              : null,
          collectedInputs: Array.isArray(pulse.workflowSession.collectedInputs)
            ? pulse.workflowSession.collectedInputs
                .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
                .filter((entry) => entry.length > 0)
            : [],
          lastArtifact:
            typeof pulse.workflowSession.lastArtifact === "string" &&
            pulse.workflowSession.lastArtifact.trim().length > 0
              ? pulse.workflowSession.lastArtifact.trim()
              : null,
          finalArtifactSource:
            pulse.workflowSession.finalArtifactSource === "apply_prompt" ||
            pulse.workflowSession.finalArtifactSource === "chat_reply"
              ? pulse.workflowSession.finalArtifactSource
              : null,
        } satisfies AgentPulseWorkflowSession)
      : null;
  const pulseKind =
    pulse.pulseKind === GUIDED_PULSE_KIND || pulse.pulseKind === CUSTOM_PULSE_KIND
      ? pulse.pulseKind
      : pulse.runtimeMode === "custom_gpt"
        ? CUSTOM_PULSE_KIND
        : pulse.runtimeMode === GUIDED_PULSE_RUNTIME_MODE ||
            starterAssistantMessage != null ||
            workflowStageHints != null ||
            pulse.source === "builtin"
          ? GUIDED_PULSE_KIND
          : CUSTOM_PULSE_KIND;
  const source = pulse.source === "builtin" || pulse.source === "custom" ? pulse.source : undefined;
  const schemaVersion =
    typeof pulse.schemaVersion === "number" && Number.isFinite(pulse.schemaVersion)
      ? Math.trunc(pulse.schemaVersion)
      : undefined;
  if (!presetId || !label || !instructions) return undefined;
  const artifactTarget = normalizePulseArtifactTarget(pulse.artifactTarget);
  if (pulseKind === CUSTOM_PULSE_KIND) {
    return {
      presetId,
      label,
      description,
      instructions,
      pulseKind,
      ...(source ? { source } : {}),
      ...(schemaVersion != null ? { schemaVersion } : {}),
    };
  }
  return {
    presetId,
    label,
    description,
    instructions,
    pulseKind,
    runtimeMode: GUIDED_PULSE_RUNTIME_MODE,
    activationMode: GUIDED_PULSE_ACTIVATION_MODE,
    starterAssistantMessage,
    workflowStageHints,
    outputMode: GUIDED_PULSE_OUTPUT_MODE,
    ...(artifactTarget ? { artifactTarget } : {}),
    memoryPolicy: "session",
    ...(source ? { source } : {}),
    workflowSession,
    ...(schemaVersion != null ? { schemaVersion } : {}),
  };
};

export const buildAgentContext = (context: AgentContext): AgentApiContext => {
  return {
    activePrompt: context.activePrompt ?? null,
    modelId: context.modelId ?? null,
    mode: context.mode,
    creditBalance: context.creditBalance ?? null,
    references: Array.isArray(context.references)
      ? (context.references as AgentReferenceSummary[]).slice(0, 24)
      : [],
    media: pickMediaPreviews(context.media),
    selectedReferenceIds: Array.isArray(context.selectedReferenceIds)
      ? context.selectedReferenceIds.slice(0, 8)
      : [],
    focusedSource: context.focusedSource ?? undefined,
    focusedReferenceId: context.focusedReferenceId ?? null,
    lastAssistantMessage: context.lastAssistantMessage ?? null,
    modeHint: context.modeHint ?? undefined,
    pulse: pickPulseRuntime(context.pulse),
  };
};
