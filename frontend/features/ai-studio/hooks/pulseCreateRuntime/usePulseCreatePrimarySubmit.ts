import { useCallback, useMemo, type Dispatch, type SetStateAction } from "react";
import type { AgentPulseWorkflowSession } from "../../../../prefabs/agent";
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
  effectiveGenerationGuardrail: string | null;
  promptReferenceGenerateCostCredits: number | null;
  currentCostCredits: number | null;
  handleGenerate: GeneratePulseArtifact;
  setUiNotice: Dispatch<SetStateAction<string | null>>;
};

const PULSE_INCOMPLETE_GENERATION_GUARDRAIL = "Complete the active Pulse before generating.";

/**
 * Pulse Create primary submit command.
 * Owns artifact generation and refuses to generate until the active workflow completes.
 */
export const usePulseCreatePrimarySubmit = ({
  hasActivePulseSession,
  pulseWorkflowSession,
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
  const pulseArtifactGenerateGuardrail = pulseCompletedArtifactPrompt
    ? effectiveGenerationGuardrail
    : PULSE_INCOMPLETE_GENERATION_GUARDRAIL;
  const pulseArtifactGenerateDisabled =
    Boolean(effectiveGenerationGuardrail) || !pulseCompletedArtifactPrompt;
  const handlePulseCreatePrimarySubmit = useCallback(() => {
    if (!pulseCompletedArtifactPrompt) {
      setUiNotice(PULSE_INCOMPLETE_GENERATION_GUARDRAIL);
      return;
    }
    void handleGenerate(pulseCompletedArtifactPrompt, {
      modeOverride: "image",
      toolOverride: "create",
      costOverrideCredits: promptReferenceGenerateCostCredits ?? currentCostCredits,
      suppressStyle: true,
    });
  }, [
    currentCostCredits,
    handleGenerate,
    pulseCompletedArtifactPrompt,
    promptReferenceGenerateCostCredits,
    setUiNotice,
  ]);

  return {
    pulseCompletedArtifactPrompt,
    pulseArtifactGenerateGuardrail,
    pulseArtifactGenerateDisabled,
    handlePulseCreatePrimarySubmit,
  };
};
