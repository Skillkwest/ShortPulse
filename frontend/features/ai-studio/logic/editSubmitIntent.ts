/**
 * Edit submit-intent helpers.
 * Keeps expert-edit inpaint intent mapping centralized for orchestration and pricing coherence.
 */
import { INPAINT_FLUX_FILL_MODEL_ID } from "./inpaintSubmission";
import { MARKUP_NANO_BANANA_PRO_EDIT_MODEL_ID } from "./inpaintSubmission";
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
}: {
  selectedTool: ToolId | null | undefined;
  selectedModelId: string | null;
  editSubmitIntent?: EditSubmitIntent;
}): string | null => {
  if (isEditWorkflow(selectedTool) && editSubmitIntent === "inpaint") {
    return INPAINT_FLUX_FILL_MODEL_ID;
  }
  if (isEditWorkflow(selectedTool) && editSubmitIntent === "markup") {
    return MARKUP_NANO_BANANA_PRO_EDIT_MODEL_ID;
  }
  return selectedModelId;
};
