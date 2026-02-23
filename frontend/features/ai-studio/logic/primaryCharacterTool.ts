/**
 * Primary Character tool helper.
 * Centralizes support for the canonical Character toolbar id plus legacy aliases.
 */
import type { ToolId } from "../types";
import { isCharacterWorkflow } from "./workflowIdentity";

/**
 * Returns true when the active tool should behave as the primary Character workflow surface.
 */
export const isPrimaryCharacterTool = (tool: ToolId | null | undefined): boolean =>
  isCharacterWorkflow(tool);
