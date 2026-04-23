/**
 * Maps selected AI Studio tools to the properties panel surface to render.
 */
import type { ToolId, WorkflowId } from "../types";
import { isSoundWorkflow, resolveWorkflowId } from "./workflowIdentity";

export type PropertiesPanelKind =
  | WorkflowId
  | "styles"
  | "pulse-presets"
  | "presets"
  | "elements"
  | "media-library"
  | "sound"
  | "music"
  | "sound-effects"
  | "voices";

/**
 * Resolves which left-side properties panel should be rendered for a given tool.
 */
export const resolvePropertiesPanelKind = (selectedTool: ToolId | null): PropertiesPanelKind => {
  if (selectedTool === "media-library") return "media-library";
  if (selectedTool === "elements") return "elements";
  if (selectedTool === "styles") return "styles";
  if (selectedTool === "pulse-presets") return "pulse-presets";
  if (selectedTool === "presets") return "presets";
  if (selectedTool === "voices") return "voices";
  if (selectedTool === "voice-changer" || selectedTool === "text-to-speech") return "voices";
  if (selectedTool === "music") return "music";
  if (selectedTool === "sound-effects") return "sound-effects";
  if (isSoundWorkflow(selectedTool)) return "sound";
  return resolveWorkflowId(selectedTool);
};
