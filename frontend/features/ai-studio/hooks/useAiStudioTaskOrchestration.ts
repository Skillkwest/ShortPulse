/**
 * AI Studio task orchestration hook.
 * Owns generation polling lifecycle, deferred autosave finalization, status retry handling, and task-submission wiring.
 */
import { useCallback, type MutableRefObject } from "react";
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
  }) => Promise<{ mediaFileIds: string[]; errors: string[] }>;
};

/**
 * Returns task submission and polling handlers used by AI Studio state orchestration.
 */
export const useAiStudioTaskOrchestration = ({
  taskSubmissionConfig,
  findOutputById,
  pendingAutoSavesRef,
  markOutputSaved,
  markOutputSaveFailed,
  persistMediaUrls,
}: UseAiStudioTaskOrchestrationParams) => {
  const { updateOutputById, notifyGenerationFailure, ensureGenerationRecord, setUiNotice } =
    taskSubmissionConfig;

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
      const { mediaFileIds, errors } = await persistMediaUrls({
        outputId,
        urls,
        provider: pending.provider,
        source: "ai_studio",
        generationId: generationId ?? null,
      });
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

  const { startPollingTask, clearPollTimer } = useAiStudioTasks({
    updateOutputById,
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

  return {
    submitTask,
    onReferenceOutputMediaLoaded,
    retryOutputStatus,
  };
};
