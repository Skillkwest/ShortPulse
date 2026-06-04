/**
 * Output lifecycle hook for AI Studio state.
 * Owns stale-output sweeping, output mutation helpers, and failure normalization behavior.
 */
import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { normalizeErrorText } from "../../../lib/errorText";
import { reportAppError } from "../../../lib/appErrorReporter";
import { normalizeExplicitContentFailure } from "../../../lib/explicitContentFailure";
import {
  evaluateStaleOutputCleanup,
  hasStaleOutputCleanupCandidate,
  type OutputLifecycleMap,
} from "../logic/staleOutputCleanup";
import type { StudioOutput } from "../types";

const SUBMIT_START_TIMEOUT_MS = 90_000;
const DIRECT_REQUEST_TIMEOUT_MS = 5 * 60 * 1000;
const TASK_BACKED_LOADING_TIMEOUT_MS = 30 * 60 * 1000;
const QUEUE_WAIT_TIMEOUT_MS = 30 * 60 * 1000;
const AUTO_FAILED_OUTPUT_REMOVAL_MS = 2 * 60 * 1000;
const STALE_OUTPUT_SWEEP_INTERVAL_MS = 15_000;
const SERVER_RECOVERY_PENDING_TIMESTAMP = "Waiting for server recovery...";

const currentRoute = (): string | null => {
  if (typeof window === "undefined") return null;
  return `${window.location.pathname}${window.location.search}`.slice(0, 300);
};

type UseAiStudioOutputLifecycleParams = {
  outputs: StudioOutput[];
  setOutputs: Dispatch<SetStateAction<StudioOutput[]>>;
  updateOutputByIdFast?: (id: string, updater: (item: StudioOutput) => StudioOutput) => void;
  findOutputByIdFast?: (id: string) => StudioOutput | null;
  activeOutputId: string | null;
  setActiveOutputId: Dispatch<SetStateAction<string | null>>;
  pendingAutoSavesRef: MutableRefObject<Record<string, unknown>>;
};

type GenerationFailureContext = {
  reasonCode?: string | null;
  providerState?: string | null;
  pollAttempt?: number | null;
  noMediaAttempt?: number | null;
  elapsedMs?: number | null;
  maxWaitMs?: number | null;
};

/**
 * Returns output-lifecycle helpers used by AI Studio state orchestration.
 */
export const useAiStudioOutputLifecycle = ({
  outputs,
  setOutputs,
  updateOutputByIdFast,
  findOutputByIdFast,
  activeOutputId,
  setActiveOutputId,
  pendingAutoSavesRef,
}: UseAiStudioOutputLifecycleParams) => {
  const outputsRef = useRef<StudioOutput[]>([]);
  const outputByIdRef = useRef<Record<string, StudioOutput>>({});
  const outputIndexByIdRef = useRef<Record<string, number>>({});
  const staleOutputLifecycleRef = useRef<OutputLifecycleMap>({});
  const hasOutputs = outputs.length > 0;
  const hasStaleOutputSweepCandidates = outputs.some(hasStaleOutputCleanupCandidate);

  useEffect(() => {
    outputsRef.current = outputs;
    const nextById: Record<string, StudioOutput> = {};
    const nextIndexById: Record<string, number> = {};
    outputs.forEach((item, index) => {
      nextById[item.id] = item;
      nextIndexById[item.id] = index;
    });
    outputByIdRef.current = nextById;
    outputIndexByIdRef.current = nextIndexById;
  }, [outputs]);

  const updateOutputById = useCallback(
    (id: string, updater: (item: StudioOutput) => StudioOutput) => {
      if (updateOutputByIdFast) {
        updateOutputByIdFast(id, updater);
        return;
      }
      setOutputs((prev) => {
        const targetIndex = outputIndexByIdRef.current[id] ?? -1;
        if (targetIndex === -1) return prev;
        const current = prev[targetIndex];
        if (!current) return prev;
        const nextItem = updater(current);
        if (nextItem === current) return prev;
        const next = [...prev];
        next[targetIndex] = nextItem;
        return next;
      });
    },
    [setOutputs, updateOutputByIdFast]
  );

  const sweepStaleOutputs = useCallback(() => {
    const now = Date.now();
    const lifecycle = staleOutputLifecycleRef.current;
    const outputsSnapshot = outputsRef.current;
    const cleanup = evaluateStaleOutputCleanup(outputsSnapshot, lifecycle, now, {
      submitStartTimeoutMs: SUBMIT_START_TIMEOUT_MS,
      directRequestTimeoutMs: DIRECT_REQUEST_TIMEOUT_MS,
      taskBackedLoadingTimeoutMs: TASK_BACKED_LOADING_TIMEOUT_MS,
      queueWaitTimeoutMs: QUEUE_WAIT_TIMEOUT_MS,
      autoFailedRetentionMs: AUTO_FAILED_OUTPUT_REMOVAL_MS,
    });
    const staleLoadingSet = new Set(cleanup.staleLoadingIds);
    const submitStartTimeoutSet = new Set(cleanup.submitStartTimeoutIds);
    const directRequestTimeoutSet = new Set(cleanup.directRequestTimeoutIds);
    const taskBackedTimeoutSet = new Set(cleanup.taskBackedTimeoutIds);
    const queueWaitTimeoutSet = new Set(cleanup.queueWaitTimeoutIds);
    const removableSet = new Set(cleanup.removableIds);
    const locallyFailedSet = new Set([
      ...submitStartTimeoutSet,
      ...directRequestTimeoutSet,
      ...taskBackedTimeoutSet,
    ]);

    locallyFailedSet.forEach((id) => {
      const existing = cleanup.nextLifecycle[id] ?? {};
      cleanup.nextLifecycle[id] = {
        ...existing,
        autoFailedAtMs: now,
      };
      delete cleanup.nextLifecycle[id].pendingSinceMs;
    });

    staleOutputLifecycleRef.current = cleanup.nextLifecycle;

    if (!staleLoadingSet.size && !removableSet.size) return;

    for (const staleOutput of outputsSnapshot) {
      if (!staleLoadingSet.has(staleOutput.id)) continue;
      const isSubmitStartTimeout = submitStartTimeoutSet.has(staleOutput.id);
      const isDirectRequestTimeout = directRequestTimeoutSet.has(staleOutput.id);
      const isTaskBackedTimeout = taskBackedTimeoutSet.has(staleOutput.id);
      void reportAppError({
        source: isSubmitStartTimeout
          ? "fal_submit_not_started"
          : isDirectRequestTimeout
            ? "generation.direct_request_timeout"
            : isTaskBackedTimeout
              ? "generation.task_backed_stale_timeout"
              : "generation.queue_wait_timeout",
        scope: "generation",
        severity: "high",
        message: isSubmitStartTimeout
          ? "Generation failed to start before task initialization."
          : isDirectRequestTimeout
            ? "Generation timed out before a direct result was returned."
            : isTaskBackedTimeout
              ? "Generation stopped making progress after provider handoff."
              : "Generation timed out while waiting in queue.",
        route: currentRoute(),
        metadata: {
          output_id: staleOutput.id,
          model: staleOutput.model,
          model_id: staleOutput.modelId ?? null,
          provider: staleOutput.provider ?? null,
          task_id: staleOutput.taskId ?? null,
          queue_state: staleOutput.queueState ?? null,
          failure_reason_code: isSubmitStartTimeout
            ? "SUBMIT_START_TIMEOUT"
            : isDirectRequestTimeout
              ? "DIRECT_REQUEST_TIMEOUT"
              : isTaskBackedTimeout
                ? "TASK_BACKED_TIMEOUT"
                : "QUEUE_WAIT_TIMEOUT",
        },
      });
    }

    setOutputs((prev) => {
      let changed = false;
      const next: StudioOutput[] = [];

      prev.forEach((item) => {
        if (removableSet.has(item.id)) {
          changed = true;
          return;
        }
        if (!staleLoadingSet.has(item.id)) {
          next.push(item);
          return;
        }
        const isQueueWaitTimeout = queueWaitTimeoutSet.has(item.id);
        changed = true;
        if (isQueueWaitTimeout) {
          next.push({
            ...item,
            status: "ready",
            taskState: item.taskState === "pending" ? "pending" : "running",
            timestamp:
              item.timestamp === SERVER_RECOVERY_PENDING_TIMESTAMP
                ? item.timestamp
                : SERVER_RECOVERY_PENDING_TIMESTAMP,
            errorMessage: null,
            errorMessageShort: null,
            errorDetail: null,
          });
          return;
        }
        next.push({
          ...item,
          status: "ready",
          taskState: "fail",
          timestamp: taskBackedTimeoutSet.has(item.id) ? "Generation timed out" : "Failed to start",
          errorMessage: taskBackedTimeoutSet.has(item.id)
            ? "Generation timed out. Please retry."
            : "Generation failed to start. Please retry.",
          errorMessageShort: taskBackedTimeoutSet.has(item.id)
            ? "Generation timed out."
            : "Generation failed to start.",
          errorDetail: taskBackedTimeoutSet.has(item.id)
            ? "The generation stopped making progress after provider handoff. Please retry."
            : "The generation did not receive a provider task id. Please retry.",
        });
      });

      return changed ? next : prev;
    });

    if (removableSet.size) {
      setActiveOutputId((prev) => (prev && removableSet.has(prev) ? null : prev));
      removableSet.forEach((id) => {
        delete pendingAutoSavesRef.current[id];
      });
    }
  }, [pendingAutoSavesRef, setActiveOutputId, setOutputs]);

  useEffect(() => {
    // Run one immediate pass on mount; steady-state stale detection stays on the timed cadence
    // so hot generation sessions do not rescan the full output list on every output mutation.
    sweepStaleOutputs();
  }, [sweepStaleOutputs]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hasOutputs || !hasStaleOutputSweepCandidates) return;
    const timeoutId = window.setInterval(sweepStaleOutputs, STALE_OUTPUT_SWEEP_INTERVAL_MS);
    return () => window.clearInterval(timeoutId);
  }, [hasOutputs, hasStaleOutputSweepCandidates, sweepStaleOutputs]);

  const findOutputById = useCallback(
    (id: string) => {
      if (findOutputByIdFast) return findOutputByIdFast(id);
      return outputByIdRef.current[id] ?? null;
    },
    [findOutputByIdFast]
  );

  const deleteOutput = useCallback(
    (id: string) => {
      delete pendingAutoSavesRef.current[id];
      delete staleOutputLifecycleRef.current[id];
      setOutputs((prev) => prev.filter((item) => item.id !== id));
      if (activeOutputId === id) {
        setActiveOutputId(null);
      }
    },
    [activeOutputId, pendingAutoSavesRef, setActiveOutputId, setOutputs]
  );

  const notifyGenerationFailure = useCallback(
    (outputId: string, message: string, detail?: string, context?: GenerationFailureContext) => {
      delete pendingAutoSavesRef.current[outputId];
      const outputContext = findOutputById(outputId);
      const safeMessage = normalizeErrorText(message, {
        fallback: "Generation failed",
        maxLength: 140,
      });
      const safeDetail = normalizeErrorText(detail ?? message, {
        fallback: safeMessage,
        maxLength: 320,
      });
      const explicitContentFailure = normalizeExplicitContentFailure({
        message: safeMessage,
        detail: safeDetail,
      });
      const resolvedMessage = explicitContentFailure?.errorMessage ?? safeMessage;
      const resolvedShortMessage = explicitContentFailure?.errorMessageShort ?? safeMessage;
      const resolvedDetail = explicitContentFailure?.errorDetail ?? safeDetail;
      updateOutputById(outputId, (item) => {
        if (
          item.taskState === "fail" &&
          item.status === "ready" &&
          item.timestamp === "Failed" &&
          item.errorMessage === resolvedMessage &&
          item.errorMessageShort === resolvedShortMessage &&
          item.errorDetail === resolvedDetail
        ) {
          return item;
        }
        return {
          ...item,
          taskState: "fail",
          status: "ready",
          timestamp: "Failed",
          errorMessage: resolvedMessage,
          errorMessageShort: resolvedShortMessage,
          errorDetail: resolvedDetail,
        };
      });
      void reportAppError({
        source: "generation.workflow_failure",
        scope: "generation",
        severity: "high",
        message: resolvedMessage,
        route: currentRoute(),
        metadata: {
          output_id: outputId,
          detail: resolvedDetail,
          model: outputContext?.model ?? null,
          model_id: outputContext?.modelId ?? null,
          provider: outputContext?.provider ?? null,
          task_id: outputContext?.taskId ?? null,
          task_state: outputContext?.taskState ?? null,
          generation_id: outputContext?.generationId ?? null,
          failure_reason_code: context?.reasonCode ?? null,
          provider_state: context?.providerState ?? null,
          poll_attempt: context?.pollAttempt ?? null,
          no_media_attempt: context?.noMediaAttempt ?? null,
          elapsed_ms: context?.elapsedMs ?? null,
          max_wait_ms: context?.maxWaitMs ?? null,
        },
      });
    },
    [findOutputById, pendingAutoSavesRef, updateOutputById]
  );

  const updateOutputPrompt = useCallback(
    (id: string, promptText: string) => {
      const nextPrompt = promptText.trim();
      if (!nextPrompt) return;
      updateOutputById(id, (item) => ({
        ...item,
        prompt: nextPrompt,
        previewText: item.previewText ? nextPrompt : item.previewText,
        timestamp: "Edited",
      }));
    },
    [updateOutputById]
  );

  return {
    updateOutputById,
    findOutputById,
    deleteOutput,
    notifyGenerationFailure,
    updateOutputPrompt,
  };
};
