/**
 * Submission-start invariants for AI Studio generation requests.
 * Keeps pre-submit validation logic deterministic and isolated from hook side effects.
 */
import type { StudioMode, ToolId } from "../../types";

export type NormalizedSubmissionTool = ToolId | "image" | "video";

/**
 * Normalizes legacy tool aliases to shared workflow buckets.
 */
export const normalizeSubmissionTool = (
  tool: ToolId | null | undefined
): NormalizedSubmissionTool | null => {
  if (tool === "kling") return "video";
  if (tool === "edit") return "image";
  return tool ?? null;
};

/**
 * Determines whether a create/text submission should no-op in text mode.
 */
export const shouldSkipTextCreateSubmission = (
  tool: ToolId | null | undefined,
  mode: StudioMode
): boolean => (tool === "create" || tool === "text") && mode === "text";

type SubmissionStartUiErrorInput = {
  cleanedSubmissionPrompt: string;
  isEditWorkflow: boolean;
  hasReferenceImages: boolean;
  finalModel: string | null;
  requiresImageToImageReferences: boolean;
};

/**
 * Resolves user-facing submit-start validation errors in precedence order.
 */
export const resolveSubmissionStartUiError = ({
  cleanedSubmissionPrompt,
  isEditWorkflow,
  hasReferenceImages,
  finalModel,
  requiresImageToImageReferences,
}: SubmissionStartUiErrorInput): string | null => {
  if (!cleanedSubmissionPrompt) {
    return "Add a prompt to start a generation.";
  }
  if (isEditWorkflow && !hasReferenceImages) {
    return "Add a reference image before generating.";
  }
  if (!finalModel) {
    return "Pick a model to generate.";
  }
  if (requiresImageToImageReferences && !hasReferenceImages) {
    return "Add a reference image before generating.";
  }
  return null;
};
