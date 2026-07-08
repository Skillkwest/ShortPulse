import type { AgentContext, AgentPulseWorkflowSession } from "../../../prefabs/agent";

export const PULSE_IMAGE_INTAKE_REQUIRED_NOTICE =
  "This Pulse needs an image first. Attach or drop an image, then send your text with it.";

const PULSE_IMAGE_CONTEXT_INPUT_LABEL = "Uploaded image attached";
const IMAGE_INTAKE_TEXT_PATTERN =
  /\b(?:image gate|image intake|upload characters?|upload (?:your |the |an? )?(?:image|images|photo|photos|picture|pictures|character|characters)|upload .*?\b(?:image|images|photo|photos|picture|pictures|character|characters)\b)\b/i;

export const hasPulseImageContext = (context: AgentContext): boolean =>
  context.media?.some(
    (media) =>
      media.kind === "image" &&
      ((typeof media.url === "string" && media.url.trim().length > 0) ||
        (typeof media.dataUrl === "string" && media.dataUrl.trim().length > 0))
  ) ?? false;

export const isPulseImageIntakeStep = (
  pulse: AgentContext["pulse"] | null | undefined
): boolean => {
  if (!pulse || pulse.runtimeMode !== "workflow_gpt") return false;
  const workflowSession = pulse.workflowSession ?? null;
  if (workflowSession?.status === "completed") return false;
  const currentStepIndex = workflowSession?.currentStepIndex ?? null;
  if (typeof currentStepIndex === "number" && currentStepIndex > 1) return false;
  const textToInspect = [workflowSession?.currentStepLabel, workflowSession?.currentStepPrompt]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean)
    .join("\n");
  return IMAGE_INTAKE_TEXT_PATTERN.test(textToInspect);
};

export const buildImageSatisfiedPulseWorkflowSession = (
  pulse: AgentContext["pulse"] | null | undefined
): AgentPulseWorkflowSession | null => {
  if (!isPulseImageIntakeStep(pulse)) return null;
  const presetId = typeof pulse?.presetId === "string" ? pulse.presetId.trim() : "";
  if (!presetId) return null;
  const nextStepIndex = pulse?.workflowSession?.currentStepIndex ?? 1;
  const nextStepLabel = pulse?.workflowSession?.currentStepLabel ?? null;

  return {
    presetId,
    status: "running",
    currentStepIndex: nextStepIndex,
    currentStepLabel: nextStepLabel ?? null,
    currentStepPrompt: null,
    collectedInputs: [PULSE_IMAGE_CONTEXT_INPUT_LABEL],
    lastArtifact: null,
    finalArtifactSource: null,
  };
};
