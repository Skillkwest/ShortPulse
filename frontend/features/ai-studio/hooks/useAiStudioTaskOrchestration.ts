/**
 * AI Studio task orchestration hook.
 * Owns generation polling lifecycle, status retry handling, and task-submission wiring.
 */
import { useCallback, useEffect, useRef } from "react";
import { fetchFalQueueStatus } from "../../../lib/falClient";
import { BRIA_BACKGROUND_REMOVE_MODEL_ID } from "../logic/editPromptPolicy";
import { resolveVisibleGenerationReconcile } from "../logic/generatedMediaAuthority";
import { resolveNormalizedOutputDelivery } from "../logic/referenceGridMedia";
import { normalizeProviderForPolling, type Provider } from "../logic/stateParsers";
import type { StudioOutput } from "../types";
import {
  markQueuedStatusRecoveryPending,
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

const QUEUE_RESUME_SCAN_INTERVAL_MS = 20_000;
const QUEUE_RESUME_MIN_RECHECK_MS = 12_000;
const QUEUE_RESUME_MAX_CONCURRENT = 3;
const VISIBLE_GENERATION_SCAN_INTERVAL_MS = 4_000;
const VISIBLE_GENERATION_MIN_RECHECK_MS = 2_500;
const VISIBLE_GENERATION_MAX_CONCURRENT = 3;

const isDocumentVisible = (): boolean =>
  typeof document === "undefined" || document.visibilityState === "visible";

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

const isVisibleGenerationWatchdogEligible = (output: StudioOutput): boolean => {
  if (output.mediaSource !== "generated") return false;
  if (hasSettledOutputPayload(output)) return false;
  const generationId = typeof output.generationId === "string" ? output.generationId.trim() : "";
  const taskId = typeof output.taskId === "string" ? output.taskId.trim() : "";
  return generationId.length > 0 || taskId.length > 0;
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
  const queueResumeCandidatesRef = useRef<StudioOutput[]>([]);
  const queueResumeInFlightRef = useRef<Record<string, boolean>>({});
  const queueResumeLastCheckedAtRef = useRef<Record<string, number>>({});
  const queueResumeNotFoundRetriesRef = useRef<Record<string, number>>({});
  const queueResumeSignatureRef = useRef<string>("");
  const visibleGenerationCandidatesRef = useRef<StudioOutput[]>([]);
  const visibleGenerationInFlightRef = useRef<Record<string, boolean>>({});
  const visibleGenerationLastCheckedAtRef = useRef<Record<string, number>>({});
  const visibleGenerationSignatureRef = useRef<string>("");

  useEffect(() => {
    queueResumeCandidatesRef.current = outputs.filter((output) => isQueueResumeEligible(output));
    visibleGenerationCandidatesRef.current = outputs.filter((output) =>
      isVisibleGenerationWatchdogEligible(output)
    );
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

  const runVisibleGenerationWatchdog = useCallback(() => {
    if (!isDocumentVisible()) return;
    const now = Date.now();
    const activeCandidateIds = new Set<string>();
    const outputsSnapshot = visibleGenerationCandidatesRef.current;

    let inFlightCount = Object.values(visibleGenerationInFlightRef.current).filter(Boolean).length;
    outputsSnapshot.forEach((output) => {
      const lastCheckedAt = visibleGenerationLastCheckedAtRef.current[output.id] ?? 0;
      if (now - lastCheckedAt < VISIBLE_GENERATION_MIN_RECHECK_MS) return;
      if (!isVisibleGenerationWatchdogEligible(output)) return;
      activeCandidateIds.add(output.id);
      if (inFlightCount >= VISIBLE_GENERATION_MAX_CONCURRENT) return;
      if (visibleGenerationInFlightRef.current[output.id]) return;

      const generationId = output.generationId?.trim() ?? "";
      const requestId = output.taskId?.trim() ?? "";
      if (!generationId && !requestId) return;

      visibleGenerationInFlightRef.current[output.id] = true;
      visibleGenerationLastCheckedAtRef.current[output.id] = now;
      inFlightCount += 1;

      void (async () => {
        try {
          const visibleGeneration = await resolveVisibleGenerationReconcile({
            generationId: generationId || undefined,
            requestId: requestId || undefined,
          });
          if (!visibleGeneration) return;
          if (!findOutputById(output.id)) return;
          updateOutputById(output.id, (item) => {
            const nextResultUrls =
              visibleGeneration.resultUrls.length > 0
                ? visibleGeneration.resultUrls
                : (item.resultUrls ?? []);
            const nextDelivery = resolveNormalizedOutputDelivery({
              previewStoragePath:
                visibleGeneration.previewStoragePath ?? item.previewStoragePath ?? null,
              fullStoragePath: visibleGeneration.fullStoragePath ?? item.fullStoragePath ?? null,
              previewUrl: visibleGeneration.previewUrl ?? item.previewUrl ?? null,
              resultUrls: nextResultUrls,
            });
            return {
              ...item,
              generationId: item.generationId ?? visibleGeneration.generationId,
              queueState: undefined,
              taskState: "success",
              status: "ready",
              timestamp: "Just now",
              resultUrls: nextResultUrls,
              previewUrl: visibleGeneration.previewUrl ?? item.previewUrl,
              previewStoragePath: nextDelivery.previewStoragePath,
              fullStoragePath: nextDelivery.fullStoragePath,
              mediaSource: item.mediaSource ?? "generated",
              previewTier: item.mode === "video" ? "preview_loop" : "full",
              archivedAt: null,
              archiveReason: null,
              errorMessage: null,
              errorMessageShort: null,
              errorDetail: null,
            };
          });
          const resolvedUrls =
            visibleGeneration.resultUrls.length > 0
              ? visibleGeneration.resultUrls
              : visibleGeneration.previewUrl
                ? [visibleGeneration.previewUrl]
                : [];
          if (resolvedUrls.length > 0) {
            handleGenerationSuccess({
              outputId: output.id,
              resultUrls: resolvedUrls,
            });
          }
        } catch {
          // Projection-backed settle remains best-effort; normal poll/recovery paths remain active.
        } finally {
          delete visibleGenerationInFlightRef.current[output.id];
        }
      })();
    });

    Object.keys(visibleGenerationLastCheckedAtRef.current).forEach((outputId) => {
      if (!activeCandidateIds.has(outputId) && !visibleGenerationInFlightRef.current[outputId]) {
        delete visibleGenerationLastCheckedAtRef.current[outputId];
      }
    });
  }, [findOutputById, handleGenerationSuccess, updateOutputById]);

  const { startPollingTask, clearPollTimer } = useAiStudioTasks({
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
    const activeResumeIds = new Set<string>();
    const outputsSnapshot = queueResumeCandidatesRef.current;

    let inFlightCount = Object.values(queueResumeInFlightRef.current).filter(Boolean).length;
    outputsSnapshot.forEach((output) => {
      const lastCheckedAt = queueResumeLastCheckedAtRef.current[output.id] ?? 0;
      if (now - lastCheckedAt < QUEUE_RESUME_MIN_RECHECK_MS) return;
      if (!isQueueResumeEligible(output)) return;
      activeResumeIds.add(output.id);
      if (inFlightCount >= QUEUE_RESUME_MAX_CONCURRENT) return;
      if (queueResumeInFlightRef.current[output.id]) return;
      const generationId = output.generationId?.trim() ?? "";
      const sourceRef = output.sourceRef?.trim() ?? "";
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
                queueState: undefined,
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
      if (!activeResumeIds.has(outputId) && !queueResumeInFlightRef.current[outputId]) {
        delete queueResumeLastCheckedAtRef.current[outputId];
        delete queueResumeNotFoundRetriesRef.current[outputId];
      }
    });
  }, [clearPollTimer, findOutputById, startPollingTask, updateOutputById]);

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
      .map(
        (output) =>
          `${output.id}:${output.generationId ?? ""}:${output.sourceRef ?? ""}:${output.taskId ?? ""}`
      )
      .sort()
      .join("|");
    if (queueResumeSignatureRef.current === queueResumeSignature) return;
    queueResumeSignatureRef.current = queueResumeSignature;
    if (!queueResumeSignature) return;
    runQueuedOutputResumeWatchdog();
  }, [outputs, runQueuedOutputResumeWatchdog]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    runVisibleGenerationWatchdog();
    const intervalId = window.setInterval(
      runVisibleGenerationWatchdog,
      VISIBLE_GENERATION_SCAN_INTERVAL_MS
    );
    return () => window.clearInterval(intervalId);
  }, [runVisibleGenerationWatchdog]);

  useEffect(() => {
    const visibleGenerationSignature = visibleGenerationCandidatesRef.current
      .map((output) => `${output.id}:${output.generationId ?? ""}:${output.taskId ?? ""}`)
      .sort()
      .join("|");
    if (visibleGenerationSignatureRef.current === visibleGenerationSignature) return;
    visibleGenerationSignatureRef.current = visibleGenerationSignature;
    if (!visibleGenerationSignature) return;
    runVisibleGenerationWatchdog();
  }, [outputs, runVisibleGenerationWatchdog]);

  return {
    submitTask,
    onReferenceOutputMediaLoaded,
    retryOutputStatus,
  };
};
