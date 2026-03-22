/**
 * Side-effectful task runner for AI Studio generations.
 * Handles submit + polling orchestration per provider, isolated from UI state.
 */
import { startTransition, useCallback, useEffect, useRef } from "react";
import {
  fetchKieKlingImageToVideoStatus,
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
  fetchFalSoraStatus,
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
import { extractFalMediaUrls, extractResultUrls, Provider } from "../logic/stateParsers";
import { StudioOutput } from "../types";
import {
  BACKGROUND_RECOVERY_INTERVAL_MS,
  type BackgroundRecoveryReasonCode,
  getBackgroundRecoveryMaxAttempts,
} from "./taskPolling/backgroundRecoveryPolicy";
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
  resolveNoMediaRetryPolicy,
} from "./taskPolling/pollingSchedulePolicy";
import {
  classifyProviderSuccess,
  condenseError,
  createShortErrorMessage,
  extractFailureMessageFromDetail,
  looksLikeFailureMessage,
  normalizeProviderStateToTaskState,
  type PollStatus,
  resolveProviderStatusState,
  terminalFailureStates,
} from "./taskPolling/providerStatusPolicy";

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

type QueuedOutputUpdate = {
  updater: (item: StudioOutput) => StudioOutput;
  nonUrgent: boolean;
};

const areStringArraysEqual = (left: string[] | undefined, right: string[]) => {
  if (!left) return right.length === 0;
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
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
    case "fal-sora":
      return fetchFalSoraStatus(taskId);
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
    default:
      return fetchFalStatus(taskId);
  }
};

const extractMediaByProvider = (
  provider: Provider,
  status: PollStatus,
  options?: { outputMode?: StudioOutput["mode"] | null }
) => {
  if (provider === "kie-veo" || provider === "kie-kling") {
    const providerUrls = extractResultUrls(status?.resultJson ?? status, status);
    if (providerUrls.length) return providerUrls;
  }
  return extractFalMediaUrls(status, {
    preferVideo: options?.outputMode === "video",
  });
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
  const recoveryTimersRef = useRef<Record<string, number>>({});
  const recoveryAttemptsRef = useRef<Record<string, number>>({});
  const outputLookupMissesRef = useRef<Record<string, number>>({});
  const outputLookupMissingSinceRef = useRef<Record<string, number>>({});
  const outputLookupHardStopNotifiedRef = useRef<Record<string, boolean>>({});
  const lastProgressUpdateAtRef = useRef<Record<string, number>>({});
  const queuedOutputUpdatersRef = useRef<Record<string, QueuedOutputUpdate[]>>({});
  const queuedOutputFlushPendingRef = useRef(false);
  const queuedOutputFlushRafIdRef = useRef<number | null>(null);

  const flushQueuedOutputUpdates = useCallback(() => {
    const queued = queuedOutputUpdatersRef.current;
    queuedOutputUpdatersRef.current = {};
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
      delete outputLookupMissesRef.current[outputId];
      delete outputLookupMissingSinceRef.current[outputId];
      delete outputLookupHardStopNotifiedRef.current[outputId];
    },
    [updateOutputById]
  );

  const clearRecoveryTimer = useCallback((outputId: string) => {
    const timeoutId = recoveryTimersRef.current[outputId];
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      delete recoveryTimersRef.current[outputId];
    }
    delete recoveryAttemptsRef.current[outputId];
  }, []);

  const scheduleBackgroundRecovery = useCallback(
    (
      taskId: string,
      outputId: string,
      provider: Provider,
      reasonCode: BackgroundRecoveryReasonCode
    ) => {
      if (recoveryTimersRef.current[outputId]) return;
      const maxRecoveryAttempts = getBackgroundRecoveryMaxAttempts(reasonCode);

      addBreadcrumb({
        type: "ui",
        level: "warn",
        message: "generation_background_recovery_scheduled",
        data: {
          provider,
          task_id: taskId,
          output_id: outputId,
          reason_code: reasonCode,
          interval_ms: BACKGROUND_RECOVERY_INTERVAL_MS,
          max_attempts: maxRecoveryAttempts,
        },
      });

      const queueNext = () => {
        recoveryTimersRef.current[outputId] = window.setTimeout(async () => {
          const attempt = (recoveryAttemptsRef.current[outputId] ?? 0) + 1;
          recoveryAttemptsRef.current[outputId] = attempt;

          try {
            const status = (await fetchStatusByProvider(provider, taskId)) as PollStatus;
            const outputMode = findOutputById?.(outputId)?.mode ?? null;
            const recoveredUrls = extractMediaByProvider(provider, status, {
              outputMode,
            }).filter(Boolean);

            if (recoveredUrls.length > 0) {
              addBreadcrumb({
                type: "ui",
                level: "info",
                message: "generation_background_recovery_success",
                data: {
                  provider,
                  task_id: taskId,
                  output_id: outputId,
                  attempt,
                  recovered_count: recoveredUrls.length,
                },
              });

              queueOutputUpdate(outputId, (item) => {
                const nextDelivery = resolveNormalizedOutputDelivery({
                  previewStoragePath: item.previewStoragePath ?? null,
                  fullStoragePath: item.fullStoragePath ?? null,
                  previewUrl: recoveredUrls[0] ?? item.previewUrl ?? null,
                  resultUrls: recoveredUrls,
                });
                return {
                  ...item,
                  taskState: item.taskState === "success" ? item.taskState : "success",
                  status: item.status === "ready" ? item.status : "ready",
                  timestamp:
                    item.timestamp === "Recovered media URL."
                      ? item.timestamp
                      : "Recovered media URL.",
                  resultUrls: areStringArraysEqual(item.resultUrls, recoveredUrls)
                    ? item.resultUrls
                    : recoveredUrls,
                  previewUrl:
                    item.previewUrl === (recoveredUrls[0] ?? item.previewUrl)
                      ? item.previewUrl
                      : (recoveredUrls[0] ?? item.previewUrl),
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
              onGenerationSuccess?.({
                outputId,
                taskId,
                provider,
                resultUrls: recoveredUrls,
              });
              clearPollTimer(outputId);
              clearRecoveryTimer(outputId);
              return;
            }
          } catch {
            // best-effort fallback polling; keep trying until budget is exhausted
          }

          if (attempt >= maxRecoveryAttempts) {
            addBreadcrumb({
              type: "ui",
              level: "warn",
              message: "generation_background_recovery_exhausted",
              data: {
                provider,
                task_id: taskId,
                output_id: outputId,
                attempts: attempt,
                max_attempts: maxRecoveryAttempts,
              },
            });
            clearRecoveryTimer(outputId);
            return;
          }

          queueNext();
        }, BACKGROUND_RECOVERY_INTERVAL_MS);
      };

      queueNext();
    },
    [clearPollTimer, clearRecoveryTimer, findOutputById, onGenerationSuccess, queueOutputUpdate]
  );

  const handleOutputLookupHardStop = useCallback(
    ({
      outputId,
      taskId,
      provider,
      lookupMisses,
      missingDurationMs,
    }: OutputLookupHardStopPayload) => {
      if (outputLookupHardStopNotifiedRef.current[outputId]) {
        return;
      }
      outputLookupHardStopNotifiedRef.current[outputId] = true;
      addBreadcrumb({
        type: "ui",
        level: "warn",
        message: "generation_poll_output_lookup_hard_stop",
        data: {
          provider,
          task_id: taskId,
          output_id: outputId,
          lookup_misses: lookupMisses,
          missing_duration_ms: missingDurationMs,
        },
      });
      onPollingOutputLookupHardStop?.({
        outputId,
        taskId,
        provider,
        lookupMisses,
        missingDurationMs,
      });
      scheduleBackgroundRecovery(taskId, outputId, provider, "output_lookup_missing");
      clearPollTimer(outputId);
      clearRecoveryTimer(outputId);
    },
    [clearPollTimer, clearRecoveryTimer, onPollingOutputLookupHardStop, scheduleBackgroundRecovery]
  );

  const startPollingTask = useCallback(
    function pollTask(
      taskId: string,
      outputId: string,
      attempt = 0,
      provider: Provider = "fal",
      startedAt = Date.now(),
      noMediaAttempt = 0,
      pollSessionId?: number
    ) {
      let activePollSessionId = pollSessionId;
      if (activePollSessionId == null) {
        activePollSessionId = (pollSessionsRef.current[outputId] ?? 0) + 1;
        pollSessionsRef.current[outputId] = activePollSessionId;
      }

      if ((pollSessionsRef.current[outputId] ?? 0) !== activePollSessionId) {
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
              activePollSessionId
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
        const timeoutMessage = "Timed out waiting for provider result.";
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
        notifyGenerationFailure(outputId, timeoutMessage, timeoutMessage, {
          reasonCode: "poll_timeout",
          pollAttempt: attempt,
          noMediaAttempt,
          elapsedMs,
          maxWaitMs,
        });
        if (onGenerationFailure) {
          onGenerationFailure({
            outputId,
            taskId,
            provider,
            message: timeoutMessage,
            reasonCode: "poll_timeout",
          });
        }
        scheduleBackgroundRecovery(taskId, outputId, provider, "poll_timeout");
        clearPollTimer(outputId);
        return;
      }

      const delay = getPollDelayMs(attempt);
      const timeoutId = window.setTimeout(async () => {
        if ((pollSessionsRef.current[outputId] ?? 0) !== activePollSessionId) {
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
                activePollSessionId
              ),
            getStatusConcurrencyRetryDelayMs(delay)
          );
          return;
        }
        statusRequestsInFlightRef.current += 1;
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
                    activePollSessionId
                  ),
                lookupPolicy.retryDelayMs
              );
              return;
            }
            delete outputLookupMissesRef.current[outputId];
            delete outputLookupMissingSinceRef.current[outputId];
            delete outputLookupHardStopNotifiedRef.current[outputId];

            const status = (await fetchStatusByProvider(provider, taskId)) as PollStatus;
            const { state, hasExplicitState } = resolveProviderStatusState(status);

            const outputMode = findOutputById?.(outputId)?.mode ?? null;
            const allUrls = extractMediaByProvider(provider, status, {
              outputMode,
            });
            const hasMedia = allUrls.length > 0;
            const { shouldForceImageMediaSuccess, shouldTreatAsSuccess } = classifyProviderSuccess({
              provider,
              state,
              hasMedia,
              hasExplicitState,
            });

            if (shouldTreatAsSuccess) {
              if (shouldForceImageMediaSuccess) {
                addBreadcrumb({
                  type: "ui",
                  level: "warn",
                  message: "generation_nonterminal_media_forced_success",
                  data: {
                    provider,
                    task_id: taskId,
                    output_id: outputId,
                    status_state: state,
                  },
                });
              }
              // Provider may report terminal success before media URLs are materialized.
              // Track a dedicated "no media yet" retry budget instead of using total poll attempts.
              const {
                maxNoMediaAttempts,
                shouldRetryForMedia,
                retryDelayMs: noMediaRetryDelayMs,
              } = resolveNoMediaRetryPolicy({
                provider,
                noMediaAttempt,
                fallbackDelayMs: delay,
              });
              if (!hasMedia && shouldRetryForMedia) {
                if (noMediaAttempt === 0) {
                  addBreadcrumb({
                    type: "ui",
                    level: "warn",
                    message: "generation_terminal_no_media_retrying",
                    data: {
                      provider,
                      task_id: taskId,
                      output_id: outputId,
                      status_state: state,
                      max_no_media_attempts: maxNoMediaAttempts,
                      retry_delay_ms: noMediaRetryDelayMs,
                    },
                  });
                }
                queueOutputUpdate(
                  outputId,
                  (item) => ({
                    ...item,
                    taskState: item.taskState === "running" ? item.taskState : "running",
                    status: item.status === "ready" ? item.status : "ready",
                    timestamp:
                      item.timestamp === "Finalizing media..."
                        ? item.timestamp
                        : "Finalizing media...",
                  }),
                  { nonUrgent: true }
                );
                pollTimersRef.current[outputId] = window.setTimeout(
                  () =>
                    pollTask(
                      taskId,
                      outputId,
                      attempt + 1,
                      provider,
                      startedAt,
                      noMediaAttempt + 1,
                      activePollSessionId
                    ),
                  noMediaRetryDelayMs
                );
                return;
              }

              if (!hasMedia) {
                const failureMessage =
                  "Generation finished, but no media URL was returned. Please retry.";
                addBreadcrumb({
                  type: "ui",
                  level: "error",
                  message: "generation_terminal_no_media_exhausted",
                  data: {
                    provider,
                    task_id: taskId,
                    output_id: outputId,
                    status_state: state,
                    no_media_attempts: noMediaAttempt,
                  },
                });
                notifyGenerationFailure(outputId, failureMessage, failureMessage, {
                  reasonCode: "no_media_after_terminal_success",
                  providerState: state,
                  pollAttempt: attempt,
                  noMediaAttempt,
                  elapsedMs: Date.now() - startedAt,
                  maxWaitMs,
                });
                queueOutputUpdate(outputId, (item) => ({
                  ...item,
                  status: item.status === "ready" ? item.status : "ready",
                  taskState: item.taskState === "fail" ? item.taskState : "fail",
                  errorMessage:
                    item.errorMessage === failureMessage ? item.errorMessage : failureMessage,
                  errorMessageShort:
                    item.errorMessageShort === "No media returned."
                      ? item.errorMessageShort
                      : "No media returned.",
                  errorDetail:
                    item.errorDetail === failureMessage ? item.errorDetail : failureMessage,
                }));
                if (onGenerationFailure) {
                  onGenerationFailure({
                    outputId,
                    taskId,
                    provider,
                    message: failureMessage,
                    reasonCode: "no_media_after_terminal_success",
                  });
                }
                scheduleBackgroundRecovery(
                  taskId,
                  outputId,
                  provider,
                  "no_media_after_terminal_success"
                );
                clearPollTimer(outputId);
                return;
              }

              queueOutputUpdate(outputId, (item) => {
                const nextDelivery = resolveNormalizedOutputDelivery({
                  previewStoragePath: item.previewStoragePath ?? null,
                  fullStoragePath: item.fullStoragePath ?? null,
                  previewUrl: allUrls[0] ?? item.previewUrl ?? null,
                  resultUrls: allUrls,
                });
                return {
                  ...item,
                  taskState: item.taskState === "success" ? item.taskState : "success",
                  status: item.status === "ready" ? item.status : "ready",
                  timestamp: item.timestamp === "Just now" ? item.timestamp : "Just now",
                  resultUrls: areStringArraysEqual(item.resultUrls, allUrls)
                    ? item.resultUrls
                    : allUrls,
                  previewUrl:
                    item.previewUrl === (allUrls[0] ?? item.previewUrl)
                      ? item.previewUrl
                      : (allUrls[0] ?? item.previewUrl),
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
                  resultUrls: allUrls,
                });
              }
              clearRecoveryTimer(outputId);
              clearPollTimer(outputId);
              return;
            }

            // MULTIPLE ERROR DETECTION STRATEGIES
            const isErrorState = terminalFailureStates.has(state);

            const hasErrorField =
              Boolean(status?.error) || Boolean(status?.failMsg) || Boolean(status?.failCode);

            const isExplicitErrorStatus =
              String(status?.status ?? "").toLowerCase() === "error" ||
              String(status?.state ?? "").toLowerCase() === "error";

            const detailMessage = extractFailureMessageFromDetail(status?.detail);
            const messageField = typeof status?.message === "string" ? status.message : null;
            const statusMessageField =
              typeof status?.statusMessage === "string" ? status.statusMessage : null;
            const errorField = extractFailureMessageFromDetail(status?.error);
            const failMessageField = extractFailureMessageFromDetail(status?.failMsg);
            const failCodeField = extractFailureMessageFromDetail(status?.failCode);

            const hasFailureMessage =
              looksLikeFailureMessage(messageField) ||
              looksLikeFailureMessage(statusMessageField) ||
              looksLikeFailureMessage(detailMessage) ||
              looksLikeFailureMessage(errorField);

            // If ANY condition is true, treat as error
            if (isErrorState || hasErrorField || isExplicitErrorStatus || hasFailureMessage) {
              const rawFailureDetail =
                failMessageField ||
                failCodeField ||
                errorField ||
                (hasFailureMessage ? messageField : null) ||
                statusMessageField ||
                detailMessage ||
                "Generation failed";
              const failureDetail =
                typeof rawFailureDetail === "string"
                  ? rawFailureDetail
                  : rawFailureDetail != null
                    ? String(rawFailureDetail)
                    : "Generation failed";

              const failureMessage = condenseError(detailMessage ?? failureDetail);
              const safeFailureMessage = looksLikeFailureMessage(failureMessage)
                ? failureMessage
                : "Generation failed";
              const safeFailureDetail = looksLikeFailureMessage(failureDetail)
                ? failureDetail
                : safeFailureMessage;

              const shortMessage = createShortErrorMessage(safeFailureMessage);

              notifyGenerationFailure(outputId, safeFailureMessage, safeFailureDetail, {
                reasonCode: "provider_error",
                providerState: state,
                pollAttempt: attempt,
                elapsedMs: Date.now() - startedAt,
                maxWaitMs,
              });

              // Update output state to show error in UI
              queueOutputUpdate(outputId, (item) => ({
                ...item,
                status: item.status === "ready" ? item.status : "ready",
                taskState: item.taskState === "fail" ? item.taskState : "fail",
                errorMessage:
                  item.errorMessage === safeFailureMessage ? item.errorMessage : safeFailureMessage,
                errorMessageShort:
                  item.errorMessageShort === shortMessage ? item.errorMessageShort : shortMessage,
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

            const nextTaskState = normalizeProviderStateToTaskState(state);
            const now = Date.now();
            const lastProgressUpdateAt = lastProgressUpdateAtRef.current[outputId] ?? 0;
            const shouldSkipProgressUpdate =
              REFERENCE_GRID_FLAG_UPDATE_BACKPRESSURE &&
              nextTaskState === "running" &&
              now - lastProgressUpdateAt < OUTPUT_PROGRESS_UPDATE_MIN_INTERVAL_MS;
            if (!shouldSkipProgressUpdate) {
              queueOutputUpdate(
                outputId,
                (item) => {
                  const taskStateChanged = item.taskState !== nextTaskState;
                  const timestampChanged = item.timestamp !== "Processing...";
                  if (!taskStateChanged && !timestampChanged) return item;
                  lastProgressUpdateAtRef.current[outputId] = now;
                  return {
                    ...item,
                    taskState: nextTaskState,
                    timestamp: "Processing...",
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
                  activePollSessionId
                ),
              delay
            );
          } catch (error) {
            const message = error instanceof Error ? error.message : "Unable to check status";
            if (isStatusErrorRetryBudgetExhausted({ message, attempt })) {
              notifyGenerationFailure(outputId, condenseError(message), message, {
                reasonCode: "status_poll_error",
                pollAttempt: attempt,
                elapsedMs: Date.now() - startedAt,
                maxWaitMs,
              });
              if (onGenerationFailure) {
                onGenerationFailure({
                  outputId,
                  taskId,
                  provider,
                  message,
                  reasonCode: "status_poll_error",
                });
              }
              scheduleBackgroundRecovery(taskId, outputId, provider, "status_poll_error");
              clearPollTimer(outputId);
              return;
            }
            const now = Date.now();
            const lastProgressUpdateAt = lastProgressUpdateAtRef.current[outputId] ?? 0;
            const shouldSkipRetryUpdate =
              REFERENCE_GRID_FLAG_UPDATE_BACKPRESSURE &&
              now - lastProgressUpdateAt < OUTPUT_PROGRESS_UPDATE_MIN_INTERVAL_MS;
            if (!shouldSkipRetryUpdate) {
              queueOutputUpdate(
                outputId,
                (item) => {
                  const taskStateChanged = item.taskState !== "running";
                  const statusChanged = item.status !== "ready";
                  const timestampChanged = item.timestamp !== "Retrying status...";
                  if (!taskStateChanged && !statusChanged && !timestampChanged) return item;
                  lastProgressUpdateAtRef.current[outputId] = now;
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
                  activePollSessionId
                ),
              delay
            );
          }
        } finally {
          statusRequestsInFlightRef.current = Math.max(0, statusRequestsInFlightRef.current - 1);
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
      queueOutputUpdate,
      scheduleBackgroundRecovery,
    ]
  );

  useEffect(
    () => () => {
      flushQueuedOutputUpdates();
      Object.values(pollTimersRef.current).forEach((timeoutId) => window.clearTimeout(timeoutId));
      Object.values(recoveryTimersRef.current).forEach((timeoutId) =>
        window.clearTimeout(timeoutId)
      );
      pollTimersRef.current = {};
      pollSessionsRef.current = {};
      statusRequestsInFlightRef.current = 0;
      recoveryTimersRef.current = {};
      recoveryAttemptsRef.current = {};
      outputLookupMissesRef.current = {};
      outputLookupMissingSinceRef.current = {};
      outputLookupHardStopNotifiedRef.current = {};
      lastProgressUpdateAtRef.current = {};
      queuedOutputUpdatersRef.current = {};
      queuedOutputFlushPendingRef.current = false;
      if (queuedOutputFlushRafIdRef.current != null) {
        window.cancelAnimationFrame(queuedOutputFlushRafIdRef.current);
      }
      queuedOutputFlushRafIdRef.current = null;
    },
    [flushQueuedOutputUpdates]
  );

  return {
    startPollingTask,
    clearPollTimer,
    pollTimersRef,
  };
}
