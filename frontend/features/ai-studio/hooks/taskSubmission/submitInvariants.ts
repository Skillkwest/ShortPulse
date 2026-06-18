/**
 * Submission-start invariants for AI Studio generation requests.
 * Keeps pre-submit validation logic deterministic and isolated from hook side effects.
 */
import type { StudioMode, ToolId } from "../../types";

export type NormalizedSubmissionTool = ToolId | "image" | "video";
export type SubmissionInvariantError = Error & {
  code?: "SUBMIT_NOT_STARTED" | "SUBMIT_LIFECYCLE_CONTRACT";
  detail?: string;
};

export const CREATE_TEXT_MODE_SUBMIT_BLOCK_ERROR =
  "Switch to image generation before running this action.";

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

/**
 * Creates the invariant error used when a submit route finishes without provider handoff.
 */
export const submitNotStartedError = (detail: string): SubmissionInvariantError => {
  const error = new Error("Provider task did not start.") as SubmissionInvariantError;
  error.code = "SUBMIT_NOT_STARTED";
  error.detail = detail;
  return error;
};

/**
 * Creates the invariant error used when queued/direct submit lifecycle rules are violated.
 */
export const submitLifecycleContractError = (detail: string): SubmissionInvariantError => {
  const error = new Error(
    "Provider submission lifecycle contract was violated."
  ) as SubmissionInvariantError;
  error.code = "SUBMIT_LIFECYCLE_CONTRACT";
  error.detail = detail;
  return error;
};

type SubmissionStartUiErrorInput = {
  cleanedSubmissionPrompt: string;
  requiresPrompt: boolean;
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
  requiresPrompt,
  isEditWorkflow,
  hasReferenceImages,
  finalModel,
  requiresImageToImageReferences,
}: SubmissionStartUiErrorInput): string | null => {
  if (requiresPrompt && !cleanedSubmissionPrompt) {
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
