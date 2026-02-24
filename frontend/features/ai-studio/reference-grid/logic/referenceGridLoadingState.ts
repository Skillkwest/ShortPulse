/**
 * Reference-grid loading state helpers.
 * Centralizes task-state to loading visual semantics shared by loading and render controllers.
 */
import type { StudioOutput } from "../../types";

type ReferenceLoadingStateInput = Pick<StudioOutput, "taskState" | "previewText"> & {
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
  cardPreviewUrl,
}: ReferenceLoadingStateInput): boolean => {
  if (taskState === "pending" || taskState === "running") return true;
  return taskState === "success" && !cardPreviewUrl && !previewText;
};
