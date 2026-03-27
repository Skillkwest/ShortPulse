/**
 * AI Studio task orchestration hook.
 * Owns generation polling lifecycle, status retry handling, and task-submission wiring.
 */
import { useCallback, useEffect, useRef } from "react";
import { fetchFalQueueStatus } from "../../../lib/falClient";
import { BRIA_BACKGROUND_REMOVE_MODEL_ID } from "../logic/editPromptPolicy";
import { normalizeProviderForPolling, type Provider } from "../logic/stateParsers";
import type { StudioOutput } from "../types";
import { useAiStudioTaskSubmission } from "./useAiStudioTaskSubmission";
import { useAiStudioTasks } from "./useAiStudioTasks";

type TaskSubmissionConfig = Omit<
  Parameters<typeof useAiStudioTaskSubmission>[0],
  "startPollingTask"
>;

type UseAiStudioTaskOrchestrationParams = {
  taskSubmissionConfig: TaskSubmissionConfig;
  outputs?: StudioOutput[];
  findOutputById: (id: string) => StudioOutput | null;
  setPrimaryEditReferenceImageUrl?: (url: string | null) => void;
};

type StuckSpinnerRetryState = {
  firstSeenAtMs: number;
  lastRetryAtMs: number;
  retries: number;
};

type QueueResumeNotFoundState = {
  firstSeenAtMs: number;
  retries: number;
};

const STUCK_SPINNER_RETRY_INTERVAL_MS = 30_000;
const STUCK_SPINNER_RETRY_AGE_MS = 90_000;
const STUCK_SPINNER_MAX_AUTO_RETRIES = 2;
const QUEUE_RESUME_SCAN_INTERVAL_MS = 20_000;
const QUEUE_RESUME_MIN_RECHECK_MS = 12_000;
const QUEUE_RESUME_MAX_CONCURRENT = 3;
const QUEUE_RESUME_NOT_FOUND_MAX_RETRIES = 6;
const QUEUE_RESUME_NOT_FOUND_MAX_AGE_MS = 90_000;
const QUEUE_RESUME_DEFER_AFTER_ENQUEUE_MS = 3 * 60_000;

const isDocumentVisible = (): boolean =>
  typeof document === "undefined" || document.visibilityState === "visible";

const resolveQueuedResumeProvider = ({
  queueStatusProvider,
  outputProvider,
  modelId,
}: {
  queueStatusProvider: string;
  outputProvider: Provider;
  modelId?: string | null;
}): Provider => {
  const modelDerivedProvider =
    typeof modelId === "string" && modelId.trim().length > 0
      ? normalizeProviderForPolling(modelId, outputProvider)
      : outputProvider;
  const normalizedProvider = normalizeProviderForPolling(queueStatusProvider, modelDerivedProvider);
  if (normalizedProvider === "fal" && modelDerivedProvider.startsWith("fal-")) {
    return modelDerivedProvider;
  }
  return normalizedProvider;
};

const isAutoRetryEligible = (output: StudioOutput): boolean => {
  const hasTerminalNoMediaFailure =
    output.errorMessageShort === "No media returned." ||
    /no media url was returned/i.test(output.errorMessage ?? "");
  if (hasTerminalNoMediaFailure) return false;
  const hasTaskId = typeof output.taskId === "string" && output.taskId.trim().length > 0;
  if (!hasTaskId) return false;
  if (output.previewUrl || output.previewText) return false;
  return (
    output.taskState === "pending" ||
    output.taskState === "running" ||
    output.taskState === "success"
  );
};

const isQueueResumeEligible = (output: StudioOutput): boolean => {
  const generationId = typeof output.generationId === "string" ? output.generationId.trim() : "";
  if (!generationId) return false;
  // Resume should still run when queue metadata was dropped or partially persisted
  // (for example queueState=dispatched without a taskId after restore).
  if (output.queueState && output.queueState !== "queued" && output.queueState !== "dispatched") {
    return false;
  }
  if (typeof output.taskId === "string" && output.taskId.trim().length > 0) return false;
  if (output.previewUrl || output.previewText) return false;
  if (output.taskState === "fail") return false;
  return (
    output.taskState === "pending" ||
    output.taskState === "running" ||
    output.taskState === "success" ||
    output.taskState == null
  );
};

const shouldDeferQueueResumeToSubmitPolling = (output: StudioOutput, nowMs: number): boolean => {
  if (output.queueState !== "queued") return false;
  if (typeof output.queueEnqueuedAtMs !== "number" || !Number.isFinite(output.queueEnqueuedAtMs)) {
    return false;
  }
  return nowMs - Math.trunc(output.queueEnqueuedAtMs) < QUEUE_RESUME_DEFER_AFTER_ENQUEUE_MS;
};

/**
 * Returns task submission and polling handlers used by AI Studio state orchestration.
 */
export const useAiStudioTaskOrchestration = ({
  taskSubmissionConfig,
  outputs = [],
  findOutputById,
  setPrimaryEditReferenceImageUrl,
}: UseAiStudioTaskOrchestrationParams) => {
  const { updateOutputById, notifyGenerationFailure, setUiNotice, setOutputs } =
    taskSubmissionConfig;
  const outputsRef = useRef<StudioOutput[]>(outputs);
  const queueResumeCandidatesRef = useRef<StudioOutput[]>([]);
  const stuckSpinnerRetryStateRef = useRef<Record<string, StuckSpinnerRetryState>>({});
  const queueResumeInFlightRef = useRef<Record<string, boolean>>({});
  const queueResumeLastCheckedAtRef = useRef<Record<string, number>>({});
  const queueResumeNotFoundStateRef = useRef<Record<string, QueueResumeNotFoundState>>({});

  useEffect(() => {
    outputsRef.current = outputs;
    queueResumeCandidatesRef.current = outputs.filter((output) => isQueueResumeEligible(output));
  }, [outputs]);

  const handlePollingOutputLookupHardStop = useCallback(
    async (payload: {
      outputId: string;
      taskId: string;
      provider: Provider;
      lookupMisses: number;
      missingDurationMs: number;
    }) => {
      void payload;
      // Server runtime owns lifecycle persistence and recovery scheduling.
    },
    []
  );

  const isPrimaryReferenceReplacementOutput = useCallback((output: StudioOutput | null) => {
    if (!output) return false;
    return (
      output.mode === "image" &&
      output.hiddenInReferenceGrid === true &&
      output.modelId === BRIA_BACKGROUND_REMOVE_MODEL_ID
    );
  }, []);

  const clearPrimaryReferenceReplacementOutput = useCallback(
    (outputId: string) => {
      if (!setPrimaryEditReferenceImageUrl) return;
      setOutputs((prev) => prev.filter((item) => item.id !== outputId));
    },
    [setOutputs, setPrimaryEditReferenceImageUrl]
  );

  const handleGenerationSuccess = useCallback(
    (payload: { outputId: string; resultUrls: string[] }) => {
      const output = findOutputById(payload.outputId);
      if (!isPrimaryReferenceReplacementOutput(output)) return;
      const primaryResultUrl = payload.resultUrls[0] ?? null;
      if (!primaryResultUrl || !setPrimaryEditReferenceImageUrl) return;
      setPrimaryEditReferenceImageUrl(primaryResultUrl);
      clearPrimaryReferenceReplacementOutput(payload.outputId);
    },
    [
      clearPrimaryReferenceReplacementOutput,
      findOutputById,
      isPrimaryReferenceReplacementOutput,
      setPrimaryEditReferenceImageUrl,
    ]
  );

  const handleGenerationFailure = useCallback(
    (payload: { outputId: string }) => {
      const output = findOutputById(payload.outputId);
      if (!isPrimaryReferenceReplacementOutput(output)) return;
      clearPrimaryReferenceReplacementOutput(payload.outputId);
    },
    [clearPrimaryReferenceReplacementOutput, findOutputById, isPrimaryReferenceReplacementOutput]
  );

  const { startPollingTask, clearPollTimer, pollTimersRef } = useAiStudioTasks({
    updateOutputById,
    findOutputById,
    notifyGenerationFailure,
    onGenerationSuccess: handleGenerationSuccess,
    onGenerationFailure: handleGenerationFailure,
    onPollingOutputLookupHardStop: handlePollingOutputLookupHardStop,
  });

  const submitTask = useAiStudioTaskSubmission({
    ...taskSubmissionConfig,
    startPollingTask,
  });

  const onReferenceOutputMediaLoaded = useCallback((outputId: string) => {
    void outputId;
    // Generated reference-grid media remains unsaved until explicitly saved by the user.
  }, []);

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

  const runQueuedOutputResumeWatchdog = useCallback(() => {
    if (!isDocumentVisible()) return;
    const now = Date.now();
    const activeQueuedIds = new Set<string>();
    const outputsSnapshot = queueResumeCandidatesRef.current;

    let inFlightCount = Object.values(queueResumeInFlightRef.current).filter(Boolean).length;
    outputsSnapshot.forEach((output) => {
      if (!isQueueResumeEligible(output)) return;
      if (shouldDeferQueueResumeToSubmitPolling(output, now)) return;
      activeQueuedIds.add(output.id);
      if (inFlightCount >= QUEUE_RESUME_MAX_CONCURRENT) return;
      if (queueResumeInFlightRef.current[output.id]) return;
      const lastCheckedAt = queueResumeLastCheckedAtRef.current[output.id] ?? 0;
      if (now - lastCheckedAt < QUEUE_RESUME_MIN_RECHECK_MS) return;
      const generationId = output.generationId?.trim();
      if (!generationId) return;

      queueResumeInFlightRef.current[output.id] = true;
      queueResumeLastCheckedAtRef.current[output.id] = now;
      inFlightCount += 1;

      void (async () => {
        try {
          const queueStatus = await fetchFalQueueStatus({ generationId });
          if (!findOutputById(output.id)) return;
          if (queueStatus.status === "dispatched") {
            delete queueResumeNotFoundStateRef.current[output.id];
            const requestId = queueStatus.requestId.trim();
            const outputProvider = (output.provider as Provider | undefined) ?? "fal";
            const provider = resolveQueuedResumeProvider({
              queueStatusProvider: queueStatus.provider,
              outputProvider,
              modelId: output.modelId ?? null,
            });
            clearPollTimer(output.id);
            updateOutputById(output.id, (item) => {
              if (item.taskId && item.generationId) return item;
              return {
                ...item,
                provider: item.provider ?? provider,
                generationId:
                  item.generationId ??
                  (typeof queueStatus.generationId === "string" &&
                  queueStatus.generationId.trim().length > 0
                    ? queueStatus.generationId.trim()
                    : item.generationId),
                taskId: requestId,
                generationTraceId: requestId,
                queueState: "dispatched",
                taskState: "running",
                status: "ready",
                timestamp: "Submitted",
                errorMessage: null,
                errorMessageShort: null,
                errorDetail: null,
              };
            });
            startPollingTask(requestId, output.id, 0, provider);
            return;
          }
          if (queueStatus.status === "failed") {
            delete queueResumeNotFoundStateRef.current[output.id];
            notifyGenerationFailure(output.id, queueStatus.message, queueStatus.message);
            return;
          }
          if (queueStatus.status === "not_found") {
            const current = queueResumeNotFoundStateRef.current[output.id];
            const nextState: QueueResumeNotFoundState = current
              ? { firstSeenAtMs: current.firstSeenAtMs, retries: current.retries + 1 }
              : { firstSeenAtMs: now, retries: 1 };
            queueResumeNotFoundStateRef.current[output.id] = nextState;
            const ageMs = now - nextState.firstSeenAtMs;
            if (
              nextState.retries >= QUEUE_RESUME_NOT_FOUND_MAX_RETRIES &&
              ageMs >= QUEUE_RESUME_NOT_FOUND_MAX_AGE_MS
            ) {
              delete queueResumeNotFoundStateRef.current[output.id];
              notifyGenerationFailure(
                output.id,
                "Queued generation could not be resumed. Please retry.",
                "Generation queue status remained unresolved while waiting for dispatch."
              );
            }
            return;
          }
          delete queueResumeNotFoundStateRef.current[output.id];
        } catch {
          // Keep resume watchdog best-effort; regular queue and recovery paths remain authoritative.
        } finally {
          delete queueResumeInFlightRef.current[output.id];
        }
      })();
    });

    Object.keys(queueResumeLastCheckedAtRef.current).forEach((outputId) => {
      if (!activeQueuedIds.has(outputId) && !queueResumeInFlightRef.current[outputId]) {
        delete queueResumeLastCheckedAtRef.current[outputId];
        delete queueResumeNotFoundStateRef.current[outputId];
      }
    });
  }, [clearPollTimer, findOutputById, notifyGenerationFailure, startPollingTask, updateOutputById]);

  const runStuckSpinnerWatchdog = useCallback(() => {
    if (!isDocumentVisible()) return;
    const now = Date.now();
    const activeEligibleIds = new Set<string>();
    const outputsSnapshot = outputsRef.current;

    outputsSnapshot.forEach((output) => {
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
      if (existing.lastRetryAtMs > 0 && now - existing.lastRetryAtMs < STUCK_SPINNER_RETRY_AGE_MS) {
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
  }, [pollTimersRef, retryOutputStatus]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    runStuckSpinnerWatchdog();
    const intervalId = window.setInterval(runStuckSpinnerWatchdog, STUCK_SPINNER_RETRY_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [runStuckSpinnerWatchdog]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    runQueuedOutputResumeWatchdog();
    const intervalId = window.setInterval(
      runQueuedOutputResumeWatchdog,
      QUEUE_RESUME_SCAN_INTERVAL_MS
    );
    return () => window.clearInterval(intervalId);
  }, [runQueuedOutputResumeWatchdog]);

  return {
    submitTask,
    onReferenceOutputMediaLoaded,
    retryOutputStatus,
  };
};
