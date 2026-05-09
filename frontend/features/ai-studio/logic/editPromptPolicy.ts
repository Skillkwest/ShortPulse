/**
 * Prompt-requirement capability policy for edit/image-to-image models.
 * Source notes: docs/planning/evidence/ai-studio-expert-edit/2026-03-04-model-capability-notes.md
 */
import type { ToolId } from "../types";

export type EditPromptRequirement = "required" | "optional" | "unknown";
export const BRIA_BACKGROUND_REMOVE_MODEL_ID = "fal-ai/bria/background/remove";

const REQUIRED_EDIT_PROMPT_MODEL_IDS = new Set([
  "fal-ai/nano-banana-2/edit",
  "fal-ai/nano-banana-pro/edit",
  "fal-ai/bytedance/seedream/v4.5/edit",
  "fal-ai/bytedance/seedream/v5/lite/edit",
]);

const OPTIONAL_EDIT_PROMPT_MODEL_IDS = new Set([BRIA_BACKGROUND_REMOVE_MODEL_ID]);

const normalizeModelId = (modelId: string | null | undefined): string =>
  typeof modelId === "string" ? modelId.trim().toLowerCase() : "";

export const resolveEditPromptRequirement = (
  modelId: string | null | undefined
): EditPromptRequirement => {
  const normalizedModelId = normalizeModelId(modelId);
  if (!normalizedModelId) return "unknown";
  if (OPTIONAL_EDIT_PROMPT_MODEL_IDS.has(normalizedModelId)) return "optional";
  if (REQUIRED_EDIT_PROMPT_MODEL_IDS.has(normalizedModelId)) return "required";
  return "unknown";
};

export const shouldRequirePromptForEditModel = (modelId: string | null | undefined): boolean => {
  const requirement = resolveEditPromptRequirement(modelId);
  return requirement !== "optional";
};

export const shouldCheckPromptAtGenerationStart = ({
  tool,
  modelId,
}: {
  tool: ToolId | null;
  modelId: string | null | undefined;
}): boolean => {
  if (tool === "edit" || tool === "image") {
    return shouldRequirePromptForEditModel(modelId);
  }
  return true;
};
