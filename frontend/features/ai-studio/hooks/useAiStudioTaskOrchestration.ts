/**
 * AI Studio task orchestration hook.
 * Owns generation polling lifecycle, status retry handling, and task-submission wiring.
 */
import { useCallback, useEffect, useRef } from "react";
import { fetchFalQueueStatus } from "../../../lib/falClient";
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
};

type StuckSpinnerRetryState = {
  firstSeenAtMs: number;
  lastRetryAtMs: number;
  retries: number;
};

const STUCK_SPINNER_RETRY_INTERVAL_MS = 30_000;
const STUCK_SPINNER_RETRY_AGE_MS = 90_000;
const STUCK_SPINNER_MAX_AUTO_RETRIES = 2;
const QUEUE_RESUME_SCAN_INTERVAL_MS = 20_000;
const QUEUE_RESUME_MIN_RECHECK_MS = 12_000;
const QUEUE_RESUME_MAX_CONCURRENT = 3;

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
  if (output.queueState !== "queued") return false;
  if (typeof output.taskId === "string" && output.taskId.trim().length > 0) return false;
  if (output.previewUrl || output.previewText) return false;
  if (output.taskState === "fail") return false;
  return (
    output.taskState === "pending" || output.taskState === "running" || output.taskState == null
  );
};

/**
 * Returns task submission and polling handlers used by AI Studio state orchestration.
 */
export const useAiStudioTaskOrchestration = ({
  taskSubmissionConfig,
  outputs = [],
  findOutputById,
}: UseAiStudioTaskOrchestrationParams) => {
  const { updateOutputById, notifyGenerationFailure, setUiNotice } = taskSubmissionConfig;
  const stuckSpinnerRetryStateRef = useRef<Record<string, StuckSpinnerRetryState>>({});
  const queueResumeInFlightRef = useRef<Record<string, boolean>>({});
  const queueResumeLastCheckedAtRef = useRef<Record<string, number>>({});

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

  const { startPollingTask, clearPollTimer, pollTimersRef } = useAiStudioTasks({
    updateOutputById,
    findOutputById,
    notifyGenerationFailure,
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
    const now = Date.now();
    const activeQueuedIds = new Set<string>();

    let inFlightCount = Object.values(queueResumeInFlightRef.current).filter(Boolean).length;
    outputs.forEach((output) => {
      if (!isQueueResumeEligible(output)) return;
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
            const requestId = queueStatus.requestId.trim();
            const outputProvider = (output.provider as Provider | undefined) ?? "fal";
            const provider = resolveQueuedResumeProvider({
              queueStatusProvider: queueStatus.provider,
              outputProvider,
              modelId: output.modelId ?? null,
            });
            clearPollTimer(output.id);
            updateOutputById(output.id, (item) => {
              if (item.taskId) return item;
              return {
                ...item,
                provider: item.provider ?? provider,
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
            notifyGenerationFailure(output.id, queueStatus.message, queueStatus.message);
          }
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
      }
    });
  }, [
    clearPollTimer,
    findOutputById,
    notifyGenerationFailure,
    outputs,
    startPollingTask,
    updateOutputById,
  ]);

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
