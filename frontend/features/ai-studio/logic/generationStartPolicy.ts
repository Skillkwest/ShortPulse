/**
 * Pure submit-start policy for AI Studio generation flows.
 * Centralizes allow/block decisions so every generate entry point follows the same rules.
 */
import type { StudioMode, ToolId } from "../types";

export const CHARACTER_MODE_MISSING_REFERENCES_ERROR =
  "Character Mode requires at least one character image before generating.";
export const GENERATION_MISSING_PROMPT_ERROR = "Add a prompt to start a generation.";
export const GENERATION_MISSING_MODEL_ERROR = "Pick a model to generate.";
export const GENERATION_GUARDRAIL_FALLBACK_ERROR =
  "Generation is currently unavailable. Please review your selections and try again.";
export const CREATE_TEXT_MODE_GENERATION_BLOCK_ERROR =
  "Switch to image generation before running this action.";

export type GenerationStartBlockReason =
  | "guardrail"
  | "create_text_mode"
  | "missing_prompt"
  | "missing_model"
  | "missing_character_references";

export type GenerationStartDecision =
  | {
      allow: true;
    }
  | {
      allow: false;
      reason: GenerationStartBlockReason;
      message: string;
    };

export type GenerationStartPolicyInput = {
  tool: ToolId | null;
  mode: StudioMode;
  modelId: string | null | undefined;
  promptText: string | null | undefined;
  guardrailMessage?: string | null;
  checkCreateTextMode?: boolean;
  checkPrompt?: boolean;
  checkModel?: boolean;
  checkCharacterReferences?: boolean;
  hasCharacterModeReferences?: boolean;
};

const isCreatePromptTool = (tool: ToolId | null): boolean => tool === "create" || tool === "text";

const requiresModelSelection = (tool: ToolId | null, mode: StudioMode): boolean => {
  if (tool === "video" || tool === "kling" || tool === "image" || tool === "edit") return true;
  if (isCreatePromptTool(tool) && mode !== "text") return true;
  return false;
};

/**
 * Resolves deterministic allow/block decisions for generation start.
 */
export const resolveGenerationStartDecision = ({
  tool,
  mode,
  modelId,
  promptText,
  guardrailMessage = null,
  checkCreateTextMode = true,
  checkPrompt = true,
  checkModel = true,
  checkCharacterReferences = false,
  hasCharacterModeReferences = true,
}: GenerationStartPolicyInput): GenerationStartDecision => {
  const trimmedPrompt = typeof promptText === "string" ? promptText.trim() : "";
  const trimmedModelId = typeof modelId === "string" ? modelId.trim() : "";
  const normalizedGuardrailMessage =
    typeof guardrailMessage === "string" ? guardrailMessage.trim() : "";

  if (normalizedGuardrailMessage.length > 0) {
    return {
      allow: false,
      reason: "guardrail",
      message: normalizedGuardrailMessage,
    };
  }

  if (checkCreateTextMode && isCreatePromptTool(tool) && mode === "text") {
    return {
      allow: false,
      reason: "create_text_mode",
      message: CREATE_TEXT_MODE_GENERATION_BLOCK_ERROR,
    };
  }

  if (checkPrompt && trimmedPrompt.length === 0) {
    return {
      allow: false,
      reason: "missing_prompt",
      message: GENERATION_MISSING_PROMPT_ERROR,
    };
  }

  if (checkModel && requiresModelSelection(tool, mode) && trimmedModelId.length === 0) {
    return {
      allow: false,
      reason: "missing_model",
      message: GENERATION_MISSING_MODEL_ERROR,
    };
  }

  if (checkCharacterReferences && isCreatePromptTool(tool) && !hasCharacterModeReferences) {
    return {
      allow: false,
      reason: "missing_character_references",
      message: CHARACTER_MODE_MISSING_REFERENCES_ERROR,
    };
  }

  return { allow: true };
};
