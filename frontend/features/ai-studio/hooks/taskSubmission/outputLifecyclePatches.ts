/**
 * Shared output lifecycle patch helpers for task submission.
 * Keeps queue/dispatched/failure patch logic consistent across submit paths.
 */
import type { SubmissionPatch } from "./types";
import type { Provider } from "../../logic/stateParsers";
import type { StudioOutput } from "../../types";

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

type QueuedSubmissionPatchInput = {
  item: StudioOutput;
  patch: SubmissionPatch;
  provider: Provider;
  generationId: string;
  sourceRef?: string | null;
  queueEnqueuedAtMs: number;
};

/**
 * Applies the queued placeholder patch while waiting for dispatch.
 */
export const applyQueuedSubmissionPatch = ({
  item,
  patch,
  provider,
  generationId,
  sourceRef,
  queueEnqueuedAtMs,
}: QueuedSubmissionPatchInput): StudioOutput => ({
  ...item,
  ...patch,
  generationId: patch.generationId ?? generationId,
  sourceRef: patch.sourceRef ?? item.sourceRef ?? sourceRef ?? undefined,
  taskState: "pending",
  timestamp: "Submitting...",
  provider: item.provider ?? provider,
  queueState: "queued",
  queueEnqueuedAtMs: item.queueEnqueuedAtMs ?? queueEnqueuedAtMs,
});

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
  queueState: undefined,
  queueEnqueuedAtMs: undefined,
});
