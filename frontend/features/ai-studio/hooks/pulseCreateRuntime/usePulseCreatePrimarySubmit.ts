import { useCallback, useMemo, type Dispatch, type SetStateAction } from "react";
import type { AgentPulseWorkflowSession } from "../../../../prefabs/agent";
import type { CreatePulseArtifactTarget } from "../../components/create/createPulsePresets";
import type { StudioMode, ToolId } from "../../types";
import { useAiStudioCreateSubmitSingleFlight } from "../useAiStudioCreateSubmitSingleFlight";

type GeneratePulseArtifact = (
  promptOverride?: string | null,
  options?: {
    modeOverride?: StudioMode;
    toolOverride?: ToolId | null;
    costOverrideCredits?: number | null;
    suppressStyle?: boolean;
    suppressCharacter?: boolean;
    ignoreGenerationGuardrail?: boolean;
  }
) => void | Promise<unknown>;

type UsePulseCreatePrimarySubmitParams = {
  hasActivePulseSession: boolean;
  isPulseStartupPending: boolean;
  pulseKind: "guided_workflow" | "custom_gpt" | null;
  pulseWorkflowSession: AgentPulseWorkflowSession | null;
  latestAgentPrompt: string | null;
  artifactTarget: CreatePulseArtifactTarget | null;
  promptReferenceGenerateCostCredits: number | null;
  currentCostCredits: number | null;
  handleGenerate: GeneratePulseArtifact;
  setUiNotice: Dispatch<SetStateAction<string | null>>;
};

const PULSE_INCOMPLETE_GENERATION_GUARDRAIL = "Complete the active Pulse before generating.";
const PULSE_STARTUP_PENDING_GENERATION_GUARDRAIL =
  "This Pulse is still starting. Wait for the first Pulse response before generating.";
const PULSE_MISSING_GENERATION_READY_PROMPT_GUARDRAIL =
  "This Pulse has not produced a generation-ready prompt yet.";
const PULSE_TEXT_ARTIFACT_GENERATION_GUARDRAIL =
  "This Pulse creates a text artifact. Generation is not available for this artifact target yet.";
const PULSE_STORYBOARD_GENERATION_GUARDRAIL =
  "This Pulse creates a storyboard artifact. Export is not available for this artifact target yet.";
const PULSE_MISSING_ARTIFACT_TARGET_GUARDRAIL =
  "This Pulse does not have a valid artifact target. Restart the Pulse or choose another Pulse.";

const PASSIVE_PULSE_GENERATION_GUARDRAILS = new Set<string>([
  PULSE_INCOMPLETE_GENERATION_GUARDRAIL,
  PULSE_STARTUP_PENDING_GENERATION_GUARDRAIL,
  PULSE_MISSING_GENERATION_READY_PROMPT_GUARDRAIL,
]);

export const shouldShowPassivePulseGenerationGuardrail = (
  guardrailReason: string | null | undefined
): boolean => Boolean(guardrailReason && !PASSIVE_PULSE_GENERATION_GUARDRAILS.has(guardrailReason));

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
  isPulseStartupPending,
  pulseKind,
  pulseWorkflowSession,
  latestAgentPrompt,
  artifactTarget,
  promptReferenceGenerateCostCredits,
  currentCostCredits,
  handleGenerate,
  setUiNotice,
}: UsePulseCreatePrimarySubmitParams) => {
  const pulseWorkflowLastArtifact = pulseWorkflowSession?.lastArtifact ?? null;
  const pulseWorkflowFinalArtifactSource = pulseWorkflowSession?.finalArtifactSource ?? null;
  const pulseCompletedArtifactPrompt = useMemo(() => {
    if (!hasActivePulseSession) return null;
    if (pulseKind === "guided_workflow") {
      if (pulseWorkflowSession?.status !== "completed") return null;
      if (pulseWorkflowFinalArtifactSource !== "apply_prompt") return null;
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
    pulseWorkflowFinalArtifactSource,
    pulseWorkflowLastArtifact,
    pulseWorkflowSession?.status,
  ]);
  const guidedWorkflowNeedsPromptArtifact =
    hasActivePulseSession &&
    pulseKind === "guided_workflow" &&
    pulseWorkflowSession?.status === "completed" &&
    pulseWorkflowFinalArtifactSource !== "apply_prompt";
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
  const pulseArtifactGenerateGuardrail = isPulseStartupPending
    ? PULSE_STARTUP_PENDING_GENERATION_GUARDRAIL
    : pulseCompletedArtifactPrompt
      ? unsupportedArtifactTargetGuardrail
      : guidedWorkflowNeedsPromptArtifact
        ? PULSE_MISSING_GENERATION_READY_PROMPT_GUARDRAIL
        : pulseKind === "guided_workflow"
          ? PULSE_INCOMPLETE_GENERATION_GUARDRAIL
          : PULSE_MISSING_GENERATION_READY_PROMPT_GUARDRAIL;
  const pulseArtifactGenerateDisabled =
    isPulseStartupPending ||
    Boolean(unsupportedArtifactTargetGuardrail) ||
    !pulseCompletedArtifactPrompt;
  const handlePulseCreatePrimarySubmit = useCallback(() => {
    if (isPulseStartupPending) {
      setUiNotice(PULSE_STARTUP_PENDING_GENERATION_GUARDRAIL);
      return;
    }
    if (!pulseCompletedArtifactPrompt) {
      setUiNotice(
        pulseKind === "guided_workflow"
          ? guidedWorkflowNeedsPromptArtifact
            ? PULSE_MISSING_GENERATION_READY_PROMPT_GUARDRAIL
            : PULSE_INCOMPLETE_GENERATION_GUARDRAIL
          : PULSE_MISSING_GENERATION_READY_PROMPT_GUARDRAIL
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
    return handleGenerate(pulseCompletedArtifactPrompt, {
      modeOverride: pulseArtifactGenerationRoute?.modeOverride,
      toolOverride: pulseArtifactGenerationRoute?.toolOverride,
      costOverrideCredits: pulseArtifactCostOverrideCredits,
      suppressStyle: true,
      suppressCharacter: true,
      ignoreGenerationGuardrail: true,
    });
  }, [
    handleGenerate,
    guidedWorkflowNeedsPromptArtifact,
    pulseArtifactCostOverrideCredits,
    pulseArtifactGenerationRoute,
    pulseCompletedArtifactPrompt,
    isPulseStartupPending,
    pulseKind,
    setUiNotice,
    unsupportedArtifactTargetGuardrail,
  ]);

  const handlePulseCreatePrimarySubmitSingleFlight = useAiStudioCreateSubmitSingleFlight(
    handlePulseCreatePrimarySubmit
  );

  return {
    pulseCompletedArtifactPrompt,
    pulseArtifactGenerateGuardrail,
    pulseArtifactGenerateDisabled,
    handlePulseCreatePrimarySubmit: handlePulseCreatePrimarySubmitSingleFlight,
  };
};
