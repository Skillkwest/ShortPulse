/**
 * AI Studio task orchestration hook.
 * Owns generation polling lifecycle, status retry handling, and task-submission wiring.
 */
import { useCallback, useEffect, useRef } from "react";
import { fetchFalQueueStatus } from "../../../lib/falClient";
import { BRIA_BACKGROUND_REMOVE_MODEL_ID } from "../logic/editPromptPolicy";
import { normalizeProviderForPolling, type Provider } from "../logic/stateParsers";
import type { StudioOutput } from "../types";
import {
  markQueuedStatusRecoveryPending,
  normalizeQueuedLifecycleQueueState,
  resolveDispatchedPollingProvider,
  syncQueuedStatusLifecycle,
} from "./taskSubmission/queueStatusPolling";
import { shouldEscalateQueuedNotFoundRecovery } from "./taskSubmission/queueStatusNotFoundPolicy";
import { useAiStudioTaskSubmission } from "./useAiStudioTaskSubmission";
import { DISPATCH_HANDOFF_INITIAL_POLL_DELAY_MS, useAiStudioTasks } from "./useAiStudioTasks";

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

const STUCK_SPINNER_RETRY_INTERVAL_MS = 30_000;
const STUCK_SPINNER_RETRY_AGE_MS = 90_000;
const STUCK_SPINNER_MAX_AUTO_RETRIES = 2;
const QUEUE_RESUME_SCAN_INTERVAL_MS = 20_000;
const QUEUE_RESUME_MIN_RECHECK_MS = 12_000;
const QUEUE_RESUME_MAX_CONCURRENT = 3;

const isDocumentVisible = (): boolean =>
  typeof document === "undefined" || document.visibilityState === "visible";

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

const hasSettledOutputPayload = (output: StudioOutput): boolean => {
  if (output.status === "saved") return true;
  if (Array.isArray(output.savedMediaIds) && output.savedMediaIds.length > 0) return true;
  if (typeof output.previewText === "string" && output.previewText.trim().length > 0) return true;
  if (typeof output.previewUrl === "string" && output.previewUrl.trim().length > 0) return true;
  if (
    typeof output.previewStoragePath === "string" &&
    output.previewStoragePath.trim().length > 0
  ) {
    return true;
  }
  if (typeof output.fullStoragePath === "string" && output.fullStoragePath.trim().length > 0) {
    return true;
  }
  return (output.resultUrls ?? []).some((url) => typeof url === "string" && url.trim().length > 0);
};
const isQueueResumeEligible = (output: StudioOutput): boolean => {
  const generationId = typeof output.generationId === "string" ? output.generationId.trim() : "";
  const sourceRef = typeof output.sourceRef === "string" ? output.sourceRef.trim() : "";
  if (!generationId && !sourceRef) return false;
  // Resume should still run when queue metadata was dropped or partially persisted
  // (for example queueState=dispatched without a taskId after restore).
  if (
    output.queueState &&
    output.queueState !== "queued" &&
    output.queueState !== "dispatching" &&
    output.queueState !== "dispatched"
  ) {
    return false;
  }
  if (typeof output.taskId === "string" && output.taskId.trim().length > 0) return false;
  return !hasSettledOutputPayload(output);
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
  const queueResumeNotFoundRetriesRef = useRef<Record<string, number>>({});
  const queueResumeSignatureRef = useRef<string>("");

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
      activeQueuedIds.add(output.id);
      if (inFlightCount >= QUEUE_RESUME_MAX_CONCURRENT) return;
      if (queueResumeInFlightRef.current[output.id]) return;
      const lastCheckedAt = queueResumeLastCheckedAtRef.current[output.id] ?? 0;
      if (now - lastCheckedAt < QUEUE_RESUME_MIN_RECHECK_MS) return;
      const generationId = output.generationId?.trim();
      const sourceRef = output.sourceRef?.trim();
      if (!generationId && !sourceRef) return;

      queueResumeInFlightRef.current[output.id] = true;
      queueResumeLastCheckedAtRef.current[output.id] = now;
      inFlightCount += 1;

      void (async () => {
        try {
          const queueStatus = await fetchFalQueueStatus({
            generationId: generationId || undefined,
            sourceRef: sourceRef || undefined,
          });
          if (!findOutputById(output.id)) return;
          if (queueStatus.status === "dispatched") {
            delete queueResumeNotFoundRetriesRef.current[output.id];
            const lifecycle = queueStatus.shortpulseLifecycle;
            const requestId = queueStatus.requestId.trim();
            const outputProvider = (output.provider as Provider | undefined) ?? "fal";
            const resumeProviderHint =
              typeof output.modelId === "string" && output.modelId.trim().length > 0
                ? normalizeProviderForPolling(output.modelId, outputProvider)
                : outputProvider;
            const provider = resolveDispatchedPollingProvider({
              pollingProvider: queueStatus.pollingProvider,
              queueStatusProvider: queueStatus.provider,
              queueStatusModelId: queueStatus.modelId ?? output.modelId ?? null,
              submitProvider: resumeProviderHint,
            });
            clearPollTimer(output.id);
            updateOutputById(output.id, (item) => {
              if (item.taskId && item.generationId) return item;
              return {
                ...item,
                provider: item.provider ?? provider,
                sourceRef:
                  item.sourceRef ??
                  (typeof queueStatus.sourceRef === "string" &&
                  queueStatus.sourceRef.trim().length > 0
                    ? queueStatus.sourceRef.trim()
                    : item.sourceRef),
                generationId:
                  item.generationId ??
                  (typeof queueStatus.generationId === "string" &&
                  queueStatus.generationId.trim().length > 0
                    ? queueStatus.generationId.trim()
                    : item.generationId),
                taskId: requestId,
                generationTraceId: requestId,
                queueState: normalizeQueuedLifecycleQueueState(lifecycle?.queueState, "dispatched"),
                taskState: lifecycle?.taskState ?? "running",
                status: "ready",
                timestamp: lifecycle?.statusLabel ?? "Submitted",
                errorMessage: null,
                errorMessageShort: null,
                errorDetail: null,
              };
            });
            startPollingTask(requestId, output.id, 0, provider, Date.now(), 0, undefined, {
              initialDelayMs: DISPATCH_HANDOFF_INITIAL_POLL_DELAY_MS,
            });
            return;
          }
          if (queueStatus.status === "queued" || queueStatus.status === "dispatching") {
            delete queueResumeNotFoundRetriesRef.current[output.id];
            syncQueuedStatusLifecycle({
              outputId: output.id,
              queueStatus,
              updateOutputById,
            });
            return;
          }
          if (queueStatus.status === "failed") {
            delete queueResumeNotFoundRetriesRef.current[output.id];
            markQueuedStatusRecoveryPending({
              outputId: output.id,
              updateOutputById,
            });
            return;
          }
          if (queueStatus.status === "not_found") {
            const notFoundRetries = (queueResumeNotFoundRetriesRef.current[output.id] ?? 0) + 1;
            queueResumeNotFoundRetriesRef.current[output.id] = notFoundRetries;
            if (
              shouldEscalateQueuedNotFoundRecovery({
                notFoundRetries,
                queueEnqueuedAtMs: output.queueEnqueuedAtMs,
                nowMs: Date.now(),
              })
            ) {
              markQueuedStatusRecoveryPending({
                outputId: output.id,
                updateOutputById,
              });
            }
            return;
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
        delete queueResumeNotFoundRetriesRef.current[outputId];
      }
    });
  }, [clearPollTimer, findOutputById, startPollingTask, updateOutputById]);

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

  useEffect(() => {
    const queueResumeSignature = queueResumeCandidatesRef.current
      .map((output) => `${output.id}:${output.generationId ?? ""}:${output.sourceRef ?? ""}`)
      .sort()
      .join("|");
    if (queueResumeSignatureRef.current === queueResumeSignature) return;
    queueResumeSignatureRef.current = queueResumeSignature;
    if (!queueResumeSignature) return;
    runQueuedOutputResumeWatchdog();
  }, [outputs, runQueuedOutputResumeWatchdog]);

  return {
    submitTask,
    onReferenceOutputMediaLoaded,
    retryOutputStatus,
  };
};
