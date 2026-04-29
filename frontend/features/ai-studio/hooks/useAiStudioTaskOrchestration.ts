/**
 * AI Studio task orchestration hook.
 * Owns generation polling lifecycle, status retry handling, and task-submission wiring.
 */
import { useCallback, useEffect, useRef } from "react";
import { BRIA_BACKGROUND_REMOVE_MODEL_ID } from "../logic/editPromptPolicy";
import { resolveVisibleGenerationReconcile } from "../logic/generatedMediaAuthority";
import { resolveNormalizedOutputDelivery } from "../logic/referenceGridMedia";
import { resolveTaskPollingProvider, type Provider } from "../logic/stateParsers";
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
  setPrimaryEditReferenceImageUrl?: (url: string | null) => void;
  projectId?: string | null;
};

const VISIBLE_GENERATION_SCAN_INTERVAL_MS = 4_000;
const VISIBLE_GENERATION_MIN_RECHECK_MS = 2_500;
const VISIBLE_GENERATION_MAX_CONCURRENT = 3;

const isDocumentVisible = (): boolean =>
  typeof document === "undefined" || document.visibilityState === "visible";

const hasSettledOutputLifecycle = (output: StudioOutput): boolean =>
  output.taskState === "success" || output.taskState === "fail";

const isOutputLifecycleInFlight = (output: StudioOutput): boolean =>
  output.taskState === "pending" || output.taskState === "running";

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
  if (hasSettledOutputLifecycle(output)) return false;
  if (!isOutputLifecycleInFlight(output) && hasSettledOutputPayload(output)) return false;
  const generationId = typeof output.generationId === "string" ? output.generationId.trim() : "";
  const taskId = typeof output.taskId === "string" ? output.taskId.trim() : "";
  return generationId.length > 0 || taskId.length > 0;
};

/**
 * Returns task submission and polling handlers used by AI Studio state orchestration.
 */
export const useAiStudioTaskOrchestration = ({
  taskSubmissionConfig,
  outputs = [],
  findOutputById,
  setPrimaryEditReferenceImageUrl,
  projectId = null,
}: UseAiStudioTaskOrchestrationParams) => {
  const { updateOutputById, notifyGenerationFailure, setUiNotice, setOutputs } =
    taskSubmissionConfig;
  const visibleGenerationCandidatesRef = useRef<StudioOutput[]>([]);
  const visibleGenerationInFlightRef = useRef<Record<string, boolean>>({});
  const visibleGenerationLastCheckedAtRef = useRef<Record<string, number>>({});
  const visibleGenerationSignatureRef = useRef<string>("");
  const abandonedOutputIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
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
            ...(projectId ? { projectId } : {}),
          });
          if (!visibleGeneration) return;
          if (abandonedOutputIdsRef.current.has(output.id)) return;
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
              previewPosterUrl: visibleGeneration.previewPosterUrl ?? item.previewPosterUrl ?? null,
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
  }, [findOutputById, handleGenerationSuccess, projectId, updateOutputById]);

  const { startPollingTask, clearPollTimer } = useAiStudioTasks({
    updateOutputById,
    findOutputById,
    notifyGenerationFailure,
    onGenerationSuccess: handleGenerationSuccess,
    onGenerationFailure: handleGenerationFailure,
    onPollingOutputLookupHardStop: handlePollingOutputLookupHardStop,
    projectId,
  });

  const submitTask = useAiStudioTaskSubmission({
    ...taskSubmissionConfig,
    startPollingTask,
    isOutputAbandoned: (outputId) => abandonedOutputIdsRef.current.has(outputId),
    markOutputSubmissionActive: (outputId) => abandonedOutputIdsRef.current.delete(outputId),
  });

  const abandonTaskOutput = useCallback(
    (outputId: string) => {
      const normalizedOutputId = outputId.trim();
      if (!normalizedOutputId) return;
      abandonedOutputIdsRef.current.add(normalizedOutputId);
      delete visibleGenerationInFlightRef.current[normalizedOutputId];
      delete visibleGenerationLastCheckedAtRef.current[normalizedOutputId];
      clearPollTimer(normalizedOutputId);
    },
    [clearPollTimer]
  );

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
      const provider = resolveTaskPollingProvider({
        provider: output.provider,
        modelId: output.modelId,
      });
      if (!provider) {
        setUiNotice("Unable to retry status because this generation has no active polling route.");
        return;
      }
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
    abandonTaskOutput,
  };
};
