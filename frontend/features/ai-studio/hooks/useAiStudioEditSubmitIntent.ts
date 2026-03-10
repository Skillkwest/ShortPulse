/**
 * Edit submit-intent state hook.
 * Owns intent reset behavior when leaving Edit workflow.
 */
import { useCallback, useEffect, useState } from "react";
import { DEFAULT_EDIT_SUBMIT_INTENT, type EditSubmitIntent } from "../logic/editSubmitIntent";
import { isEditWorkflow } from "../logic/workflowIdentity";
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

  const setEditSubmitIntent = useCallback((intent: EditSubmitIntent) => {
    setEditSubmitIntentState(intent);
  }, []);

  useEffect(() => {
    if (isEditWorkflow(selectedTool)) return;
    setEditSubmitIntentState(DEFAULT_EDIT_SUBMIT_INTENT);
  }, [selectedTool]);

  return {
    editSubmitIntent,
    setEditSubmitIntent,
  };
};
