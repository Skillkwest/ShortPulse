/**
 * AI Studio task orchestration hook.
 * Owns generation polling lifecycle, status retry handling, and task-submission wiring.
 */
import { useCallback, useEffect, useRef } from "react";
import { type Provider } from "../logic/stateParsers";
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
}: UseAiStudioTaskOrchestrationParams) => {
  const { updateOutputById, notifyGenerationFailure, setUiNotice } = taskSubmissionConfig;
  const stuckSpinnerRetryStateRef = useRef<Record<string, StuckSpinnerRetryState>>({});

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
