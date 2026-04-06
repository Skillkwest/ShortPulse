/**
 * Side-effectful task runner for AI Studio generations.
 * Handles submit + polling orchestration per provider, isolated from UI state.
 */
import { startTransition, useCallback, useEffect, useRef } from "react";
import {
  fetchKieKlingImageToVideoStatus,
  fetchKieSeedance2FastVideoStatus,
  fetchKieSeedance2VideoStatus,
  fetchKieSeedanceVideoStatus,
  fetchKieVeoImageToVideoStatus,
  fetchFalBriaBackgroundRemoveStatus,
  fetchFalFlux2ProStatus,
  fetchFalFluxProFillStatus,
  fetchFalFlux2Status,
  fetchFalFlux2KleinStatus,
  fetchFalFlux2EditStatus,
  fetchFalFlux2ProEditStatus,
  fetchFalKlingStatus,
  fetchFalKlingV3ImageToVideoStatus,
  fetchFalNanoBananaStatus,
  fetchFalNanoBananaEditStatus,
  fetchFalNanoBanana2Status,
  fetchFalNanoBanana2EditStatus,
  fetchFalNanoBananaProStatus,
  fetchFalNanoBananaProEditStatus,
  fetchFalStatus,
  fetchFalSeedanceStatus,
  fetchFalSeedanceI2VStatus,
  fetchFalSeedreamStatus,
  fetchFalVeoStatus,
  fetchFalVeoImageToVideoStatus,
} from "../../../lib/falClient";
import { addBreadcrumb } from "../../../lib/clientBreadcrumbs";
import {
  PERF_FLAG_RAF_STATUS_FLUSH,
  PERF_FLAG_REFERENCE_GRID_UPDATE_BACKPRESSURE,
} from "../logic/perfProfileFlags";
import { resolveNormalizedOutputDelivery } from "../logic/referenceGridMedia";
import { Provider } from "../logic/stateParsers";
import { StudioOutput } from "../types";
import {
  evaluateOutputLookupMiss,
  OUTPUT_LOOKUP_MISS_HARD_STOP_MS,
} from "./taskPolling/outputLookupPolicy";
import {
  getPollDelayMs,
  getPollMaxWaitMs,
  getStatusConcurrencyRetryDelayMs,
  isStatusErrorRetryBudgetExhausted,
  MAX_CONCURRENT_STATUS_REQUESTS,
} from "./taskPolling/pollingSchedulePolicy";
import {
  condenseError,
  createShortErrorMessage,
  looksLikeFailureMessage,
  type PollStatus,
  type ShortPulseLifecycleHint,
  readShortPulseLifecycleHint,
  resolvePollStatusGenerationId,
  resolveProviderStatusState,
  terminalSuccessStates,
  terminalFailureStates,
} from "./taskPolling/providerStatusPolicy";
import { useAiStudioTaskRecoveryController } from "./taskPolling/useAiStudioTaskRecoveryController";
import {
  incrementFreezeInvestigationCounter,
  setFreezeInvestigationGauge,
} from "../logic/freezeInvestigationTelemetry";

type GenerationFailureReason =
  | "no_media_after_terminal_success"
  | "poll_timeout"
  | "provider_error"
  | "status_poll_error";

type OutputLookupHardStopPayload = {
  outputId: string;
  taskId: string;
  provider: Provider;
  lookupMisses: number;
  missingDurationMs: number;
};

type GenerationFailureContext = {
  reasonCode?: GenerationFailureReason;
  providerState?: string | null;
  pollAttempt?: number;
  noMediaAttempt?: number;
  elapsedMs?: number;
  maxWaitMs?: number;
};

type TaskCallbacks = {
  updateOutputById: (id: string, updater: (item: StudioOutput) => StudioOutput) => void;
  findOutputById?: (id: string) => StudioOutput | null;
  notifyGenerationFailure: (
    outputId: string,
    message: string,
    detail?: string,
    context?: GenerationFailureContext
  ) => void;
  onGenerationSuccess?: (payload: {
    outputId: string;
    taskId: string;
    provider: Provider;
    resultUrls: string[];
  }) => void;
  onGenerationFailure?: (payload: {
    outputId: string;
    taskId?: string;
    provider: Provider;
    message: string;
    reasonCode?: GenerationFailureReason;
  }) => void;
  onPollingOutputLookupHardStop?: (payload: OutputLookupHardStopPayload) => void;
};

const REFERENCE_GRID_FLAG_UPDATE_BACKPRESSURE = PERF_FLAG_REFERENCE_GRID_UPDATE_BACKPRESSURE;
const AI_STUDIO_FLAG_RAF_STATUS_FLUSH = PERF_FLAG_RAF_STATUS_FLUSH;
const OUTPUT_PROGRESS_UPDATE_MIN_INTERVAL_MS = 700;
const HIDDEN_TAB_STATUS_POLL_RETRY_MS = 15_000;
const SERVER_RECOVERY_PENDING_TIMESTAMP = "Waiting for server recovery...";
export const DISPATCH_HANDOFF_INITIAL_POLL_DELAY_MS = 250;

const isDocumentVisible = (): boolean =>
  typeof document === "undefined" || document.visibilityState === "visible";
const resolveHiddenTabStatusRetryDelayMs = (attempt: number): number =>
  Math.max(HIDDEN_TAB_STATUS_POLL_RETRY_MS, getPollDelayMs(attempt));

type QueuedOutputUpdate = {
  updater: (item: StudioOutput) => StudioOutput;
  nonUrgent: boolean;
};

type StartPollingTaskOptions = {
  initialDelayMs?: number;
};

const areStringArraysEqual = (left: string[] | undefined, right: string[]) => {
  if (!left) return right.length === 0;
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
};

const resolveLifecycleTaskState = (
  lifecycleHint: ShortPulseLifecycleHint | null
): StudioOutput["taskState"] | null => {
  switch (lifecycleHint?.taskState) {
    case "pending":
    case "running":
    case "success":
    case "fail":
      return lifecycleHint.taskState;
    default:
      return null;
  }
};

const stringifyLifecycleErrorDetail = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  if (value == null) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const normalizeLifecycleQueueState = (
  queueState: string | null | undefined
): StudioOutput["queueState"] => {
  switch (queueState) {
    case "queued":
      return "queued";
    case "dispatching":
      return "dispatching";
    case "dispatched":
      return "dispatched";
    default:
      return undefined;
  }
};

const fetchStatusByProvider = async (provider: Provider, taskId: string) => {
  switch (provider) {
    case "fal":
      return fetchFalStatus(taskId);
    case "fal-flux2":
      return fetchFalFlux2Status(taskId);
    case "fal-flux2-klein":
      return fetchFalFlux2KleinStatus(taskId);
    case "fal-flux-pro-fill":
      return fetchFalFluxProFillStatus(taskId);
    case "fal-bria-background-remove":
      return fetchFalBriaBackgroundRemoveStatus(taskId);
    case "fal-flux2-edit":
      return fetchFalFlux2EditStatus(taskId);
    case "fal-flux2-pro":
      return fetchFalFlux2ProStatus(taskId);
    case "fal-flux2-pro-edit":
      return fetchFalFlux2ProEditStatus(taskId);
    case "fal-kling":
      return fetchFalKlingStatus(taskId);
    case "fal-kling-3":
      return fetchFalKlingV3ImageToVideoStatus(taskId);
    case "fal-seedance":
      return fetchFalSeedanceStatus(taskId);
    case "fal-seedance-i2v":
      return fetchFalSeedanceI2VStatus(taskId);
    case "fal-seedream":
      return fetchFalSeedreamStatus(taskId);
    case "fal-veo":
      return fetchFalVeoStatus(taskId);
    case "fal-veo-i2v":
      return fetchFalVeoImageToVideoStatus(taskId);
    case "fal-nano-banana":
      return fetchFalNanoBananaStatus(taskId);
    case "fal-nano-banana-edit":
      return fetchFalNanoBananaEditStatus(taskId);
    case "fal-nano-banana-2":
      return fetchFalNanoBanana2Status(taskId);
    case "fal-nano-banana-2-edit":
      return fetchFalNanoBanana2EditStatus(taskId);
    case "fal-nano-banana-pro":
      return fetchFalNanoBananaProStatus(taskId);
    case "fal-nano-banana-pro-edit":
      return fetchFalNanoBananaProEditStatus(taskId);
    case "kie-veo":
      return fetchKieVeoImageToVideoStatus(taskId);
    case "kie-kling":
      return fetchKieKlingImageToVideoStatus(taskId);
    case "kie-seedance":
      return fetchKieSeedanceVideoStatus(taskId);
    case "kie-seedance-2":
      return fetchKieSeedance2VideoStatus(taskId);
    case "kie-seedance-2-fast":
      return fetchKieSeedance2FastVideoStatus(taskId);
    default:
      return fetchFalStatus(taskId);
  }
};

export function useAiStudioTasks({
  updateOutputById,
  findOutputById,
  notifyGenerationFailure,
  onGenerationSuccess,
  onGenerationFailure,
  onPollingOutputLookupHardStop,
}: TaskCallbacks) {
  const pollTimersRef = useRef<Record<string, number>>({});
  const pollSessionsRef = useRef<Record<string, number>>({});
  const statusRequestsInFlightRef = useRef(0);
  const lastProgressUpdateAtRef = useRef<Record<string, number>>({});
  const lastProgressSignatureRef = useRef<Record<string, string>>({});
  const recoveryStateRefsRef = useRef<{
    outputLookupHardStopNotifiedRef?: React.MutableRefObject<Record<string, boolean>>;
    outputLookupMissesRef?: React.MutableRefObject<Record<string, number>>;
    outputLookupMissingSinceRef?: React.MutableRefObject<Record<string, number>>;
  }>({});
  const queuedOutputUpdatersRef = useRef<Record<string, QueuedOutputUpdate[]>>({});
  const queuedOutputFlushPendingRef = useRef(false);
  const queuedOutputFlushRafIdRef = useRef<number | null>(null);

  const flushQueuedOutputUpdates = useCallback(() => {
    incrementFreezeInvestigationCounter("aiStudioTasks.flushQueuedOutputUpdates");
    const queued = queuedOutputUpdatersRef.current;
    queuedOutputUpdatersRef.current = {};
    setFreezeInvestigationGauge("aiStudioTasks.flushBatchOutputCount", Object.keys(queued).length);
    Object.entries(queued).forEach(([outputId, queuedUpdates]) => {
      if (!queuedUpdates.length) return;
      const applyUpdate = () => {
        updateOutputById(outputId, (item) => {
          return queuedUpdates.reduce((current, entry) => entry.updater(current), item);
        });
      };
      const isNonUrgentBatch = queuedUpdates.every((entry) => entry.nonUrgent);
      if (isNonUrgentBatch) {
        startTransition(applyUpdate);
        return;
      }
      applyUpdate();
    });
  }, [updateOutputById]);

  const queueOutputUpdate = useCallback(
    (
      outputId: string,
      updater: (item: StudioOutput) => StudioOutput,
      options?: { nonUrgent?: boolean }
    ) => {
      incrementFreezeInvestigationCounter("aiStudioTasks.queueOutputUpdate");
      const nonUrgent = options?.nonUrgent === true;
      if (!REFERENCE_GRID_FLAG_UPDATE_BACKPRESSURE) {
        if (nonUrgent) {
          startTransition(() => {
            updateOutputById(outputId, updater);
          });
        } else {
          updateOutputById(outputId, updater);
        }
        return;
      }
      const existing = queuedOutputUpdatersRef.current[outputId] ?? [];
      existing.push({ updater, nonUrgent });
      queuedOutputUpdatersRef.current[outputId] = existing;
      setFreezeInvestigationGauge(
        "aiStudioTasks.queuedOutputIds",
        Object.keys(queuedOutputUpdatersRef.current).length
      );
      if (queuedOutputFlushPendingRef.current) return;
      queuedOutputFlushPendingRef.current = true;
      const flush = () => {
        queuedOutputFlushPendingRef.current = false;
        if (queuedOutputFlushRafIdRef.current != null) {
          window.cancelAnimationFrame(queuedOutputFlushRafIdRef.current);
          queuedOutputFlushRafIdRef.current = null;
        }
        flushQueuedOutputUpdates();
      };
      if (
        AI_STUDIO_FLAG_RAF_STATUS_FLUSH &&
        typeof window !== "undefined" &&
        typeof window.requestAnimationFrame === "function"
      ) {
        queuedOutputFlushRafIdRef.current = window.requestAnimationFrame(() => {
          flush();
        });
        return;
      }
      if (typeof queueMicrotask === "function") {
        queueMicrotask(flush);
        return;
      }
      Promise.resolve().then(flush);
    },
    [flushQueuedOutputUpdates, updateOutputById]
  );

  const clearPollTimer = useCallback(
    (outputId: string) => {
      const recoveryStateRefs = recoveryStateRefsRef.current;
      pollSessionsRef.current[outputId] = (pollSessionsRef.current[outputId] ?? 0) + 1;
      const timeoutId = pollTimersRef.current[outputId];
      if (timeoutId) {
        window.clearTimeout(timeoutId);
        delete pollTimersRef.current[outputId];
      }
      const pendingUpdaters = queuedOutputUpdatersRef.current[outputId];
      if (pendingUpdaters?.length) {
        delete queuedOutputUpdatersRef.current[outputId];
        updateOutputById(outputId, (item) => {
          return pendingUpdaters.reduce((current, entry) => entry.updater(current), item);
        });
      }
      delete lastProgressUpdateAtRef.current[outputId];
      delete lastProgressSignatureRef.current[outputId];
      delete recoveryStateRefs.outputLookupMissesRef?.current[outputId];
      delete recoveryStateRefs.outputLookupMissingSinceRef?.current[outputId];
      delete recoveryStateRefs.outputLookupHardStopNotifiedRef?.current[outputId];
    },
    [updateOutputById]
  );

  const {
    clearRecoveryTimer,
    handleOutputLookupHardStop,
    outputLookupHardStopNotifiedRef,
    outputLookupMissesRef,
    outputLookupMissingSinceRef,
    resetRecoveryState,
    scheduleBackgroundRecovery,
  } = useAiStudioTaskRecoveryController({
    clearPollTimer,
    fetchStatusByProvider,
    onGenerationSuccess,
    onPollingOutputLookupHardStop,
    queueOutputUpdate,
  });
  recoveryStateRefsRef.current = {
    outputLookupHardStopNotifiedRef,
    outputLookupMissesRef,
    outputLookupMissingSinceRef,
  };

  const startPollingTask = useCallback(
    function pollTask(
      taskId: string,
      outputId: string,
      attempt = 0,
      provider: Provider = "fal",
      startedAt = Date.now(),
      noMediaAttempt = 0,
      pollSessionId?: number,
      options?: StartPollingTaskOptions
    ) {
      incrementFreezeInvestigationCounter("aiStudioTasks.startPollingTask.calls");
      setFreezeInvestigationGauge(
        "aiStudioTasks.statusRequestsInFlight",
        statusRequestsInFlightRef.current
      );
      let activePollSessionId = pollSessionId;
      if (activePollSessionId == null) {
        activePollSessionId = (pollSessionsRef.current[outputId] ?? 0) + 1;
        pollSessionsRef.current[outputId] = activePollSessionId;
      }

      if ((pollSessionsRef.current[outputId] ?? 0) !== activePollSessionId) {
        return;
      }
      if (!isDocumentVisible()) {
        const hiddenRetryDelayMs = resolveHiddenTabStatusRetryDelayMs(attempt);
        pollTimersRef.current[outputId] = window.setTimeout(
          () =>
            pollTask(
              taskId,
              outputId,
              attempt,
              provider,
              startedAt + hiddenRetryDelayMs,
              noMediaAttempt,
              activePollSessionId,
              options
            ),
          hiddenRetryDelayMs
        );
        return;
      }

      if (findOutputById && !findOutputById(outputId)) {
        const lookupPolicy = evaluateOutputLookupMiss({
          currentMisses: outputLookupMissesRef.current[outputId] ?? 0,
          missingSinceMs: outputLookupMissingSinceRef.current[outputId],
          nowMs: Date.now(),
        });
        outputLookupMissesRef.current[outputId] = lookupPolicy.lookupMisses;
        outputLookupMissingSinceRef.current[outputId] = lookupPolicy.missingSinceMs;
        if (lookupPolicy.shouldHardStop) {
          handleOutputLookupHardStop({
            outputId,
            taskId,
            provider,
            lookupMisses: lookupPolicy.lookupMisses,
            missingDurationMs: lookupPolicy.missingDurationMs,
          });
          return;
        }
        if (lookupPolicy.shouldEmitRetryingBreadcrumb) {
          addBreadcrumb({
            type: "ui",
            level: "warn",
            message: "generation_poll_output_lookup_retrying",
            data: {
              provider,
              task_id: taskId,
              output_id: outputId,
              lookup_misses: lookupPolicy.lookupMisses,
              missing_duration_ms: lookupPolicy.missingDurationMs,
              hard_stop_after_ms: OUTPUT_LOOKUP_MISS_HARD_STOP_MS,
            },
          });
        }
        pollTimersRef.current[outputId] = window.setTimeout(
          () =>
            pollTask(
              taskId,
              outputId,
              attempt,
              provider,
              startedAt,
              noMediaAttempt,
              activePollSessionId,
              options
            ),
          lookupPolicy.retryDelayMs
        );
        return;
      }
      delete outputLookupMissesRef.current[outputId];
      delete outputLookupMissingSinceRef.current[outputId];
      delete outputLookupHardStopNotifiedRef.current[outputId];

      if (attempt === 0 && noMediaAttempt === 0) {
        const existingTimeoutId = pollTimersRef.current[outputId];
        if (existingTimeoutId) {
          window.clearTimeout(existingTimeoutId);
          delete pollTimersRef.current[outputId];
        }
        clearRecoveryTimer(outputId);
      }

      const elapsedMs = Date.now() - startedAt;
      const maxWaitMs = getPollMaxWaitMs(provider);
      if (elapsedMs > maxWaitMs) {
        addBreadcrumb({
          type: "ui",
          level: "warn",
          message: "generation_poll_timeout",
          data: {
            provider,
            task_id: taskId,
            output_id: outputId,
            poll_attempt: attempt,
            elapsed_ms: elapsedMs,
            max_wait_ms: maxWaitMs,
          },
        });
        queueOutputUpdate(outputId, (item) => ({
          ...item,
          taskState: item.taskState === "running" ? item.taskState : "running",
          status: item.status === "ready" ? item.status : "ready",
          timestamp:
            item.timestamp === SERVER_RECOVERY_PENDING_TIMESTAMP
              ? item.timestamp
              : SERVER_RECOVERY_PENDING_TIMESTAMP,
          errorMessage: null,
          errorMessageShort: null,
          errorDetail: null,
        }));
        scheduleBackgroundRecovery(taskId, outputId, provider, "poll_timeout");
        clearPollTimer(outputId);
        return;
      }

      const delay =
        attempt === 0 && typeof options?.initialDelayMs === "number"
          ? options.initialDelayMs
          : getPollDelayMs(attempt);
      const timeoutId = window.setTimeout(async () => {
        if ((pollSessionsRef.current[outputId] ?? 0) !== activePollSessionId) {
          return;
        }
        if (!isDocumentVisible()) {
          const hiddenRetryDelayMs = resolveHiddenTabStatusRetryDelayMs(attempt);
          pollTimersRef.current[outputId] = window.setTimeout(
            () =>
              pollTask(
                taskId,
                outputId,
                attempt,
                provider,
                startedAt + hiddenRetryDelayMs,
                noMediaAttempt,
                activePollSessionId,
                options
              ),
            hiddenRetryDelayMs
          );
          return;
        }
        if (statusRequestsInFlightRef.current >= MAX_CONCURRENT_STATUS_REQUESTS) {
          pollTimersRef.current[outputId] = window.setTimeout(
            () =>
              pollTask(
                taskId,
                outputId,
                attempt,
                provider,
                startedAt,
                noMediaAttempt,
                activePollSessionId,
                options
              ),
            getStatusConcurrencyRetryDelayMs(delay)
          );
          return;
        }
        statusRequestsInFlightRef.current += 1;
        setFreezeInvestigationGauge(
          "aiStudioTasks.statusRequestsInFlight",
          statusRequestsInFlightRef.current
        );
        try {
          try {
            if (findOutputById && !findOutputById(outputId)) {
              const lookupPolicy = evaluateOutputLookupMiss({
                currentMisses: outputLookupMissesRef.current[outputId] ?? 0,
                missingSinceMs: outputLookupMissingSinceRef.current[outputId],
                nowMs: Date.now(),
              });
              outputLookupMissesRef.current[outputId] = lookupPolicy.lookupMisses;
              outputLookupMissingSinceRef.current[outputId] = lookupPolicy.missingSinceMs;
              if (lookupPolicy.shouldHardStop) {
                handleOutputLookupHardStop({
                  outputId,
                  taskId,
                  provider,
                  lookupMisses: lookupPolicy.lookupMisses,
                  missingDurationMs: lookupPolicy.missingDurationMs,
                });
                return;
              }
              if (lookupPolicy.shouldEmitRetryingBreadcrumb) {
                addBreadcrumb({
                  type: "ui",
                  level: "warn",
                  message: "generation_poll_output_lookup_retrying",
                  data: {
                    provider,
                    task_id: taskId,
                    output_id: outputId,
                    lookup_misses: lookupPolicy.lookupMisses,
                    missing_duration_ms: lookupPolicy.missingDurationMs,
                    hard_stop_after_ms: OUTPUT_LOOKUP_MISS_HARD_STOP_MS,
                  },
                });
              }
              pollTimersRef.current[outputId] = window.setTimeout(
                () =>
                  pollTask(
                    taskId,
                    outputId,
                    attempt,
                    provider,
                    startedAt,
                    noMediaAttempt,
                    activePollSessionId,
                    options
                  ),
                lookupPolicy.retryDelayMs
              );
              return;
            }
            delete outputLookupMissesRef.current[outputId];
            delete outputLookupMissingSinceRef.current[outputId];
            delete outputLookupHardStopNotifiedRef.current[outputId];

            const status = (await fetchStatusByProvider(provider, taskId)) as PollStatus;
            const statusGenerationId = resolvePollStatusGenerationId(status);
            const lifecycleHint = readShortPulseLifecycleHint(status);
            if (statusGenerationId) {
              queueOutputUpdate(
                outputId,
                (item) => {
                  if (
                    typeof item.generationId === "string" &&
                    item.generationId.trim().length > 0
                  ) {
                    return item;
                  }
                  return {
                    ...item,
                    generationId: statusGenerationId,
                  };
                },
                { nonUrgent: true }
              );
            }
            const lifecycleResultUrls = lifecycleHint?.resultUrls ?? [];
            const lifecycleTaskState = resolveLifecycleTaskState(lifecycleHint);
            const lifecycleStatusLabel =
              lifecycleHint?.statusLabel?.trim() ||
              (lifecycleHint?.recoveryPending ? SERVER_RECOVERY_PENDING_TIMESTAMP : null);
            if (lifecycleTaskState === "success") {
              if (lifecycleResultUrls.length === 0) {
                addBreadcrumb({
                  type: "ui",
                  level: "warn",
                  message: "generation_terminal_no_media_exhausted",
                  data: {
                    provider,
                    task_id: taskId,
                    output_id: outputId,
                    status_state: lifecycleHint?.providerState ?? "success",
                    no_media_attempts: noMediaAttempt,
                  },
                });
                queueOutputUpdate(outputId, (item) => ({
                  ...item,
                  queueState:
                    normalizeLifecycleQueueState(lifecycleHint?.queueState) ?? item.queueState,
                  status: item.status === "ready" ? item.status : "ready",
                  taskState: item.taskState === "running" ? item.taskState : "running",
                  timestamp:
                    item.timestamp === SERVER_RECOVERY_PENDING_TIMESTAMP
                      ? item.timestamp
                      : SERVER_RECOVERY_PENDING_TIMESTAMP,
                  errorMessage: null,
                  errorMessageShort: null,
                  errorDetail: null,
                }));
                scheduleBackgroundRecovery(
                  taskId,
                  outputId,
                  provider,
                  "no_media_after_terminal_success"
                );
                clearPollTimer(outputId);
                return;
              }

              const resolvedUrls = lifecycleResultUrls;

              queueOutputUpdate(outputId, (item) => {
                const nextDelivery = resolveNormalizedOutputDelivery({
                  previewStoragePath: item.previewStoragePath ?? null,
                  fullStoragePath: item.fullStoragePath ?? null,
                  previewUrl: resolvedUrls[0] ?? item.previewUrl ?? null,
                  resultUrls: resolvedUrls,
                });
                return {
                  ...item,
                  queueState:
                    normalizeLifecycleQueueState(lifecycleHint?.queueState) ?? item.queueState,
                  taskState: item.taskState === "success" ? item.taskState : "success",
                  status: item.status === "ready" ? item.status : "ready",
                  timestamp:
                    item.timestamp === (lifecycleStatusLabel ?? "Just now")
                      ? item.timestamp
                      : (lifecycleStatusLabel ?? "Just now"),
                  resultUrls: areStringArraysEqual(item.resultUrls, resolvedUrls)
                    ? item.resultUrls
                    : resolvedUrls,
                  previewUrl:
                    item.previewUrl === (resolvedUrls[0] ?? item.previewUrl)
                      ? item.previewUrl
                      : (resolvedUrls[0] ?? item.previewUrl),
                  previewStoragePath:
                    item.previewStoragePath === nextDelivery.previewStoragePath
                      ? item.previewStoragePath
                      : nextDelivery.previewStoragePath,
                  fullStoragePath:
                    item.fullStoragePath === nextDelivery.fullStoragePath
                      ? item.fullStoragePath
                      : nextDelivery.fullStoragePath,
                  mediaSource: item.mediaSource ?? "generated",
                  previewTier: item.mode === "video" ? "preview_loop" : "full",
                  archivedAt: null,
                  archiveReason: null,
                  errorMessage: item.errorMessage == null ? item.errorMessage : null,
                  errorMessageShort: item.errorMessageShort == null ? item.errorMessageShort : null,
                  errorDetail: item.errorDetail == null ? item.errorDetail : null,
                };
              });
              if (onGenerationSuccess) {
                onGenerationSuccess({
                  outputId,
                  taskId,
                  provider,
                  resultUrls: resolvedUrls,
                });
              }
              clearRecoveryTimer(outputId);
              clearPollTimer(outputId);
              return;
            }

            if (lifecycleTaskState === "fail") {
              const failureDetail =
                stringifyLifecycleErrorDetail(lifecycleHint?.errorDetail) ??
                lifecycleHint?.errorMessage?.trim() ??
                "Generation failed";
              const failureMessage =
                typeof lifecycleHint?.errorMessage === "string" &&
                lifecycleHint.errorMessage.trim().length > 0
                  ? lifecycleHint.errorMessage.trim()
                  : condenseError(failureDetail);
              const safeFailureMessage =
                typeof lifecycleHint?.errorMessage === "string" &&
                lifecycleHint.errorMessage.trim().length > 0
                  ? lifecycleHint.errorMessage.trim()
                  : looksLikeFailureMessage(failureMessage)
                    ? failureMessage
                    : "Generation failed";
              const safeFailureDetail = looksLikeFailureMessage(failureDetail)
                ? failureDetail
                : safeFailureMessage;
              const shortMessage = createShortErrorMessage(safeFailureMessage);

              notifyGenerationFailure(outputId, safeFailureMessage, safeFailureDetail, {
                reasonCode: "provider_error",
                providerState: lifecycleHint?.providerState,
                pollAttempt: attempt,
                elapsedMs: Date.now() - startedAt,
                maxWaitMs,
              });
              queueOutputUpdate(outputId, (item) => ({
                ...item,
                queueState:
                  normalizeLifecycleQueueState(lifecycleHint?.queueState) ?? item.queueState,
                status: item.status === "ready" ? item.status : "ready",
                taskState: item.taskState === "fail" ? item.taskState : "fail",
                timestamp: lifecycleStatusLabel ?? item.timestamp,
                errorMessage:
                  item.errorMessage === safeFailureMessage ? item.errorMessage : safeFailureMessage,
                errorMessageShort:
                  item.errorMessageShort === shortMessage ? item.errorMessageShort : shortMessage,
                errorDetail:
                  item.errorDetail === safeFailureDetail ? item.errorDetail : safeFailureDetail,
              }));
              if (onGenerationFailure) {
                onGenerationFailure({
                  outputId,
                  taskId,
                  provider,
                  message: safeFailureDetail,
                  reasonCode: "provider_error",
                });
              }
              clearPollTimer(outputId);
              return;
            }

            if (lifecycleTaskState === "pending" || lifecycleTaskState === "running") {
              const nextTaskState = lifecycleTaskState;
              const now = Date.now();
              const lastProgressUpdateAt = lastProgressUpdateAtRef.current[outputId] ?? 0;
              const nextTimestamp = lifecycleStatusLabel ?? "Processing...";
              const nextProgressSignature = `${nextTaskState}|${nextTimestamp}`;
              const shouldSkipProgressUpdate =
                lastProgressSignatureRef.current[outputId] === nextProgressSignature ||
                (REFERENCE_GRID_FLAG_UPDATE_BACKPRESSURE &&
                  nextTaskState === "running" &&
                  now - lastProgressUpdateAt < OUTPUT_PROGRESS_UPDATE_MIN_INTERVAL_MS);
              if (!shouldSkipProgressUpdate) {
                queueOutputUpdate(
                  outputId,
                  (item) => {
                    const queueStateChanged =
                      (normalizeLifecycleQueueState(lifecycleHint?.queueState) ??
                        item.queueState) !== item.queueState;
                    const taskStateChanged = item.taskState !== nextTaskState;
                    const timestampChanged = item.timestamp !== nextTimestamp;
                    if (!queueStateChanged && !taskStateChanged && !timestampChanged) return item;
                    lastProgressUpdateAtRef.current[outputId] = now;
                    lastProgressSignatureRef.current[outputId] = nextProgressSignature;
                    return {
                      ...item,
                      queueState:
                        normalizeLifecycleQueueState(lifecycleHint?.queueState) ?? item.queueState,
                      taskState: nextTaskState,
                      status: item.status === "ready" ? item.status : "ready",
                      timestamp: nextTimestamp,
                      errorMessage: lifecycleHint?.recoveryPending ? null : item.errorMessage,
                      errorMessageShort: lifecycleHint?.recoveryPending
                        ? null
                        : item.errorMessageShort,
                      errorDetail: lifecycleHint?.recoveryPending ? null : item.errorDetail,
                    };
                  },
                  { nonUrgent: lifecycleHint?.recoveryPending !== true }
                );
              }
              pollTimersRef.current[outputId] = window.setTimeout(
                () =>
                  pollTask(
                    taskId,
                    outputId,
                    attempt + 1,
                    provider,
                    startedAt,
                    0,
                    activePollSessionId,
                    options
                  ),
                delay
              );
              return;
            }

            if (lifecycleHint) {
              const nextTaskState = "running";
              const now = Date.now();
              const lastProgressUpdateAt = lastProgressUpdateAtRef.current[outputId] ?? 0;
              const nextTimestamp = lifecycleStatusLabel ?? "Processing...";
              const nextProgressSignature = `${nextTaskState}|${nextTimestamp}`;
              const shouldSkipProgressUpdate =
                lastProgressSignatureRef.current[outputId] === nextProgressSignature ||
                (REFERENCE_GRID_FLAG_UPDATE_BACKPRESSURE &&
                  now - lastProgressUpdateAt < OUTPUT_PROGRESS_UPDATE_MIN_INTERVAL_MS);
              if (!shouldSkipProgressUpdate) {
                queueOutputUpdate(
                  outputId,
                  (item) => {
                    const nextQueueState =
                      normalizeLifecycleQueueState(lifecycleHint.queueState) ?? item.queueState;
                    const queueStateChanged = nextQueueState !== item.queueState;
                    const taskStateChanged = item.taskState !== nextTaskState;
                    const timestampChanged = item.timestamp !== nextTimestamp;
                    if (!queueStateChanged && !taskStateChanged && !timestampChanged) return item;
                    lastProgressUpdateAtRef.current[outputId] = now;
                    lastProgressSignatureRef.current[outputId] = nextProgressSignature;
                    return {
                      ...item,
                      queueState: nextQueueState,
                      taskState: nextTaskState,
                      status: item.status === "ready" ? item.status : "ready",
                      timestamp: nextTimestamp,
                      errorMessage: lifecycleHint.recoveryPending ? null : item.errorMessage,
                      errorMessageShort: lifecycleHint.recoveryPending
                        ? null
                        : item.errorMessageShort,
                      errorDetail: lifecycleHint.recoveryPending ? null : item.errorDetail,
                    };
                  },
                  { nonUrgent: lifecycleHint.recoveryPending !== true }
                );
              }
              pollTimersRef.current[outputId] = window.setTimeout(
                () =>
                  pollTask(
                    taskId,
                    outputId,
                    attempt + 1,
                    provider,
                    startedAt,
                    0,
                    activePollSessionId,
                    options
                  ),
                delay
              );
              return;
            }

            const { state } = resolveProviderStatusState(status);

            if (terminalSuccessStates.has(state)) {
              addBreadcrumb({
                type: "ui",
                level: "warn",
                message: "generation_terminal_success_without_lifecycle_handoff",
                data: {
                  provider,
                  task_id: taskId,
                  output_id: outputId,
                  status_state: state,
                  poll_attempt: attempt,
                },
              });
              queueOutputUpdate(outputId, (item) => ({
                ...item,
                status: item.status === "ready" ? item.status : "ready",
                taskState: item.taskState === "running" ? item.taskState : "running",
                timestamp:
                  item.timestamp === SERVER_RECOVERY_PENDING_TIMESTAMP
                    ? item.timestamp
                    : SERVER_RECOVERY_PENDING_TIMESTAMP,
                errorMessage: null,
                errorMessageShort: null,
                errorDetail: null,
              }));
              scheduleBackgroundRecovery(
                taskId,
                outputId,
                provider,
                "no_media_after_terminal_success"
              );
              clearPollTimer(outputId);
              return;
            }

            if (terminalFailureStates.has(state)) {
              addBreadcrumb({
                type: "ui",
                level: "warn",
                message: "generation_terminal_failure_without_lifecycle_handoff",
                data: {
                  provider,
                  task_id: taskId,
                  output_id: outputId,
                  status_state: state,
                  poll_attempt: attempt,
                },
              });
              queueOutputUpdate(outputId, (item) => ({
                ...item,
                status: item.status === "ready" ? item.status : "ready",
                taskState: item.taskState === "running" ? item.taskState : "running",
                timestamp:
                  item.timestamp === SERVER_RECOVERY_PENDING_TIMESTAMP
                    ? item.timestamp
                    : SERVER_RECOVERY_PENDING_TIMESTAMP,
                errorMessage: null,
                errorMessageShort: null,
                errorDetail: null,
              }));
              scheduleBackgroundRecovery(taskId, outputId, provider, "status_poll_error");
              clearPollTimer(outputId);
              return;
            }

            const nextTaskState = "running";
            const now = Date.now();
            const lastProgressUpdateAt = lastProgressUpdateAtRef.current[outputId] ?? 0;
            const nextTimestamp = "Processing...";
            const nextProgressSignature = `${nextTaskState}|${nextTimestamp}`;
            const shouldSkipProgressUpdate =
              lastProgressSignatureRef.current[outputId] === nextProgressSignature ||
              (REFERENCE_GRID_FLAG_UPDATE_BACKPRESSURE &&
                nextTaskState === "running" &&
                now - lastProgressUpdateAt < OUTPUT_PROGRESS_UPDATE_MIN_INTERVAL_MS);
            if (!shouldSkipProgressUpdate) {
              queueOutputUpdate(
                outputId,
                (item) => {
                  const taskStateChanged = item.taskState !== nextTaskState;
                  const timestampChanged = item.timestamp !== nextTimestamp;
                  if (!taskStateChanged && !timestampChanged) return item;
                  lastProgressUpdateAtRef.current[outputId] = now;
                  lastProgressSignatureRef.current[outputId] = nextProgressSignature;
                  return {
                    ...item,
                    taskState: nextTaskState,
                    status: item.status === "ready" ? item.status : "ready",
                    timestamp: nextTimestamp,
                    errorMessage: item.errorMessage,
                    errorMessageShort: item.errorMessageShort,
                    errorDetail: item.errorDetail,
                  };
                },
                { nonUrgent: true }
              );
            }
            pollTimersRef.current[outputId] = window.setTimeout(
              () =>
                pollTask(
                  taskId,
                  outputId,
                  attempt + 1,
                  provider,
                  startedAt,
                  0,
                  activePollSessionId,
                  options
                ),
              delay
            );
          } catch (error) {
            const message = error instanceof Error ? error.message : "Unable to check status";
            if (isStatusErrorRetryBudgetExhausted({ message, attempt })) {
              queueOutputUpdate(outputId, (item) => ({
                ...item,
                taskState: item.taskState === "running" ? item.taskState : "running",
                status: item.status === "ready" ? item.status : "ready",
                timestamp:
                  item.timestamp === SERVER_RECOVERY_PENDING_TIMESTAMP
                    ? item.timestamp
                    : SERVER_RECOVERY_PENDING_TIMESTAMP,
                errorMessage: null,
                errorMessageShort: null,
                errorDetail: null,
              }));
              scheduleBackgroundRecovery(taskId, outputId, provider, "status_poll_error");
              clearPollTimer(outputId);
              return;
            }
            const now = Date.now();
            const lastProgressUpdateAt = lastProgressUpdateAtRef.current[outputId] ?? 0;
            const nextProgressSignature = "running|Retrying status...";
            const shouldSkipRetryUpdate =
              lastProgressSignatureRef.current[outputId] === nextProgressSignature ||
              (REFERENCE_GRID_FLAG_UPDATE_BACKPRESSURE &&
                now - lastProgressUpdateAt < OUTPUT_PROGRESS_UPDATE_MIN_INTERVAL_MS);
            if (!shouldSkipRetryUpdate) {
              queueOutputUpdate(
                outputId,
                (item) => {
                  const taskStateChanged = item.taskState !== "running";
                  const statusChanged = item.status !== "ready";
                  const timestampChanged = item.timestamp !== "Retrying status...";
                  if (!taskStateChanged && !statusChanged && !timestampChanged) return item;
                  lastProgressUpdateAtRef.current[outputId] = now;
                  lastProgressSignatureRef.current[outputId] = nextProgressSignature;
                  return {
                    ...item,
                    taskState: "running",
                    status: "ready",
                    timestamp: "Retrying status...",
                  };
                },
                { nonUrgent: true }
              );
            }
            pollTimersRef.current[outputId] = window.setTimeout(
              () =>
                pollTask(
                  taskId,
                  outputId,
                  attempt + 1,
                  provider,
                  startedAt,
                  0,
                  activePollSessionId,
                  options
                ),
              delay
            );
          }
        } finally {
          statusRequestsInFlightRef.current = Math.max(0, statusRequestsInFlightRef.current - 1);
          setFreezeInvestigationGauge(
            "aiStudioTasks.statusRequestsInFlight",
            statusRequestsInFlightRef.current
          );
        }
      }, delay);
      pollTimersRef.current[outputId] = timeoutId;
    },
    [
      clearPollTimer,
      clearRecoveryTimer,
      findOutputById,
      handleOutputLookupHardStop,
      notifyGenerationFailure,
      onGenerationFailure,
      onGenerationSuccess,
      outputLookupHardStopNotifiedRef,
      outputLookupMissesRef,
      outputLookupMissingSinceRef,
      queueOutputUpdate,
      scheduleBackgroundRecovery,
    ]
  );

  useEffect(
    () => () => {
      flushQueuedOutputUpdates();
      Object.values(pollTimersRef.current).forEach((timeoutId) => window.clearTimeout(timeoutId));
      pollTimersRef.current = {};
      pollSessionsRef.current = {};
      statusRequestsInFlightRef.current = 0;
      resetRecoveryState();
      lastProgressUpdateAtRef.current = {};
      lastProgressSignatureRef.current = {};
      queuedOutputUpdatersRef.current = {};
      queuedOutputFlushPendingRef.current = false;
      if (queuedOutputFlushRafIdRef.current != null) {
        window.cancelAnimationFrame(queuedOutputFlushRafIdRef.current);
      }
      queuedOutputFlushRafIdRef.current = null;
    },
    [flushQueuedOutputUpdates, resetRecoveryState]
  );

  return {
    startPollingTask,
    clearPollTimer,
    pollTimersRef,
  };
}
