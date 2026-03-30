/**
 * Reference-grid placeholder helpers.
 * Identifies pending/running outputs that should render as lightweight loading cards
 * until preview media exists.
 */
import type { StudioOutput } from "../../types";

const hasResultMedia = (output: StudioOutput): boolean =>
  Array.isArray(output.resultUrls) &&
  output.resultUrls.some((value) => typeof value === "string" && value.trim().length > 0);

/**
 * Returns true when an output is still a generation placeholder with no preview media to resolve.
 */
export const isReferenceGridPlaceholderOnlyOutput = (output: StudioOutput): boolean => {
  const isLoadingTaskState = output.taskState === "pending" || output.taskState === "running";
  if (!isLoadingTaskState) return false;
  if (output.previewText) return false;
  return (
    !output.previewUrl &&
    !output.localObjectUrl &&
    !output.previewStoragePath &&
    !output.fullStoragePath &&
    !hasResultMedia(output)
  );
};
