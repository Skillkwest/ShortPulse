/**
 * Prompt-requirement capability policy for edit/image-to-image models.
 * Source notes: docs/planning/evidence/ai-studio-expert-edit/2026-03-04-model-capability-notes.md
 */
import { getModelPromptPolicy } from "../../../lib/model-runtime/modelCatalog";
import type { ToolId, VideoReferenceMode } from "../types";

export type EditPromptRequirement = "required" | "optional" | "unknown";
export const BRIA_BACKGROUND_REMOVE_MODEL_ID = "fal-ai/bria/background/remove";

const normalizeModelId = (modelId: string | null | undefined): string =>
  typeof modelId === "string" ? modelId.trim().toLowerCase() : "";

export const resolveEditPromptRequirement = (
  modelId: string | null | undefined
): EditPromptRequirement => {
  const normalizedModelId = normalizeModelId(modelId);
  if (!normalizedModelId) return "unknown";
  const promptPolicy = getModelPromptPolicy(normalizedModelId);
  if (promptPolicy) return promptPolicy;
  return "unknown";
};

export const shouldRequirePromptForEditModel = (modelId: string | null | undefined): boolean => {
  const requirement = resolveEditPromptRequirement(modelId);
  return requirement !== "optional";
};

export const shouldCheckPromptAtGenerationStart = ({
  tool,
  modelId,
  videoReferenceMode,
}: {
  tool: ToolId | null;
  modelId: string | null | undefined;
  videoReferenceMode?: VideoReferenceMode | null;
}): boolean => {
  if ((tool === "video" || tool === "kling") && videoReferenceMode) {
    return videoReferenceMode !== "motion" && videoReferenceMode !== "lip-sync";
  }
  if (tool === "edit" || tool === "image") {
    return shouldRequirePromptForEditModel(modelId);
  }
  return true;
};
