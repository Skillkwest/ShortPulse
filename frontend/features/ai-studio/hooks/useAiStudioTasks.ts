/**
 * Side-effectful task runner for AI Studio generations.
 * Handles submit + polling orchestration per provider, isolated from UI state.
 */
import { startTransition, useCallback, useEffect, useRef } from "react";
import { fetchQueuedGenerationStatusByModelId } from "../../../lib/falClient";
import { addBreadcrumb } from "../../../lib/clientBreadcrumbs";
import { extractCustomerFacingProviderError } from "../../../lib/customerFacingProviderText";
import {
  PERF_FLAG_RAF_STATUS_FLUSH,
  PERF_FLAG_REFERENCE_GRID_UPDATE_BACKPRESSURE,
} from "../logic/perfProfileFlags";
import {
  isAudioMediaCandidate,
  isImageMediaCandidate,
  isVideoMediaCandidate,
} from "../logic/referenceGridMediaCandidates";
import { resolveNormalizedOutputDelivery } from "../logic/referenceGridMedia";
import {
  type Provider,
  resolveTaskPollingTarget,
  type TaskPollingTarget,
} from "../logic/stateParsers";
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
  POLL_DELAY_INITIAL_MS,
  resolveNoMediaRetryPolicy,
} from "./taskPolling/pollingSchedulePolicy";
import {
  condenseError,
  createShortErrorMessage,
  longRunningVideoProviders,
  looksLikeFailureMessage,
  type PollStatus,
  type ShortPulseLifecycleHint,
  readShortPulseLifecycleHint,
  resolveProviderTerminalFailureCopy,
  resolvePollStatusGenerationId,
  resolveProviderStatusState,
  terminalSuccessStates,
  terminalFailureStates,
} from "./taskPolling/providerStatusPolicy";
import { useAiStudioTaskRecoveryController } from "./taskPolling/useAiStudioTaskRecoveryController";
import { resolveVisibleGenerationSettle } from "./taskPolling/visibleGenerationSettle";
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
  errorPayload?: unknown;
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
const RECOVERY_RECHECK_TIMESTAMP = "Processing...";
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

const asTrimmedString = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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
  return extractCustomerFacingProviderError(value);
};

const normalizeLifecycleQueueState = (
  queueState: string | null | undefined
): StudioOutput["queueState"] => {
  switch (queueState) {
    case "queued":
      return "queued";
    case "dispatching":
      return "dispatching";
    default:
      return undefined;
  }
};

const isRecognizedSaveState = (
  value: string | null | undefined
): value is NonNullable<StudioOutput["saveState"]> =>
  value === "idle" ||
  value === "saving" ||
  value === "saved" ||
  value === "failed" ||
  value === "blocked_storage";

const resolveSettledStatusFromSaveState = (
  saveState: StudioOutput["saveState"]
): StudioOutput["status"] => (saveState === "saved" ? "saved" : "ready");

const hasSavedMediaAuthority = (savedMediaIds: StudioOutput["savedMediaIds"]): boolean =>
  Array.isArray(savedMediaIds) &&
  savedMediaIds.some((value) => typeof value === "string" && value.trim().length > 0);

const isResultUrlIncompatibleWithOutputMode = (
  outputMode: StudioOutput["mode"] | null | undefined,
  url: string
): boolean => {
  switch (outputMode) {
    case "image":
      return isVideoMediaCandidate(url) || isAudioMediaCandidate(url);
    case "video":
      return isImageMediaCandidate(url) || isAudioMediaCandidate(url);
    case "audio":
      return isImageMediaCandidate(url) || isVideoMediaCandidate(url);
    default:
      return false;
  }
};

const filterResultUrlsForOutputMode = (
  resultUrls: readonly string[],
  outputMode: StudioOutput["mode"] | null | undefined
): string[] =>
  resultUrls.filter(
    (url) =>
      typeof url === "string" &&
      url.trim().length > 0 &&
      !isResultUrlIncompatibleWithOutputMode(outputMode, url)
  );

const resolveExpectedOutputMode = ({
  provider,
  outputMode,
}: {
  provider: Provider;
  outputMode: StudioOutput["mode"] | null | undefined;
}): StudioOutput["mode"] | null | undefined => {
  if (outputMode === "video" || outputMode === "audio") return outputMode;
  if (longRunningVideoProviders.has(provider)) return "video";
  return outputMode;
};

const hasCompatibleMediaForOutputMode = ({
  outputMode,
  previewUrl,
  previewStoragePath,
  fullStoragePath,
  resultUrls,
}: {
  outputMode: StudioOutput["mode"] | null | undefined;
  previewUrl?: string | null;
  previewStoragePath?: string | null;
  fullStoragePath?: string | null;
  resultUrls?: readonly string[] | null;
}): boolean => {
  const candidates = [previewUrl, previewStoragePath, fullStoragePath, ...(resultUrls ?? [])]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
  if (!candidates.length) return false;
  switch (outputMode) {
    case "image":
      return candidates.some(isImageMediaCandidate);
    case "video":
      return [previewUrl, fullStoragePath, ...(resultUrls ?? [])].some(isVideoMediaCandidate);
    case "audio":
      return [previewUrl, fullStoragePath, ...(resultUrls ?? [])].some(isAudioMediaCandidate);
    default:
      return true;
  }
};

const fetchStatusByModelId = async (modelId: string, taskId: string) =>
  fetchQueuedGenerationStatusByModelId(modelId, taskId);

export function useAiStudioTasks({
  updateOutputById,
  findOutputById,
  notifyGenerationFailure,
  onGenerationSuccess,
  onGenerationFailure,
  onPollingOutputLookupHardStop,
  projectId = null,
}: TaskCallbacks & { projectId?: string | null }) {
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

  const settleOutputFromVisibleGenerationState = useCallback(
    async ({
      outputId,
      taskId,
      provider,
      timestamp = "Just now",
    }: {
      outputId: string;
      taskId: string;
      provider: Provider;
      timestamp?: string;
    }) => {
      const existingOutput = findOutputById?.(outputId) ?? null;
      const settleResult = await resolveVisibleGenerationSettle({
        generationId: asTrimmedString(existingOutput?.generationId),
        requestId: taskId,
        ...(existingOutput?.sourceRef ? { sourceRef: existingOutput.sourceRef } : {}),
        ...(projectId ? { projectId } : {}),
      });
      if (settleResult.kind === "hidden_or_failed") {
        const { failure, projectionLifecycle } = settleResult;
        const isVisibleFailure =
          projectionLifecycle.taskState === "fail" &&
          projectionLifecycle.hiddenInReferenceGrid !== true &&
          projectionLifecycle.referenceGridVisible !== false;
        if (isVisibleFailure) {
          notifyGenerationFailure(outputId, failure.message, failure.detail, {
            reasonCode: "provider_error",
            providerState: projectionLifecycle.queueState ?? projectionLifecycle.taskState ?? null,
            errorPayload: projectionLifecycle.errorPayload,
          });
        }
        queueOutputUpdate(outputId, (item) => ({
          ...item,
          generationId: item.generationId ?? projectionLifecycle.generationId,
          status: "ready",
          taskState: projectionLifecycle.taskState === "fail" ? "fail" : item.taskState,
          queueState: projectionLifecycle.queueState ?? item.queueState,
          timestamp: projectionLifecycle.taskState === "fail" ? "Failed" : item.timestamp,
          hiddenInReferenceGrid:
            projectionLifecycle.hiddenInReferenceGrid === true ||
            projectionLifecycle.referenceGridVisible === false
              ? true
              : item.hiddenInReferenceGrid,
          errorMessage:
            projectionLifecycle.taskState === "fail" ? failure.message : item.errorMessage,
          errorMessageShort:
            projectionLifecycle.taskState === "fail"
              ? failure.shortMessage
              : item.errorMessageShort,
          errorDetail: projectionLifecycle.taskState === "fail" ? failure.detail : item.errorDetail,
          errorPayload:
            projectionLifecycle.taskState === "fail"
              ? (projectionLifecycle.errorPayload ?? item.errorPayload ?? null)
              : item.errorPayload,
        }));
        if (projectionLifecycle.taskState === "fail" && onGenerationFailure) {
          onGenerationFailure({
            outputId,
            taskId,
            provider,
            message: failure.detail,
            reasonCode: "provider_error",
          });
        }
        clearPollTimer(outputId);
        return true;
      }
      if (settleResult.kind !== "visible") return false;
      const { visibleGeneration } = settleResult;
      const expectedOutputMode = resolveExpectedOutputMode({
        provider,
        outputMode: existingOutput?.mode,
      });
      if (
        existingOutput &&
        !hasCompatibleMediaForOutputMode({
          outputMode: expectedOutputMode,
          previewUrl: visibleGeneration.previewUrl,
          previewStoragePath: visibleGeneration.previewStoragePath,
          fullStoragePath: visibleGeneration.fullStoragePath,
          resultUrls: visibleGeneration.resultUrls,
        })
      ) {
        return false;
      }
      queueOutputUpdate(outputId, (item) => {
        const itemExpectedOutputMode = resolveExpectedOutputMode({
          provider,
          outputMode: item.mode,
        });
        const visibleResultUrls = filterResultUrlsForOutputMode(
          visibleGeneration.resultUrls,
          itemExpectedOutputMode
        );
        const nextResultUrls =
          visibleResultUrls.length > 0 ? visibleResultUrls : (item.resultUrls ?? []);
        const nextDelivery = resolveNormalizedOutputDelivery({
          previewStoragePath:
            visibleGeneration.previewStoragePath ?? item.previewStoragePath ?? null,
          fullStoragePath: visibleGeneration.fullStoragePath ?? item.fullStoragePath ?? null,
          previewUrl: visibleGeneration.previewUrl ?? item.previewUrl ?? null,
          resultUrls: nextResultUrls,
        });
        const nextSaveState: StudioOutput["saveState"] =
          nextDelivery.previewStoragePath ||
          nextDelivery.fullStoragePath ||
          hasSavedMediaAuthority(item.savedMediaIds)
            ? "saved"
            : item.saveState;
        return {
          ...item,
          generationId: item.generationId ?? visibleGeneration.generationId ?? item.generationId,
          taskState: "success",
          status: resolveSettledStatusFromSaveState(nextSaveState),
          timestamp,
          resultUrls: areStringArraysEqual(item.resultUrls, nextResultUrls)
            ? item.resultUrls
            : nextResultUrls,
          previewUrl:
            item.previewUrl === (visibleGeneration.previewUrl ?? item.previewUrl)
              ? item.previewUrl
              : (visibleGeneration.previewUrl ?? item.previewUrl),
          previewPosterUrl:
            item.previewPosterUrl === visibleGeneration.previewPosterUrl
              ? item.previewPosterUrl
              : (visibleGeneration.previewPosterUrl ?? item.previewPosterUrl ?? null),
          previewPosterStoragePath:
            item.previewPosterStoragePath === visibleGeneration.previewPosterStoragePath
              ? item.previewPosterStoragePath
              : (visibleGeneration.previewPosterStoragePath ??
                item.previewPosterStoragePath ??
                null),
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
          saveState: nextSaveState,
          saveError: nextSaveState === "saved" ? null : (item.saveError ?? null),
          archivedAt: null,
          archiveReason: null,
          errorMessage: null,
          errorMessageShort: null,
          errorDetail: null,
        };
      });
      const successResultUrls = filterResultUrlsForOutputMode(
        visibleGeneration.resultUrls,
        expectedOutputMode
      );
      if (onGenerationSuccess && successResultUrls.length > 0) {
        onGenerationSuccess({
          outputId,
          taskId,
          provider,
          resultUrls: successResultUrls,
        });
      }
      clearPollTimer(outputId);
      return true;
    },
    [
      clearPollTimer,
      findOutputById,
      notifyGenerationFailure,
      onGenerationFailure,
      onGenerationSuccess,
      projectId,
      queueOutputUpdate,
    ]
  );

  const {
    handleOutputLookupHardStop,
    outputLookupHardStopNotifiedRef,
    outputLookupMissesRef,
    outputLookupMissingSinceRef,
    resetRecoveryState,
  } = useAiStudioTaskRecoveryController({
    clearPollTimer,
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
      provider?: Provider,
      startedAt = Date.now(),
      noMediaAttempt = 0,
      pollSessionId?: number,
      options?: StartPollingTaskOptions,
      pollingTarget?: TaskPollingTarget | null
    ) {
      incrementFreezeInvestigationCounter("aiStudioTasks.startPollingTask.calls");
      if (!provider) {
        notifyGenerationFailure(
          outputId,
          "Generation status retry is missing a model-specific polling route.",
          "Generation status retry is missing a model-specific polling route.",
          { reasonCode: "status_poll_error" }
        );
        return;
      }
      const resolvedPollingTarget = pollingTarget ?? resolveTaskPollingTarget({ provider });
      if (!resolvedPollingTarget) {
        notifyGenerationFailure(
          outputId,
          "Generation status retry is missing a model-specific polling route.",
          "Generation status retry is missing a model-specific polling route.",
          { reasonCode: "status_poll_error" }
        );
        return;
      }
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
      const clearOutputLookupState = () => {
        delete outputLookupMissesRef.current[outputId];
        delete outputLookupMissingSinceRef.current[outputId];
        delete outputLookupHardStopNotifiedRef.current[outputId];
      };
      const scheduleLookupRetry = (retryDelayMs: number) => {
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
              options,
              resolvedPollingTarget
            ),
          retryDelayMs
        );
      };
      const handleMissingOutputLookup = () => {
        if (!findOutputById || findOutputById(outputId)) {
          clearOutputLookupState();
          return false;
        }
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
          return true;
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
        scheduleLookupRetry(lookupPolicy.retryDelayMs);
        return true;
      };
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
              options,
              resolvedPollingTarget
            ),
          hiddenRetryDelayMs
        );
        return;
      }

      if (handleMissingOutputLookup()) {
        return;
      }

      if (attempt === 0 && noMediaAttempt === 0) {
        const existingTimeoutId = pollTimersRef.current[outputId];
        if (existingTimeoutId) {
          window.clearTimeout(existingTimeoutId);
          delete pollTimersRef.current[outputId];
        }
      }

      const delay =
        attempt === 0 && typeof options?.initialDelayMs === "number"
          ? options.initialDelayMs
          : getPollDelayMs(attempt);
      const scheduleRecoveryRecheckPoll = ({
        nextStartedAt = Date.now(),
        nextNoMediaAttempt = noMediaAttempt,
        nextDelayMs = Math.max(POLL_DELAY_INITIAL_MS, delay),
      }: {
        nextStartedAt?: number;
        nextNoMediaAttempt?: number;
        nextDelayMs?: number;
      }) => {
        const retryDelayMs =
          nextNoMediaAttempt > 0
            ? resolveNoMediaRetryPolicy({
                provider,
                noMediaAttempt: Math.max(0, nextNoMediaAttempt - 1),
                fallbackDelayMs: nextDelayMs,
              }).retryDelayMs
            : nextDelayMs;
        pollTimersRef.current[outputId] = window.setTimeout(
          () =>
            pollTask(
              taskId,
              outputId,
              0,
              provider,
              nextStartedAt,
              nextNoMediaAttempt,
              activePollSessionId,
              {
                ...options,
                initialDelayMs: 0,
              },
              resolvedPollingTarget
            ),
          retryDelayMs
        );
      };
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
              : RECOVERY_RECHECK_TIMESTAMP,
          errorMessage: null,
          errorMessageShort: null,
          errorDetail: null,
        }));
        scheduleRecoveryRecheckPoll({
          nextStartedAt: Date.now(),
          nextNoMediaAttempt: 0,
        });
        return;
      }
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
                options,
                resolvedPollingTarget
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
                options,
                resolvedPollingTarget
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
            if (handleMissingOutputLookup()) {
              return;
            }

            const visibleGenerationSettled = await settleOutputFromVisibleGenerationState({
              outputId,
              taskId,
              provider,
            });
            if (visibleGenerationSettled) {
              return;
            }

            const status = (await fetchStatusByModelId(
              resolvedPollingTarget.modelId,
              taskId
            )) as PollStatus;
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
            const existingOutput = findOutputById?.(outputId) ?? null;
            const expectedOutputMode = resolveExpectedOutputMode({
              provider,
              outputMode: existingOutput?.mode,
            });
            const lifecycleResultUrls = filterResultUrlsForOutputMode(
              lifecycleHint?.resultUrls ?? [],
              expectedOutputMode
            );
            const lifecycleTaskState = resolveLifecycleTaskState(lifecycleHint);
            const lifecycleStatusLabel =
              lifecycleHint?.statusLabel?.trim() ||
              (lifecycleHint?.recoveryPending ? RECOVERY_RECHECK_TIMESTAMP : null);
            if (lifecycleTaskState === "success") {
              if (lifecycleResultUrls.length === 0) {
                const visibleGenerationSettled = await settleOutputFromVisibleGenerationState({
                  outputId,
                  taskId,
                  provider,
                  timestamp: lifecycleStatusLabel ?? "Just now",
                });
                if (visibleGenerationSettled) {
                  return;
                }
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
                      : RECOVERY_RECHECK_TIMESTAMP,
                  errorMessage: null,
                  errorMessageShort: null,
                  errorDetail: null,
                }));
                scheduleRecoveryRecheckPoll({
                  nextNoMediaAttempt: noMediaAttempt + 1,
                });
                return;
              }

              const visibleGenerationSettled = await settleOutputFromVisibleGenerationState({
                outputId,
                taskId,
                provider,
                timestamp: lifecycleStatusLabel ?? "Just now",
              });
              if (visibleGenerationSettled) {
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
                const nextSaveState = isRecognizedSaveState(lifecycleHint?.saveState)
                  ? lifecycleHint.saveState
                  : item.saveState;
                const shouldClearLifecycleSaveError =
                  lifecycleHint != null &&
                  Object.prototype.hasOwnProperty.call(lifecycleHint, "saveError");
                return {
                  ...item,
                  queueState:
                    normalizeLifecycleQueueState(lifecycleHint?.queueState) ?? item.queueState,
                  taskState: item.taskState === "success" ? item.taskState : "success",
                  status: resolveSettledStatusFromSaveState(nextSaveState),
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
                  saveState: nextSaveState,
                  saveError: shouldClearLifecycleSaveError
                    ? (lifecycleHint?.saveError ?? null)
                    : nextSaveState === "saved"
                      ? null
                      : (item.saveError ?? null),
                  archivedAt: null,
                  archiveReason: null,
                  errorMessage: item.errorMessage == null ? item.errorMessage : null,
                  errorMessageShort: item.errorMessageShort == null ? item.errorMessageShort : null,
                  errorDetail: item.errorDetail == null ? item.errorDetail : null,
                  errorPayload: item.errorPayload == null ? item.errorPayload : null,
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
                errorPayload: lifecycleHint?.errorPayload,
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
                errorPayload:
                  item.errorPayload === lifecycleHint?.errorPayload
                    ? item.errorPayload
                    : (lifecycleHint?.errorPayload ?? null),
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
                    const recoveryPendingErrorResetNeeded =
                      lifecycleHint?.recoveryPending === true &&
                      (item.errorMessage !== null ||
                        item.errorMessageShort !== null ||
                        item.errorDetail !== null);
                    if (
                      !queueStateChanged &&
                      !taskStateChanged &&
                      !timestampChanged &&
                      !recoveryPendingErrorResetNeeded
                    ) {
                      return item;
                    }
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
                    options,
                    resolvedPollingTarget
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
                    const recoveryPendingErrorResetNeeded =
                      lifecycleHint.recoveryPending === true &&
                      (item.errorMessage !== null ||
                        item.errorMessageShort !== null ||
                        item.errorDetail !== null);
                    if (
                      !queueStateChanged &&
                      !taskStateChanged &&
                      !timestampChanged &&
                      !recoveryPendingErrorResetNeeded
                    ) {
                      return item;
                    }
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
                    options,
                    resolvedPollingTarget
                  ),
                delay
              );
              return;
            }

            const { state } = resolveProviderStatusState(status);

            if (terminalSuccessStates.has(state)) {
              const visibleGenerationSettled = await settleOutputFromVisibleGenerationState({
                outputId,
                taskId,
                provider,
              });
              if (visibleGenerationSettled) {
                return;
              }
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
                    : RECOVERY_RECHECK_TIMESTAMP,
                errorMessage: null,
                errorMessageShort: null,
                errorDetail: null,
              }));
              scheduleRecoveryRecheckPoll({
                nextNoMediaAttempt: noMediaAttempt + 1,
              });
              return;
            }

            if (terminalFailureStates.has(state)) {
              const rawFailure = resolveProviderTerminalFailureCopy(status, state);
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
                  error_message: rawFailure.message,
                },
              });
              notifyGenerationFailure(outputId, rawFailure.message, rawFailure.detail, {
                reasonCode: "provider_error",
                providerState: state,
                pollAttempt: attempt,
                elapsedMs: Date.now() - startedAt,
                maxWaitMs,
                errorPayload: status,
              });
              queueOutputUpdate(outputId, (item) => ({
                ...item,
                status: item.status === "ready" ? item.status : "ready",
                taskState: item.taskState === "fail" ? item.taskState : "fail",
                timestamp:
                  item.timestamp === "Generation failed" ? item.timestamp : "Generation failed",
                errorMessage:
                  item.errorMessage === rawFailure.message ? item.errorMessage : rawFailure.message,
                errorMessageShort:
                  item.errorMessageShort === rawFailure.shortMessage
                    ? item.errorMessageShort
                    : rawFailure.shortMessage,
                errorDetail:
                  item.errorDetail === rawFailure.detail ? item.errorDetail : rawFailure.detail,
                errorPayload: item.errorPayload === status ? item.errorPayload : status,
              }));
              if (onGenerationFailure) {
                onGenerationFailure({
                  outputId,
                  taskId,
                  provider,
                  message: rawFailure.detail,
                  reasonCode: "provider_error",
                });
              }
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
                  options,
                  resolvedPollingTarget
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
                    : RECOVERY_RECHECK_TIMESTAMP,
                errorMessage: null,
                errorMessageShort: null,
                errorDetail: null,
              }));
              scheduleRecoveryRecheckPoll({
                nextStartedAt: Date.now(),
                nextNoMediaAttempt: 0,
              });
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
                  options,
                  resolvedPollingTarget
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
      findOutputById,
      handleOutputLookupHardStop,
      notifyGenerationFailure,
      onGenerationFailure,
      onGenerationSuccess,
      outputLookupHardStopNotifiedRef,
      outputLookupMissesRef,
      outputLookupMissingSinceRef,
      queueOutputUpdate,
      settleOutputFromVisibleGenerationState,
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
