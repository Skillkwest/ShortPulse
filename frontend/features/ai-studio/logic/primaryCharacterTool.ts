/**
 * Primary Character tool helper.
 * Centralizes support for the canonical Character toolbar id plus legacy aliases.
 */
import type { ToolId } from "../types";

/**
 * Returns true when the active tool should behave as the primary Character workflow surface.
 */
export const isPrimaryCharacterTool = (tool: ToolId | null | undefined): boolean =>
  tool === "canvas" || tool === "character";
