/**
 * Submission lifecycle callbacks for provider dispatch and direct completion.
 * Keeps polling handoff and completed-output patching out of the main submit hook.
 */
import { addBreadcrumb } from "../../../../lib/clientBreadcrumbs";
import type { FalSubmitResponse } from "../../../../lib/falClient";
import type { Provider } from "../../logic/stateParsers";
import type { StudioOutput, ToolId } from "../../types";
import { DISPATCH_HANDOFF_INITIAL_POLL_DELAY_MS } from "../useAiStudioTasks";
import {
  applyCompletedSubmissionPatch,
  applyDispatchedSubmissionPatch,
} from "./outputLifecyclePatches";
import type { ImmediateGenerationResult, SubmissionPatch } from "./types";

type EnsureGenerationRecordInput = {
  outputId: string;
  provider: Provider;
  taskId?: string;
  durationSeconds?: number;
  resolution?: string | null;
  metadata?: Record<string, unknown>;
};

type CreateSubmissionLifecycleCallbacksParams = {
  outputId: string;
  modelId: string;
  tool: ToolId | null;
  requestedDurationSeconds: number;
  requestedResolution?: string;
  requestedAudio: boolean;
  sourceRef: string;
  requestedAspect: string;
  effectiveAspect: string;
  submissionTraceId: string;
  isOutputAbandoned?: (outputId: string) => boolean;
  updateOutputById: (id: string, updater: (item: StudioOutput) => StudioOutput) => void;
  startPollingTask: (
    taskId: string,
    outputId: string,
    attempt?: number,
    provider?: Provider,
    startedAt?: number,
    noMediaAttempt?: number,
    pollSessionId?: number,
    options?: { initialDelayMs?: number }
  ) => void;
  ensureGenerationRecord: (input: EnsureGenerationRecordInput) => Promise<string | null>;
  markStarted: (taskId: string, provider: Provider) => void;
  createLifecycleContractError: (detail: string) => Error;
};

const syncResolvedGenerationId = ({
  outputId,
  resolvedGenerationId,
  updateOutputById,
}: {
  outputId: string;
  resolvedGenerationId: string | null;
  updateOutputById: (id: string, updater: (item: StudioOutput) => StudioOutput) => void;
}) => {
  if (typeof resolvedGenerationId !== "string" || resolvedGenerationId.trim().length === 0) {
    return;
  }
  const normalizedGenerationId = resolvedGenerationId.trim();
  updateOutputById(outputId, (item) => {
    if (item.generationId === normalizedGenerationId) return item;
    return {
      ...item,
      generationId: normalizedGenerationId,
    };
  });
};

export const createSubmissionLifecycleCallbacks = ({
  outputId,
  modelId,
  tool,
  requestedDurationSeconds,
  requestedResolution,
  requestedAudio,
  sourceRef,
  requestedAspect,
  effectiveAspect,
  submissionTraceId,
  isOutputAbandoned,
  updateOutputById,
  startPollingTask,
  ensureGenerationRecord,
  markStarted,
  createLifecycleContractError,
}: CreateSubmissionLifecycleCallbacksParams) => {
  let claimedLifecycleMode: "queued" | "direct" | null = null;
  const claimLifecycleMode = (nextMode: "queued" | "direct", actionLabel: string) => {
    if (claimedLifecycleMode == null) {
      claimedLifecycleMode = nextMode;
      return;
    }
    const detail =
      claimedLifecycleMode === nextMode
        ? `Submission lifecycle already claimed '${nextMode}' before ${actionLabel}.`
        : `Submission lifecycle cannot ${actionLabel} after '${claimedLifecycleMode}' was already claimed.`;
    throw createLifecycleContractError(detail);
  };

  const startPollingWithGeneration = (
    taskId: string | undefined,
    provider: Provider,
    patch: SubmissionPatch = {},
    submitResponse?: FalSubmitResponse
  ) => {
    claimLifecycleMode("queued", "starting queued polling");
    const submitGenerationId =
      submitResponse &&
      "request_id" in submitResponse &&
      typeof submitResponse.generationId === "string" &&
      submitResponse.generationId.trim().length > 0
        ? submitResponse.generationId.trim()
        : null;
    const effectivePatch =
      submitGenerationId && !patch.generationId
        ? {
            ...patch,
            generationId: submitGenerationId,
          }
        : patch;
    const normalizedTaskId = taskId?.trim();
    if (!normalizedTaskId) throw new Error("Provider returned an empty request id.");
    markStarted(normalizedTaskId, provider);
    if (isOutputAbandoned?.(outputId)) return;
    updateOutputById(outputId, (item) =>
      applyDispatchedSubmissionPatch({
        item,
        patch: effectivePatch,
        provider,
        taskId: normalizedTaskId,
      })
    );
    startPollingTask(normalizedTaskId, outputId, 0, provider, Date.now(), 0, undefined, {
      initialDelayMs: DISPATCH_HANDOFF_INITIAL_POLL_DELAY_MS,
    });
    void ensureGenerationRecord({
      outputId,
      provider,
      taskId: normalizedTaskId,
      durationSeconds: requestedDurationSeconds,
      resolution: requestedResolution ?? null,
      metadata: {
        tool,
        audio: requestedAudio,
        source_ref: sourceRef,
        requested_aspect: requestedAspect,
        effective_aspect: effectiveAspect,
        resolution: requestedResolution ?? null,
        duration_seconds: requestedDurationSeconds,
        submission_trace_id: submissionTraceId,
        generation_trace_id: normalizedTaskId,
      },
    }).then((resolvedGenerationId) => {
      syncResolvedGenerationId({
        outputId,
        resolvedGenerationId,
        updateOutputById,
      });
    });
    addBreadcrumb({
      type: "ui",
      level: "info",
      message: "fal_submit_dispatched",
      data: {
        output_id: outputId,
        model_id: modelId,
        provider,
        task_id: normalizedTaskId,
        tool,
      },
    });
  };

  const completeGenerationImmediately = ({
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
  }: ImmediateGenerationResult) => {
    claimLifecycleMode("direct", "completing a direct-response submission");
    markStarted(requestId, provider);
    if (isOutputAbandoned?.(outputId)) return;
    updateOutputById(outputId, (item) =>
      applyCompletedSubmissionPatch({
        item,
        provider,
        generationId,
        requestId,
        previewUrl,
        resultUrls,
        previewStoragePath,
        fullStoragePath,
        mimeType,
        savedMediaIds,
        saveState,
        saveError,
      })
    );
    void ensureGenerationRecord({
      outputId,
      provider,
      taskId: requestId,
      durationSeconds: requestedDurationSeconds,
      resolution: requestedResolution ?? null,
      metadata: {
        tool,
        audio: requestedAudio,
        source_ref: sourceRef,
        requested_aspect: requestedAspect,
        effective_aspect: effectiveAspect,
        resolution: requestedResolution ?? null,
        duration_seconds: requestedDurationSeconds,
        submission_trace_id: submissionTraceId,
        generation_trace_id: requestId,
        completion_mode: "direct",
      },
    }).then((resolvedGenerationId) => {
      syncResolvedGenerationId({
        outputId,
        resolvedGenerationId,
        updateOutputById,
      });
    });
  };

  return {
    startPollingWithGeneration,
    completeGenerationImmediately,
  };
};
