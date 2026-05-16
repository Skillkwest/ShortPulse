/**
 * Shared output lifecycle patch helpers for task submission.
 * Keeps dispatched/failure patch logic consistent across submit paths.
 */
import type { SubmissionPatch } from "./types";
import type { Provider } from "../../logic/stateParsers";
import type { StudioOutput, StudioOutputSaveState } from "../../types";

type SubmissionFailurePatch = {
  timestamp: string;
  errorMessage: string;
  errorMessageShort: string;
  errorDetail: string;
};

/**
 * Applies a standardized submit-time failure patch to one output row.
 */
export const applySubmissionFailureToOutputs = (
  outputs: StudioOutput[],
  outputId: string,
  patch: SubmissionFailurePatch
): StudioOutput[] =>
  outputs.map((item) =>
    item.id === outputId
      ? {
          ...item,
          taskState: "fail",
          status: "ready",
          ...patch,
        }
      : item
  );

type DispatchedSubmissionPatchInput = {
  item: StudioOutput;
  patch: SubmissionPatch;
  provider: Provider;
  taskId: string;
};

/**
 * Applies the dispatched patch once provider request id is available.
 */
export const applyDispatchedSubmissionPatch = ({
  item,
  patch,
  provider,
  taskId,
}: DispatchedSubmissionPatchInput): StudioOutput => ({
  ...item,
  ...patch,
  taskId,
  generationTraceId: taskId,
  taskState: "running",
  timestamp: "Submitted",
  provider: item.provider ?? provider,
  queueState: patch.queueState ?? "dispatched",
  queueEnqueuedAtMs: item.queueEnqueuedAtMs,
});

type CompletedSubmissionPatchInput = {
  item: StudioOutput;
  provider: Provider;
  generationId: string;
  requestId: string;
  previewUrl: string;
  resultUrls: string[];
  previewStoragePath?: string | null;
  fullStoragePath?: string | null;
  mimeType?: string | null;
  savedMediaIds?: string[];
  saveState?: StudioOutputSaveState;
  saveError?: string | null;
};

/**
 * Applies a terminal success patch for direct-response providers that do not poll.
 */
export const applyCompletedSubmissionPatch = ({
  item,
  provider,
  generationId,
  requestId,
  previewUrl,
  resultUrls,
  previewStoragePath,
  fullStoragePath,
  mimeType,
  savedMediaIds = [],
  saveState,
  saveError = null,
}: CompletedSubmissionPatchInput): StudioOutput => ({
  ...item,
  generationId,
  taskId: requestId,
  sourceRef: requestId,
  generationTraceId: requestId,
  provider,
  taskState: "success",
  queueState: "dispatched",
  timestamp: "Ready",
  previewUrl,
  resultUrls,
  previewStoragePath: previewStoragePath ?? item.previewStoragePath ?? null,
  fullStoragePath: fullStoragePath ?? item.fullStoragePath ?? null,
  mimeType: mimeType ?? item.mimeType ?? null,
  mediaSource: "generated",
  saveState: saveState ?? (savedMediaIds.length > 0 ? "saved" : "idle"),
  saveError,
  savedMediaIds,
  status: savedMediaIds.length > 0 ? "saved" : "ready",
  errorMessage: null,
  errorMessageShort: null,
  errorDetail: null,
});
