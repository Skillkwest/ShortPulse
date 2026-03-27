/**
 * Reference-grid loading state helpers.
 * Centralizes task-state to loading visual semantics shared by loading and render controllers.
 */
import type { ReferenceGridMediaAuthorityTier } from "../../logic/referenceGridMedia";
import type { StudioOutput } from "../../types";

type ReferenceLoadingStateInput = Pick<
  StudioOutput,
  "taskState" | "previewText" | "mediaSource"
> & {
  authorityTier: ReferenceGridMediaAuthorityTier;
  cardPreviewUrl: string | null;
};

/**
 * Returns whether an output should be treated as failing for loading visual decisions.
 */
export const isReferenceOutputFailing = (output: Pick<StudioOutput, "taskState">): boolean =>
  output.taskState === "fail";

/**
 * Returns whether an output is in a loading task state for reference-grid spinner visuals.
 */
export const isReferenceOutputLoadingTaskState = ({
  taskState,
  previewText,
  mediaSource,
  authorityTier,
  cardPreviewUrl,
}: ReferenceLoadingStateInput): boolean => {
  if (taskState === "pending" || taskState === "running") return true;
  if (taskState === "success" && mediaSource === "generated" && authorityTier === "preview-only") {
    return true;
  }
  return taskState === "success" && !cardPreviewUrl && !previewText;
};
