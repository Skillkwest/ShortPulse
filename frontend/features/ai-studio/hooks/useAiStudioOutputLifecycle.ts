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
import { evaluateStaleOutputCleanup, type OutputLifecycleMap } from "../logic/staleOutputCleanup";
import type { StudioOutput } from "../types";

const STALE_LOADING_TIMEOUT_MS = 3 * 60 * 1000;
const SUBMIT_START_TIMEOUT_MS = 12_000;
const QUEUE_WAIT_TIMEOUT_MS = 20 * 60 * 1000;
const AUTO_FAILED_OUTPUT_REMOVAL_MS = 2 * 60 * 1000;
const STALE_OUTPUT_SWEEP_INTERVAL_MS = 15_000;

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
  setUiError: Dispatch<SetStateAction<string | null>>;
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
  setUiError,
}: UseAiStudioOutputLifecycleParams) => {
  const outputsRef = useRef<StudioOutput[]>([]);
  const outputByIdRef = useRef<Record<string, StudioOutput>>({});
  const outputIndexByIdRef = useRef<Record<string, number>>({});
  const staleOutputLifecycleRef = useRef<OutputLifecycleMap>({});

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
      loadingTimeoutMs: STALE_LOADING_TIMEOUT_MS,
      submitStartTimeoutMs: SUBMIT_START_TIMEOUT_MS,
      queueWaitTimeoutMs: QUEUE_WAIT_TIMEOUT_MS,
      autoFailedRetentionMs: AUTO_FAILED_OUTPUT_REMOVAL_MS,
    });
    const staleLoadingSet = new Set(cleanup.staleLoadingIds);
    const submitStartTimeoutSet = new Set(cleanup.submitStartTimeoutIds);
    const queueWaitTimeoutSet = new Set(cleanup.queueWaitTimeoutIds);
    const removableSet = new Set(cleanup.removableIds);

    staleLoadingSet.forEach((id) => {
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
      const isQueueWaitTimeout = queueWaitTimeoutSet.has(staleOutput.id);
      void reportAppError({
        source: isSubmitStartTimeout
          ? "fal_submit_not_started"
          : isQueueWaitTimeout
            ? "generation.queue_wait_timeout"
            : "generation.stale_timeout",
        scope: "generation",
        severity: "high",
        message: isSubmitStartTimeout
          ? "Generation failed to start before task initialization."
          : isQueueWaitTimeout
            ? "Generation timed out while waiting in queue."
            : "Generation timed out before preview was ready.",
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
            : isQueueWaitTimeout
              ? "QUEUE_WAIT_TIMEOUT"
              : "STALE_LOADING_TIMEOUT",
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
        const isSubmitStartTimeout = submitStartTimeoutSet.has(item.id);
        const isQueueWaitTimeout = queueWaitTimeoutSet.has(item.id);
        changed = true;
        next.push({
          ...item,
          status: "ready",
          taskState: "fail",
          timestamp: isSubmitStartTimeout
            ? "Failed to start"
            : isQueueWaitTimeout
              ? "Queue timed out"
              : "Timed out",
          errorMessage: isSubmitStartTimeout
            ? "Generation failed to start. Please retry."
            : isQueueWaitTimeout
              ? "Generation queue timed out. Please retry."
              : "Generation timed out before preview was ready.",
          errorMessageShort: isSubmitStartTimeout
            ? "Generation failed to start."
            : isQueueWaitTimeout
              ? "Generation queue timed out."
              : "Generation timed out.",
          errorDetail: isSubmitStartTimeout
            ? "The generation did not receive a provider task id. Please retry."
            : isQueueWaitTimeout
              ? "This generation stayed queued too long before provider dispatch."
              : "This preview remained unresolved for several minutes and was marked as failed.",
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
    sweepStaleOutputs();
  }, [outputs, sweepStaleOutputs]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const timeoutId = window.setInterval(sweepStaleOutputs, STALE_OUTPUT_SWEEP_INTERVAL_MS);
    return () => window.clearInterval(timeoutId);
  }, [sweepStaleOutputs]);

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
      updateOutputById(outputId, (item) => {
        if (
          item.taskState === "fail" &&
          item.status === "ready" &&
          item.timestamp === "Failed" &&
          item.errorMessage === safeMessage &&
          item.errorMessageShort === safeMessage &&
          item.errorDetail === safeDetail
        ) {
          return item;
        }
        return {
          ...item,
          taskState: "fail",
          status: "ready",
          timestamp: "Failed",
          errorMessage: safeMessage,
          errorMessageShort: safeMessage,
          errorDetail: safeDetail,
        };
      });
      const label = outputContext?.model ?? outputContext?.modelId ?? "Generation";
      const detailMessage = safeDetail;
      setUiError(
        detailMessage ? `${label} failed: ${detailMessage}` : `${label} failed to complete.`
      );
      void reportAppError({
        source: "generation.workflow_failure",
        scope: "generation",
        severity: "high",
        message: safeMessage,
        route: currentRoute(),
        metadata: {
          output_id: outputId,
          detail: safeDetail,
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
    [findOutputById, pendingAutoSavesRef, setUiError, updateOutputById]
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
