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

const MAX_MEDIA_ITEMS = 3;

const isSafeRemoteUrl = (value?: string | null) => {
  if (!value || typeof value !== "string") return false;
  if (!value.startsWith("https://")) return false;
  return true;
};

const pickMediaPreviews = (media?: AgentContext["media"]): AgentApiMediaPreview[] => {
  if (!media || !media.length) return [];
  return (
    media
      .filter((item) => item.kind === "image") // videos are not processed by the agent; exclude them from vision payload
      // Use signed/public HTTPS URLs only to avoid oversized chat payloads from base64 data URLs.
      .filter((item) => isSafeRemoteUrl(item.url))
      .map((item) => ({
        id: item.id,
        kind: "image" as const,
        url: item.url as string,
        thumbnailAlt: item.thumbnailAlt ?? undefined,
      }))
      .slice(0, MAX_MEDIA_ITEMS)
  );
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
        } satisfies AgentPulseWorkflowSession)
      : null;
  if (!presetId || !label || !instructions) return undefined;
  return {
    presetId,
    label,
    description,
    instructions,
    runtimeMode:
      pulse.runtimeMode === "workflow_gpt" || pulse.runtimeMode === "prompt_editor"
        ? pulse.runtimeMode
        : "prompt_editor",
    activationMode:
      pulse.activationMode === "activate_and_start" || pulse.activationMode === "activate_only"
        ? pulse.activationMode
        : "activate_only",
    starterAssistantMessage,
    workflowStageHints,
    outputMode: pulse.outputMode === "chat_reply" ? "chat_reply" : "apply_prompt",
    memoryPolicy: "session",
    source: pulse.source === "builtin" || pulse.source === "custom" ? pulse.source : undefined,
    workflowSession,
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
