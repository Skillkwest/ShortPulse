/**
 * AI Studio task orchestration hook.
 * Owns generation polling lifecycle, deferred autosave finalization, status retry handling, and task-submission wiring.
 */
import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import { logMediaEvent, updateGenerationRecord } from "../logic/mediaLibraryPersistence";
import { type Provider } from "../logic/stateParsers";
import type { StudioOutput } from "../types";
import { useAiStudioTaskSubmission } from "./useAiStudioTaskSubmission";
import { useAiStudioTasks } from "./useAiStudioTasks";

export type PendingAutoSave = {
  taskId: string;
  provider: Provider;
  resultUrls: string[];
};

type GenerationFailureReason =
  | "no_media_after_terminal_success"
  | "poll_timeout"
  | "provider_error"
  | "status_poll_error";

type TaskSubmissionConfig = Omit<
  Parameters<typeof useAiStudioTaskSubmission>[0],
  "startPollingTask"
>;

type UseAiStudioTaskOrchestrationParams = {
  taskSubmissionConfig: TaskSubmissionConfig;
  outputs?: StudioOutput[];
  findOutputById: (id: string) => StudioOutput | null;
  pendingAutoSavesRef: MutableRefObject<Record<string, PendingAutoSave>>;
  markOutputSaved: (
    outputId: string,
    mediaFileIds?: string[],
    options?: { showPill?: boolean }
  ) => void;
  markOutputSaveFailed: (
    outputId: string,
    message: string,
    options?: { showPill?: boolean }
  ) => void;
  persistMediaUrls: (args: {
    outputId: string;
    urls: string[];
    provider: Provider;
    source: "upload" | "ai_studio";
    generationId?: string | null;
  }) => Promise<{
    mediaFileIds: string[];
    errors: string[];
    delivery: {
      previewStoragePath: string | null;
      fullStoragePath: string | null;
      previewUrl: string | null;
      fullUrl: string | null;
    } | null;
  }>;
};

type StuckSpinnerRetryState = {
  firstSeenAtMs: number;
  lastRetryAtMs: number;
  retries: number;
};

const STUCK_SPINNER_RETRY_INTERVAL_MS = 30_000;
const STUCK_SPINNER_RETRY_AGE_MS = 90_000;
const STUCK_SPINNER_MAX_AUTO_RETRIES = 2;

const isAutoRetryEligible = (output: StudioOutput): boolean => {
  const hasTaskId = typeof output.taskId === "string" && output.taskId.trim().length > 0;
  if (!hasTaskId) return false;
  if (output.previewUrl || output.previewText) return false;
  return (
    output.taskState === "pending" ||
    output.taskState === "running" ||
    output.taskState === "success"
  );
};

/**
 * Returns task submission and polling handlers used by AI Studio state orchestration.
 */
export const useAiStudioTaskOrchestration = ({
  taskSubmissionConfig,
  outputs = [],
  findOutputById,
  pendingAutoSavesRef,
  markOutputSaved,
  markOutputSaveFailed,
  persistMediaUrls,
}: UseAiStudioTaskOrchestrationParams) => {
  const { updateOutputById, notifyGenerationFailure, ensureGenerationRecord, setUiNotice } =
    taskSubmissionConfig;
  const stuckSpinnerRetryStateRef = useRef<Record<string, StuckSpinnerRetryState>>({});

  const finalizeDeferredAutoSave = useCallback(
    async (outputId: string) => {
      const pending = pendingAutoSavesRef.current[outputId];
      if (!pending) return;
      delete pendingAutoSavesRef.current[outputId];

      const output = findOutputById(outputId);
      if (!output || output.savedMediaIds?.length) return;

      const urls = pending.resultUrls.filter(Boolean);
      if (!urls.length) return;

      const generationId =
        output.generationId ??
        (await ensureGenerationRecord({
          outputId,
          provider: pending.provider,
          taskId: pending.taskId,
        }));

      updateOutputById(outputId, (item) => ({
        ...item,
        saveState: "saving",
        saveError: null,
      }));
      const { mediaFileIds, errors, delivery } = await persistMediaUrls({
        outputId,
        urls,
        provider: pending.provider,
        source: "ai_studio",
        generationId: generationId ?? null,
      });
      if (delivery) {
        updateOutputById(outputId, (item) => ({
          ...item,
          previewStoragePath: delivery.previewStoragePath ?? item.previewStoragePath ?? null,
          fullStoragePath:
            delivery.fullStoragePath ?? item.fullStoragePath ?? item.previewStoragePath ?? null,
          previewUrl: item.previewUrl ?? delivery.previewUrl ?? delivery.fullUrl ?? undefined,
        }));
      }
      if (mediaFileIds.length) {
        markOutputSaved(outputId, mediaFileIds, { showPill: true });
      } else if (errors.length) {
        const message = errors[0] ?? "Unable to save media.";
        markOutputSaveFailed(outputId, message, { showPill: true });
      }
      if (generationId) {
        try {
          await updateGenerationRecord(generationId, {
            provider: pending.provider,
            modelId: output.modelId ?? output.model,
            promptText: output.prompt,
            aspect: output.aspect,
            requestId: pending.taskId,
            status: "success",
            metadata: {
              result_urls: urls,
              media_file_ids: mediaFileIds,
            },
          });
        } catch {
          // best-effort update
        }
      }
    },
    [
      ensureGenerationRecord,
      findOutputById,
      markOutputSaveFailed,
      markOutputSaved,
      pendingAutoSavesRef,
      persistMediaUrls,
      updateOutputById,
    ]
  );

  const handleGenerationSuccess = useCallback(
    ({
      outputId,
      taskId,
      provider,
      resultUrls,
    }: {
      outputId: string;
      taskId: string;
      provider: Provider;
      resultUrls: string[];
    }) => {
      const output = findOutputById(outputId);
      if (!output) return;
      if (output.savedMediaIds?.length) return;
      const urls = resultUrls.filter(Boolean);
      if (!urls.length) return;
      pendingAutoSavesRef.current[outputId] = {
        taskId,
        provider,
        resultUrls: urls,
      };
    },
    [findOutputById, pendingAutoSavesRef]
  );

  const handleGenerationFailure = useCallback(
    async ({
      outputId,
      taskId,
      provider,
      message,
      reasonCode,
    }: {
      outputId: string;
      taskId?: string;
      provider: Provider;
      message: string;
      reasonCode?: GenerationFailureReason;
    }) => {
      delete pendingAutoSavesRef.current[outputId];
      const output = findOutputById(outputId);
      if (!output) return;
      const generationId =
        output.generationId ??
        (await ensureGenerationRecord({
          outputId,
          provider,
          taskId,
        }));
      if (generationId) {
        try {
          await updateGenerationRecord(generationId, {
            provider,
            modelId: output.modelId ?? output.model,
            promptText: output.prompt,
            aspect: output.aspect,
            requestId: taskId ?? output.taskId,
            status: "fail",
            metadata: {
              error: message,
              failure_reason_code: reasonCode ?? null,
            },
          });
          await logMediaEvent({
            eventType: "generation_failed",
            entityType: "ai_generation",
            entityId: generationId,
            metadata: {
              error: message,
              provider,
              model_id: output.modelId ?? output.model,
              failure_reason_code: reasonCode ?? null,
            },
          });
        } catch {
          // best-effort updates
        }
      }
    },
    [ensureGenerationRecord, findOutputById, pendingAutoSavesRef]
  );

  const { startPollingTask, clearPollTimer, pollTimersRef } = useAiStudioTasks({
    updateOutputById,
    findOutputById,
    notifyGenerationFailure,
    onGenerationSuccess: handleGenerationSuccess,
    onGenerationFailure: handleGenerationFailure,
  });

  const submitTask = useAiStudioTaskSubmission({
    ...taskSubmissionConfig,
    startPollingTask,
  });

  const onReferenceOutputMediaLoaded = useCallback(
    (outputId: string) => {
      void finalizeDeferredAutoSave(outputId);
    },
    [finalizeDeferredAutoSave]
  );

  const retryOutputStatus = useCallback(
    (outputId: string) => {
      const output = findOutputById(outputId);
      if (!output) return;
      const taskId = output.taskId?.trim();
      if (!taskId) {
        setUiNotice("Unable to retry status because this generation has no task id.");
        return;
      }
      const provider = (output.provider as Provider | undefined) ?? "fal";
      updateOutputById(outputId, (item) => ({
        ...item,
        taskState: "running",
        status: "ready",
        timestamp: "Retrying status...",
        errorMessage: null,
        errorMessageShort: null,
        errorDetail: null,
      }));
      clearPollTimer(outputId);
      startPollingTask(taskId, outputId, 0, provider);
    },
    [clearPollTimer, findOutputById, setUiNotice, startPollingTask, updateOutputById]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const runStuckSpinnerWatchdog = () => {
      const now = Date.now();
      const activeEligibleIds = new Set<string>();

      outputs.forEach((output) => {
        if (!isAutoRetryEligible(output)) return;
        activeEligibleIds.add(output.id);

        const existing = stuckSpinnerRetryStateRef.current[output.id];
        if (!existing) {
          stuckSpinnerRetryStateRef.current[output.id] = {
            firstSeenAtMs: now,
            lastRetryAtMs: 0,
            retries: 0,
          };
          return;
        }

        if (pollTimersRef.current[output.id]) return;
        if (existing.retries >= STUCK_SPINNER_MAX_AUTO_RETRIES) return;

        const ageMs = now - existing.firstSeenAtMs;
        if (ageMs < STUCK_SPINNER_RETRY_AGE_MS) return;
        if (
          existing.lastRetryAtMs > 0 &&
          now - existing.lastRetryAtMs < STUCK_SPINNER_RETRY_AGE_MS
        ) {
          return;
        }

        existing.retries += 1;
        existing.lastRetryAtMs = now;
        retryOutputStatus(output.id);
      });

      Object.keys(stuckSpinnerRetryStateRef.current).forEach((outputId) => {
        if (!activeEligibleIds.has(outputId)) {
          delete stuckSpinnerRetryStateRef.current[outputId];
        }
      });
    };

    runStuckSpinnerWatchdog();
    const intervalId = window.setInterval(runStuckSpinnerWatchdog, STUCK_SPINNER_RETRY_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [outputs, pollTimersRef, retryOutputStatus]);

  return {
    submitTask,
    onReferenceOutputMediaLoaded,
    retryOutputStatus,
  };
};
