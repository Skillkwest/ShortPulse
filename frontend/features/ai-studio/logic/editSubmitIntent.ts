/**
 * Edit submit-intent helpers.
 * Keeps expert-edit inpaint intent mapping centralized for orchestration and pricing coherence.
 */
import {
  MARKUP_NANO_BANANA_PRO_EDIT_MODEL_ID,
  isInpaintGenerationEnabled,
  isMarkupModelLockEnabled,
  resolveInpaintPromptReferencePolicy,
} from "./inpaintSubmission";
import { isEditWorkflow } from "./workflowIdentity";
import type { ToolId } from "../types";

export type EditSubmitIntent = "standard" | "inpaint" | "markup";

export const DEFAULT_EDIT_SUBMIT_INTENT: EditSubmitIntent = "standard";

/**
 * Maps inpaint rail selection to submit intent used by orchestration.
 */
export const resolveEditSubmitIntentFromInpaintSelection = (
  isInpaintSelected: boolean
): EditSubmitIntent => (isInpaintSelected ? "inpaint" : "standard");

/**
 * Maps rail-tool selection to submit intent used by orchestration.
 */
export const resolveEditSubmitIntentFromRailSelection = ({
  isInpaintSelected,
  isMarkupSelected,
}: {
  isInpaintSelected: boolean;
  isMarkupSelected: boolean;
}): EditSubmitIntent => {
  if (isInpaintSelected) return "inpaint";
  if (isMarkupSelected) return "markup";
  return "standard";
};

/**
 * Resolves the effective model id used for edit-workflow cost/guardrail calculations.
 */
export const resolveEffectiveEditSubmitModelId = ({
  selectedTool,
  selectedModelId,
  editSubmitIntent,
  promptText = "",
  extraImageUrls = [null, null, null],
}: {
  selectedTool: ToolId | null | undefined;
  selectedModelId: string | null;
  editSubmitIntent?: EditSubmitIntent;
  promptText?: string;
  extraImageUrls?: [string | null, string | null, string | null];
}): string | null => {
  if (isEditWorkflow(selectedTool) && editSubmitIntent === "inpaint") {
    if (!isInpaintGenerationEnabled()) {
      return selectedModelId;
    }
    return resolveInpaintPromptReferencePolicy({
      promptText,
      extraImageUrls,
    }).modelId;
  }
  if (isEditWorkflow(selectedTool) && editSubmitIntent === "markup" && isMarkupModelLockEnabled()) {
    return MARKUP_NANO_BANANA_PRO_EDIT_MODEL_ID;
  }
  return selectedModelId;
};
