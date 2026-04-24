/**
 * Prompt-target routing helpers for Create/Edit/Video workflows.
 */
import type { ToolId } from "../types";

/**
 * Tools that write directly into the reference workflow prompt field.
 */
export const isReferencePromptTool = (selectedTool: ToolId | null) =>
  selectedTool === "image" ||
  selectedTool === "edit" ||
  selectedTool === "video" ||
  selectedTool === "kling";

/**
 * Tools where reference prompt input must remain isolated from chat apply behavior.
 */
export const isEditPromptTool = (selectedTool: ToolId | null) =>
  selectedTool === "image" || selectedTool === "edit";

/**
 * Determines whether an applied agent response should mutate the shared Create prompt.
 */
export const shouldApplyAgentPromptToSharedPrompt = (
  selectedTool: ToolId | null,
  options?: { hasActivePulse?: boolean }
) => {
  if (options?.hasActivePulse) return false;
  return !isEditPromptTool(selectedTool);
};
