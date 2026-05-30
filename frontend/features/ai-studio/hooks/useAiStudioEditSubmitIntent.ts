/**
 * Edit submit-intent state hook.
 * Owns intent state and explicit reset behavior for Edit workflow submission.
 */
import { useCallback, useState } from "react";
import { DEFAULT_EDIT_SUBMIT_INTENT, type EditSubmitIntent } from "../logic/editSubmitIntent";
import { isEditWorkflow } from "../logic/workflowIdentity";
import { areAdvancedExpertEditModesPubliclyAccessible } from "../logic/inpaintSubmission";
import type { ToolId } from "../types";

type UseAiStudioEditSubmitIntentParams = {
  selectedTool: ToolId | null;
};

/**
 * Returns edit submit intent and setter used by expert edit rail orchestration.
 */
export const useAiStudioEditSubmitIntent = ({
  selectedTool,
}: UseAiStudioEditSubmitIntentParams) => {
  const [editSubmitIntent, setEditSubmitIntentState] = useState<EditSubmitIntent>(
    DEFAULT_EDIT_SUBMIT_INTENT
  );
  const advancedEditModesAccessible = areAdvancedExpertEditModesPubliclyAccessible();

  const setEditSubmitIntent = useCallback(
    (intent: EditSubmitIntent) => {
      setEditSubmitIntentState(
        isEditWorkflow(selectedTool) && advancedEditModesAccessible
          ? intent
          : DEFAULT_EDIT_SUBMIT_INTENT
      );
    },
    [advancedEditModesAccessible, selectedTool]
  );

  const resetEditSubmitIntent = useCallback(() => {
    setEditSubmitIntentState(DEFAULT_EDIT_SUBMIT_INTENT);
  }, []);

  return {
    editSubmitIntent:
      isEditWorkflow(selectedTool) && advancedEditModesAccessible
        ? editSubmitIntent
        : DEFAULT_EDIT_SUBMIT_INTENT,
    setEditSubmitIntent,
    resetEditSubmitIntent,
  };
};
