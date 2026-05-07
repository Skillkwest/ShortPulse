import { useCallback, useMemo, type Dispatch, type SetStateAction } from "react";
import type { AgentPulseWorkflowSession } from "../../../../prefabs/agent";
import type { CreatePulseArtifactTarget } from "../../components/create/createPulsePresets";
import type { StudioMode, ToolId } from "../../types";

type GeneratePulseArtifact = (
  promptOverride?: string | null,
  options?: {
    modeOverride?: StudioMode;
    toolOverride?: ToolId | null;
    costOverrideCredits?: number | null;
    suppressStyle?: boolean;
  }
) => void | Promise<unknown>;

type UsePulseCreatePrimarySubmitParams = {
  hasActivePulseSession: boolean;
  pulseKind: "guided_workflow" | "custom_gpt" | null;
  pulseWorkflowSession: AgentPulseWorkflowSession | null;
  latestAgentPrompt: string | null;
  artifactTarget: CreatePulseArtifactTarget | null;
  effectiveGenerationGuardrail: string | null;
  promptReferenceGenerateCostCredits: number | null;
  currentCostCredits: number | null;
  handleGenerate: GeneratePulseArtifact;
  setUiNotice: Dispatch<SetStateAction<string | null>>;
};

const PULSE_INCOMPLETE_GENERATION_GUARDRAIL = "Complete the active Pulse before generating.";
const PULSE_CUSTOM_PROMPT_GENERATION_GUARDRAIL =
  "This Pulse has not produced a generation-ready prompt yet.";
const PULSE_TEXT_ARTIFACT_GENERATION_GUARDRAIL =
  "This Pulse creates a text artifact. Generation is not available for this artifact target yet.";
const PULSE_STORYBOARD_GENERATION_GUARDRAIL =
  "This Pulse creates a storyboard artifact. Export is not available for this artifact target yet.";
const PULSE_MISSING_ARTIFACT_TARGET_GUARDRAIL =
  "This Pulse does not have a valid artifact target. Restart the Pulse or choose another Pulse.";

export const resolvePulseArtifactGenerationRoute = (
  artifactTarget: CreatePulseArtifactTarget | null
): { modeOverride: StudioMode; toolOverride: ToolId } | null => {
  if (artifactTarget === "image_prompt") {
    return { modeOverride: "image", toolOverride: "create" };
  }
  if (artifactTarget === "video_prompt") {
    return { modeOverride: "video", toolOverride: "video" };
  }
  return null;
};

export const resolvePulseArtifactCostOverrideCredits = ({
  artifactTarget,
  promptReferenceGenerateCostCredits,
  currentCostCredits,
}: {
  artifactTarget: CreatePulseArtifactTarget | null;
  promptReferenceGenerateCostCredits: number | null;
  currentCostCredits: number | null;
}): number | null => {
  if (artifactTarget === "image_prompt") {
    return promptReferenceGenerateCostCredits ?? currentCostCredits;
  }
  return currentCostCredits;
};

const resolvePulseArtifactTargetGuardrail = (
  artifactTarget: CreatePulseArtifactTarget | null
): string | null => {
  if (!artifactTarget) return PULSE_MISSING_ARTIFACT_TARGET_GUARDRAIL;
  if (artifactTarget === "text_artifact") return PULSE_TEXT_ARTIFACT_GENERATION_GUARDRAIL;
  if (artifactTarget === "storyboard") return PULSE_STORYBOARD_GENERATION_GUARDRAIL;
  return null;
};

/**
 * Pulse Create primary submit command.
 * Owns artifact generation and refuses to generate until the active workflow completes.
 */
export const usePulseCreatePrimarySubmit = ({
  hasActivePulseSession,
  pulseKind,
  pulseWorkflowSession,
  latestAgentPrompt,
  artifactTarget,
  effectiveGenerationGuardrail,
  promptReferenceGenerateCostCredits,
  currentCostCredits,
  handleGenerate,
  setUiNotice,
}: UsePulseCreatePrimarySubmitParams) => {
  const pulseWorkflowLastArtifact = pulseWorkflowSession?.lastArtifact ?? null;
  const pulseCompletedArtifactPrompt = useMemo(() => {
    if (!hasActivePulseSession) return null;
    if (pulseKind === "guided_workflow") {
      if (pulseWorkflowSession?.status !== "completed") return null;
      if (typeof pulseWorkflowLastArtifact !== "string") return null;
      const artifact = pulseWorkflowLastArtifact.trim();
      return artifact.length > 0 ? artifact : null;
    }
    const prompt = typeof latestAgentPrompt === "string" ? latestAgentPrompt.trim() : "";
    return prompt.length > 0 ? prompt : null;
  }, [
    hasActivePulseSession,
    latestAgentPrompt,
    pulseKind,
    pulseWorkflowLastArtifact,
    pulseWorkflowSession?.status,
  ]);
  const pulseArtifactGenerationRoute = useMemo(
    () =>
      pulseKind === "guided_workflow" ? resolvePulseArtifactGenerationRoute(artifactTarget) : null,
    [artifactTarget, pulseKind]
  );
  const pulseArtifactCostOverrideCredits = useMemo(
    () =>
      pulseKind === "guided_workflow"
        ? resolvePulseArtifactCostOverrideCredits({
            artifactTarget,
            promptReferenceGenerateCostCredits,
            currentCostCredits,
          })
        : currentCostCredits,
    [artifactTarget, currentCostCredits, promptReferenceGenerateCostCredits, pulseKind]
  );
  const unsupportedArtifactTargetGuardrail =
    pulseKind === "guided_workflow" && pulseCompletedArtifactPrompt
      ? resolvePulseArtifactTargetGuardrail(artifactTarget)
      : null;
  const pulseArtifactGenerateGuardrail = pulseCompletedArtifactPrompt
    ? (effectiveGenerationGuardrail ?? unsupportedArtifactTargetGuardrail)
    : pulseKind === "guided_workflow"
      ? PULSE_INCOMPLETE_GENERATION_GUARDRAIL
      : PULSE_CUSTOM_PROMPT_GENERATION_GUARDRAIL;
  const pulseArtifactGenerateDisabled =
    Boolean(effectiveGenerationGuardrail) ||
    Boolean(unsupportedArtifactTargetGuardrail) ||
    !pulseCompletedArtifactPrompt;
  const handlePulseCreatePrimarySubmit = useCallback(() => {
    if (!pulseCompletedArtifactPrompt) {
      setUiNotice(
        pulseKind === "guided_workflow"
          ? PULSE_INCOMPLETE_GENERATION_GUARDRAIL
          : PULSE_CUSTOM_PROMPT_GENERATION_GUARDRAIL
      );
      return;
    }
    if (pulseKind === "guided_workflow" && !pulseArtifactGenerationRoute) {
      setUiNotice(
        unsupportedArtifactTargetGuardrail ??
          "This Pulse artifact target is not available for generation yet."
      );
      return;
    }
    void handleGenerate(pulseCompletedArtifactPrompt, {
      modeOverride: pulseArtifactGenerationRoute?.modeOverride,
      toolOverride: pulseArtifactGenerationRoute?.toolOverride,
      costOverrideCredits: pulseArtifactCostOverrideCredits,
      suppressStyle: true,
    });
  }, [
    handleGenerate,
    pulseArtifactCostOverrideCredits,
    pulseArtifactGenerationRoute,
    pulseCompletedArtifactPrompt,
    pulseKind,
    setUiNotice,
    unsupportedArtifactTargetGuardrail,
  ]);

  return {
    pulseCompletedArtifactPrompt,
    pulseArtifactGenerateGuardrail,
    pulseArtifactGenerateDisabled,
    handlePulseCreatePrimarySubmit,
  };
};
