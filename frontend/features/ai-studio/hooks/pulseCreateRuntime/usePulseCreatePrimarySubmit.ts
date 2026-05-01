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
  pulseWorkflowSession: AgentPulseWorkflowSession | null;
  artifactTarget: CreatePulseArtifactTarget | null;
  effectiveGenerationGuardrail: string | null;
  promptReferenceGenerateCostCredits: number | null;
  currentCostCredits: number | null;
  handleGenerate: GeneratePulseArtifact;
  setUiNotice: Dispatch<SetStateAction<string | null>>;
};

const PULSE_INCOMPLETE_GENERATION_GUARDRAIL = "Complete the active Pulse before generating.";
const PULSE_TEXT_ARTIFACT_GENERATION_GUARDRAIL =
  "This Pulse creates a text artifact. Generation is not available for this artifact target yet.";
const PULSE_STORYBOARD_GENERATION_GUARDRAIL =
  "This Pulse creates a storyboard artifact. Export is not available for this artifact target yet.";
const PULSE_MISSING_ARTIFACT_TARGET_GUARDRAIL =
  "This Pulse does not have a valid artifact target. Restart the Pulse or choose another Pulse.";

const resolvePulseArtifactGenerationRoute = (
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
  pulseWorkflowSession,
  artifactTarget,
  effectiveGenerationGuardrail,
  promptReferenceGenerateCostCredits,
  currentCostCredits,
  handleGenerate,
  setUiNotice,
}: UsePulseCreatePrimarySubmitParams) => {
  const pulseWorkflowLastArtifact = pulseWorkflowSession?.lastArtifact ?? null;
  const pulseCompletedArtifactPrompt = useMemo(() => {
    if (!hasActivePulseSession || pulseWorkflowSession?.status !== "completed") return null;
    if (typeof pulseWorkflowLastArtifact !== "string") return null;
    const artifact = pulseWorkflowLastArtifact.trim();
    return artifact.length > 0 ? artifact : null;
  }, [hasActivePulseSession, pulseWorkflowLastArtifact, pulseWorkflowSession?.status]);
  const pulseArtifactGenerationRoute = useMemo(
    () => resolvePulseArtifactGenerationRoute(artifactTarget),
    [artifactTarget]
  );
  const unsupportedArtifactTargetGuardrail = pulseCompletedArtifactPrompt
    ? resolvePulseArtifactTargetGuardrail(artifactTarget)
    : null;
  const pulseArtifactGenerateGuardrail = pulseCompletedArtifactPrompt
    ? (effectiveGenerationGuardrail ?? unsupportedArtifactTargetGuardrail)
    : PULSE_INCOMPLETE_GENERATION_GUARDRAIL;
  const pulseArtifactGenerateDisabled =
    Boolean(effectiveGenerationGuardrail) ||
    Boolean(unsupportedArtifactTargetGuardrail) ||
    !pulseCompletedArtifactPrompt;
  const handlePulseCreatePrimarySubmit = useCallback(() => {
    if (!pulseCompletedArtifactPrompt) {
      setUiNotice(PULSE_INCOMPLETE_GENERATION_GUARDRAIL);
      return;
    }
    if (!pulseArtifactGenerationRoute) {
      setUiNotice(
        unsupportedArtifactTargetGuardrail ??
          "This Pulse artifact target is not available for generation yet."
      );
      return;
    }
    void handleGenerate(pulseCompletedArtifactPrompt, {
      modeOverride: pulseArtifactGenerationRoute.modeOverride,
      toolOverride: pulseArtifactGenerationRoute.toolOverride,
      costOverrideCredits: promptReferenceGenerateCostCredits ?? currentCostCredits,
      suppressStyle: true,
    });
  }, [
    currentCostCredits,
    handleGenerate,
    pulseArtifactGenerationRoute,
    pulseCompletedArtifactPrompt,
    promptReferenceGenerateCostCredits,
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
