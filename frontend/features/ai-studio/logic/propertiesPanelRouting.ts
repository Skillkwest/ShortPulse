/**
 * Maps selected AI Studio tools to the properties panel surface to render.
 */
import type { ToolId } from "../types";

export type PropertiesPanelKind =
  | "text"
  | "character"
  | "edit"
  | "video"
  | "kling"
  | "canvas"
  | "none";

/**
 * Resolves which left-side properties panel should be rendered for a given tool.
 */
export const resolvePropertiesPanelKind = (selectedTool: ToolId | null): PropertiesPanelKind => {
  switch (selectedTool) {
    case "create":
    case "text":
      return "text";
    case "character":
      return "character";
    case "image":
    case "edit":
      return "edit";
    case "video":
      return "video";
    case "kling":
      return "kling";
    case "canvas":
      return "canvas";
    default:
      return "none";
  }
};
