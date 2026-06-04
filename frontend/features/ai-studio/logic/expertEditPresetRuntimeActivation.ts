/**
 * Shared activation guard for Expert Edit preset runtime dependencies.
 * Keeps standalone Presets library access aligned with Edit-owned preset data.
 */
import type { ToolId } from "../types";
import { isEditWorkflow } from "./workflowIdentity";

/**
 * Returns true when the current tool needs Expert Edit preset runtime state.
 */
export const shouldActivateExpertEditPresetRuntime = (selectedTool: ToolId | null): boolean =>
  isEditWorkflow(selectedTool) || selectedTool === "presets";
