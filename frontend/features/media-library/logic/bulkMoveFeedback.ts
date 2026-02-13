/**
 * Bulk move feedback helper for Media Library.
 * Centralizes success/partial/failure copy and tab-switch behavior for batch move results.
 */

export type BulkMoveFeedback = {
  notice: string | null;
  error: string | null;
  shouldSwitchTab: boolean;
};

type BuildBulkMoveFeedbackInput = {
  movedCount: number;
  requestedCount: number;
  failedCount: number;
  destinationLabel: string;
  firstFailureMessage?: string | null;
};

const pluralizeFiles = (count: number): string => (count === 1 ? "file" : "files");

/**
 * Builds user-facing feedback for a completed bulk move operation.
 */
export const buildBulkMoveFeedback = ({
  movedCount,
  requestedCount,
  failedCount,
  destinationLabel,
  firstFailureMessage,
}: BuildBulkMoveFeedbackInput): BulkMoveFeedback => {
  if (movedCount > 0 && failedCount === 0) {
    return {
      notice: `${movedCount} selected ${pluralizeFiles(movedCount)} moved to ${destinationLabel}.`,
      error: null,
      shouldSwitchTab: true,
    };
  }

  if (movedCount > 0 && failedCount > 0) {
    return {
      notice: `${movedCount} of ${requestedCount} selected files moved to ${destinationLabel}.`,
      error:
        `${failedCount} ${pluralizeFiles(failedCount)} failed to move. ${firstFailureMessage ?? ""}`.trim(),
      shouldSwitchTab: false,
    };
  }

  if (failedCount > 0) {
    return {
      notice: null,
      error: `Unable to move selected files. ${firstFailureMessage ?? ""}`.trim(),
      shouldSwitchTab: false,
    };
  }

  return {
    notice: null,
    error: "No selected files were moved.",
    shouldSwitchTab: false,
  };
};
