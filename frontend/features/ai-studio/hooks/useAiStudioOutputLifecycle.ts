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
const AUTO_FAILED_OUTPUT_REMOVAL_MS = 2 * 60 * 1000;
const STALE_OUTPUT_SWEEP_INTERVAL_MS = 15_000;

const currentRoute = (): string | null => {
  if (typeof window === "undefined") return null;
  return `${window.location.pathname}${window.location.search}`.slice(0, 300);
};

type UseAiStudioOutputLifecycleParams = {
  outputs: StudioOutput[];
  setOutputs: Dispatch<SetStateAction<StudioOutput[]>>;
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
  activeOutputId,
  setActiveOutputId,
  pendingAutoSavesRef,
  setUiError,
}: UseAiStudioOutputLifecycleParams) => {
  const outputsRef = useRef<StudioOutput[]>([]);
  const staleOutputLifecycleRef = useRef<OutputLifecycleMap>({});

  useEffect(() => {
    outputsRef.current = outputs;
  }, [outputs]);

  const updateOutputById = useCallback(
    (id: string, updater: (item: StudioOutput) => StudioOutput) => {
      setOutputs((prev) => prev.map((item) => (item.id === id ? updater(item) : item)));
    },
    [setOutputs]
  );

  const sweepStaleOutputs = useCallback(() => {
    const now = Date.now();
    const lifecycle = staleOutputLifecycleRef.current;
    const outputsSnapshot = outputsRef.current;
    const cleanup = evaluateStaleOutputCleanup(outputsSnapshot, lifecycle, now, {
      loadingTimeoutMs: STALE_LOADING_TIMEOUT_MS,
      autoFailedRetentionMs: AUTO_FAILED_OUTPUT_REMOVAL_MS,
    });
    const staleLoadingSet = new Set(cleanup.staleLoadingIds);
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
      void reportAppError({
        source: "generation.stale_timeout",
        scope: "generation",
        severity: "high",
        message: "Generation timed out before preview was ready.",
        route: currentRoute(),
        metadata: {
          output_id: staleOutput.id,
          model: staleOutput.model,
          model_id: staleOutput.modelId ?? null,
          provider: staleOutput.provider ?? null,
          task_id: staleOutput.taskId ?? null,
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
        changed = true;
        next.push({
          ...item,
          status: "ready",
          taskState: "fail",
          timestamp: "Timed out",
          errorMessage: "Generation timed out before preview was ready.",
          errorMessageShort: "Generation timed out.",
          errorDetail:
            "This preview remained unresolved for several minutes and was marked as failed.",
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
    (id: string) => outputsRef.current.find((item) => item.id === id) ?? null,
    []
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
      setOutputs((prev) =>
        prev.map((item) => {
          if (item.id !== outputId) return item;
          return {
            ...item,
            taskState: "fail",
            status: "ready",
            timestamp: "Failed",
            errorMessage: safeMessage,
            errorMessageShort: safeMessage,
            errorDetail: safeDetail,
          };
        })
      );
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
    [findOutputById, pendingAutoSavesRef, setOutputs, setUiError]
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
