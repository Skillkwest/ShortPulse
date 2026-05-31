/**
 * Edit submit-intent helpers.
 * Keeps expert-edit inpaint intent mapping centralized for orchestration and pricing coherence.
 */
import {
  MARKUP_NANO_BANANA_PRO_EDIT_MODEL_ID,
  isInpaintGenerationEnabled,
  isMarkupGenerationEnabled,
  isMarkupModelLockEnabled,
  resolveInpaintPromptReferencePolicy,
} from "./inpaintSubmission";
import { isEditWorkflow } from "./workflowIdentity";
import type { ToolId } from "../types";

export type EditSubmitIntent = "standard" | "inpaint" | "markup";

export const DEFAULT_EDIT_SUBMIT_INTENT: EditSubmitIntent = "standard";

export const normalizeEditSubmitIntent = (
  editSubmitIntent: EditSubmitIntent | null | undefined
): EditSubmitIntent => {
  const resolvedIntent = editSubmitIntent ?? DEFAULT_EDIT_SUBMIT_INTENT;
  if (resolvedIntent === "inpaint" && !isInpaintGenerationEnabled()) {
    return "standard";
  }
  if (resolvedIntent === "markup" && !isMarkupGenerationEnabled()) {
    return "standard";
  }
  return resolvedIntent;
};

/**
 * Maps inpaint rail selection to submit intent used by orchestration.
 */
export const resolveEditSubmitIntentFromInpaintSelection = (
  isInpaintSelected: boolean
): EditSubmitIntent => normalizeEditSubmitIntent(isInpaintSelected ? "inpaint" : "standard");

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
  if (isInpaintSelected) return normalizeEditSubmitIntent("inpaint");
  if (isMarkupSelected) return normalizeEditSubmitIntent("markup");
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
  const normalizedEditSubmitIntent = normalizeEditSubmitIntent(editSubmitIntent);
  if (isEditWorkflow(selectedTool) && normalizedEditSubmitIntent === "inpaint") {
    if (!isInpaintGenerationEnabled()) {
      return selectedModelId;
    }
    return resolveInpaintPromptReferencePolicy({
      promptText,
      extraImageUrls,
    }).modelId;
  }
  if (
    isEditWorkflow(selectedTool) &&
    normalizedEditSubmitIntent === "markup" &&
    isMarkupModelLockEnabled()
  ) {
    return MARKUP_NANO_BANANA_PRO_EDIT_MODEL_ID;
  }
  return selectedModelId;
};
