/**
 * Maps selected AI Studio tools to the properties panel surface to render.
 */
import type { ToolId, WorkflowId } from "../types";
import { resolveWorkflowId } from "./workflowIdentity";

export type PropertiesPanelKind = WorkflowId;

/**
 * Resolves which left-side properties panel should be rendered for a given tool.
 */
export const resolvePropertiesPanelKind = (selectedTool: ToolId | null): PropertiesPanelKind =>
  resolveWorkflowId(selectedTool);
