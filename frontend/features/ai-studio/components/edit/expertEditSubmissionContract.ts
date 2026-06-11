import type { InpaintSubmissionOverride } from "../../logic/inpaintSubmission";
import type { WorkflowReloadExpertEditReferences } from "../../types";

export type ExpertEditCompiledPromptOverrides = {
  displayPromptOverride: string;
  submissionPromptOverride: string;
};

export type ExpertEditRegenerateOptions = {
  inpaintOverride?: InpaintSubmissionOverride | null;
  modelIdOverride?: string | null;
  outputIdOverride?: string;
  costOverrideCredits?: number | null;
  hideOutputFromReferenceGrid?: boolean;
  displayPromptOverride?: string | null;
  submissionPromptOverride?: string | null;
  referenceInputsMode?: "merge" | "replace";
  referenceInputsLimit?: number;
  expertEditReferences?: WorkflowReloadExpertEditReferences | null;
};

export type ExpertEditRegenerateWithReferenceInputsHandler = (
  referenceInputs: string[],
  options?: ExpertEditRegenerateOptions
) => void | Promise<void>;

export type ExpertEditVariantCostResolver = (input: {
  modelId: string;
  imageWidth: number;
  imageHeight: number;
}) => number | null;
