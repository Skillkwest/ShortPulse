/**
 * Canonical workflow identity helpers for AI Studio tools.
 * Normalizes legacy aliases so panel routing and workflow logic stay consistent.
 */
import type { ToolId, WorkflowId } from "../types";

/**
 * Returns a canonical workflow identity for a selected tool id.
 */
export const resolveWorkflowId = (tool: ToolId | null | undefined): WorkflowId => {
  switch (tool) {
    case "create":
    case "text":
      return "create";
    case "edit":
    case "image":
      return "edit";
    case "video":
    case "kling":
      return "video";
    case "character":
      return "character";
    case "canvas":
      return "canvas";
    default:
      return "none";
  }
};

/**
 * Normalizes a tool id to its canonical primary id while keeping null stable.
 */
export const normalizeToolId = (tool: ToolId | null | undefined): ToolId | null => {
  switch (resolveWorkflowId(tool)) {
    case "create":
      return "create";
    case "edit":
      return "edit";
    case "video":
      return "video";
    case "character":
      return "character";
    case "canvas":
      return "canvas";
    default:
      return null;
  }
};

/**
 * Returns true when the workflow is the canonical Create workflow.
 */
export const isCreateWorkflow = (tool: ToolId | null | undefined): boolean =>
  resolveWorkflowId(tool) === "create";

/**
 * Returns true when the workflow is the canonical Edit workflow.
 */
export const isEditWorkflow = (tool: ToolId | null | undefined): boolean =>
  resolveWorkflowId(tool) === "edit";

/**
 * Returns true when the workflow is the canonical Video workflow.
 */
export const isVideoWorkflow = (tool: ToolId | null | undefined): boolean =>
  resolveWorkflowId(tool) === "video";

/**
 * Returns true when the workflow is the canonical Character workflow.
 */
export const isCharacterWorkflow = (tool: ToolId | null | undefined): boolean =>
  resolveWorkflowId(tool) === "character";

/**
 * Returns true when the workflow is the canonical Canvas workflow.
 */
export const isCanvasWorkflow = (tool: ToolId | null | undefined): boolean =>
  resolveWorkflowId(tool) === "canvas";
