/**
 * Side-effectful task runner for AI Studio generations.
 * Handles submit + polling orchestration per provider, isolated from UI state.
 */
import { useCallback, useEffect, useRef } from "react";
import {
  submitFalFlux2,
  submitFalFlux2Edit,
  submitFalFlux2ProEdit,
  submitFalFlux2Pro,
  submitFalSeedance,
  submitFalSeedream,
  submitFalVeo,
  submitFalNanoBanana,
  submitFalNanoBananaEdit,
  submitFalNanoBananaPro,
  submitFalNanoBananaProEdit,
  submitFalSoraPro,
  fetchFalFlux2ProStatus,
  fetchFalFlux2Status,
  fetchFalFlux2KleinStatus,
  fetchFalFlux2EditStatus,
  fetchFalFlux2ProEditStatus,
  fetchFalKlingStatus,
  fetchFalKlingV3ImageToVideoStatus,
  fetchFalNanoBananaStatus,
  fetchFalNanoBananaEditStatus,
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
import { createKeiTask, fetchKeiTaskStatus } from "../../../lib/keiClient";
import { extractFalMediaUrls, extractResultUrls, Provider } from "../logic/stateParsers";
import { StudioOutput } from "../types";

type TaskCallbacks = {
  updateOutputById: (id: string, updater: (item: StudioOutput) => StudioOutput) => void;
  notifyGenerationFailure: (outputId: string, message: string, detail?: string) => void;
  setUiError: (message: string | null) => void;
  onGenerationSuccess?: (payload: { outputId: string; taskId: string; provider: Provider; resultUrls: string[] }) => void;
  onGenerationFailure?: (payload: { outputId: string; taskId?: string; provider: Provider; message: string }) => void;
};

const condenseError = (message: string) => {
  if (!message) return "";
  const trimmed = message.trim();
  if (trimmed.length <= 80) return trimmed;
  const firstSentenceEnd = trimmed.indexOf(".");
  if (firstSentenceEnd > 0 && firstSentenceEnd < 80) {
    return trimmed.slice(0, firstSentenceEnd + 1);
  }
  return `${trimmed.slice(0, 77)}…`;
};

const createShortErrorMessage = (message: string) => {
  if (!message) return "Generation failed";
  const lower = message.toLowerCase();

  // Content policy violations
  if (lower.includes("content") && (lower.includes("policy") || lower.includes("checker") || lower.includes("flagged"))) {
    return "Content not allowed";
  }

  // Timeout errors
  if (lower.includes("timeout") || lower.includes("timed out")) {
    return "Request timed out";
  }

  // Rate limit errors
  if (lower.includes("rate limit") || lower.includes("too many")) {
    return "Rate limit exceeded";
  }

  // Generic failures
  if (message.length <= 35) return message;
  return `${message.slice(0, 32)}…`;
};

const looksLikeFailureMessage = (value: unknown): boolean => {
  if (typeof value !== "string") return false;
  return /error|fail|denied|invalid|timed out|timeout|insufficient|reject|policy|unsafe|nsfw/i.test(value);
};

const fetchStatusByProvider = async (provider: Provider, taskId: string) => {
  switch (provider) {
    case "fal":
      return fetchFalStatus(taskId);
    case "fal-flux2":
      return fetchFalFlux2Status(taskId);
    case "fal-flux2-klein":
      return fetchFalFlux2KleinStatus(taskId);
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
    case "fal-nano-banana-pro":
      return fetchFalNanoBananaProStatus(taskId);
    case "fal-nano-banana-pro-edit":
      return fetchFalNanoBananaProEditStatus(taskId);
    case "kei":
    default:
      return fetchKeiTaskStatus(taskId);
  }
};

const extractMediaByProvider = (provider: Provider, status: any) => {
  if (provider === "kei") {
    const resultUrls = extractResultUrls(status?.resultJson, status?.raw);
    return resultUrls;
  }
  return extractFalMediaUrls(status);
};

export function useAiStudioTasks({
  updateOutputById,
  notifyGenerationFailure,
  setUiError,
  onGenerationSuccess,
  onGenerationFailure,
}: TaskCallbacks) {
  const pollTimersRef = useRef<Record<string, number>>({});

  const clearPollTimer = useCallback((outputId: string) => {
    const timeoutId = pollTimersRef.current[outputId];
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      delete pollTimersRef.current[outputId];
    }
  }, []);

  const startPollingTask = useCallback(
    (taskId: string, outputId: string, attempt = 0, provider: Provider = "kei", startedAt = Date.now()) => {
      const elapsedMs = Date.now() - startedAt;
      const maxWaitMs = 8 * 60 * 1000; // 8 minutes
      if (elapsedMs > maxWaitMs) {
        notifyGenerationFailure(outputId, "Timed out waiting for provider result.", "Timed out waiting for provider result.");
        clearPollTimer(outputId);
        return;
      }

      const delay = Math.min(8000, 1200 + attempt * 600);
      const timeoutId = window.setTimeout(async () => {
        try {
          const status = (await fetchStatusByProvider(provider, taskId)) as any;
          const stateRaw =
            status?.status?.toString().toLowerCase() ??
            status?.state?.toString().toLowerCase() ??
            status?.data?.status?.toString().toLowerCase() ??
            status?.result?.status?.toString().toLowerCase() ??
            status?.output?.status?.toString().toLowerCase() ??
            status?.data?.result?.status?.toString().toLowerCase() ??
            "pending";
          const state = stateRaw === "succeeded" ? "success" : stateRaw;

          const allUrls = extractMediaByProvider(provider, status);
          const hasMedia = allUrls.length > 0;

          if (state === "success" || state === "completed" || hasMedia) {
            const shouldRetryForMedia = !hasMedia && attempt < 5;
            if (shouldRetryForMedia) {
              updateOutputById(outputId, (item) => ({
                ...item,
                taskState: "running",
                status: "ready",
                timestamp: "Waiting for media...",
              }));
              pollTimersRef.current[outputId] = window.setTimeout(
                () => startPollingTask(taskId, outputId, attempt + 1, provider, startedAt),
                delay,
              );
              return;
            }

            updateOutputById(outputId, (item) => ({
              ...item,
              taskState: "success",
              status: "ready",
              timestamp: "Just now",
              resultUrls: allUrls,
              previewUrl: allUrls[0] ?? item.previewUrl,
              errorMessage: null,
              errorMessageShort: null,
              errorDetail: null,
            }));
            if (onGenerationSuccess) {
              onGenerationSuccess({
                outputId,
                taskId,
                provider,
                resultUrls: allUrls,
              });
            }
            clearPollTimer(outputId);
            return;
          }

          // MULTIPLE ERROR DETECTION STRATEGIES
          const isErrorState =
            state === "fail" ||
            state === "error" ||
            state === "failed";

          const hasErrorField =
            Boolean(status?.error) ||
            Boolean(status?.failMsg) ||
            Boolean(status?.failCode);

          const isExplicitErrorStatus =
            String(status?.status ?? "").toLowerCase() === "error" ||
            String(status?.state ?? "").toLowerCase() === "error";

          const hasFailureMessage =
            looksLikeFailureMessage(status?.message) ||
            looksLikeFailureMessage(status?.statusMessage) ||
            looksLikeFailureMessage(status?.detail);

          // If ANY condition is true, treat as error
          if (isErrorState || hasErrorField || isExplicitErrorStatus || hasFailureMessage) {
            const failureDetail =
              status?.failMsg ||
              status?.failCode ||
              status?.error ||
              (hasFailureMessage ? status?.message : null) ||
              status?.statusMessage ||
              status?.detail ||
              "Generation failed";

            const failureMessage = condenseError(
              typeof status?.detail === "string" ? status?.detail : failureDetail
            );

            const shortMessage = createShortErrorMessage(failureMessage);

            notifyGenerationFailure(outputId, failureMessage, failureDetail);

            // Update output state to show error in UI
            updateOutputById(outputId, (item) => ({
              ...item,
              status: "ready",
              taskState: "fail",
              errorMessage: failureMessage,
              errorMessageShort: shortMessage,
            }));

            if (onGenerationFailure) {
              onGenerationFailure({
                outputId,
                taskId,
                provider,
                message: failureDetail,
              });
            }
            clearPollTimer(outputId);
            return;
          }

          updateOutputById(outputId, (item) => ({
            ...item,
            taskState: (state as StudioOutput["taskState"]) ?? "running",
            timestamp: "Processing...",
          }));
          pollTimersRef.current[outputId] = window.setTimeout(
            () => startPollingTask(taskId, outputId, attempt + 1, provider, startedAt),
            delay,
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to check status";
          const isNotFound = /404|not found/i.test(message);
          const notFoundMaxAttempts = 5;
          const maxAttempts = 30;
          if ((isNotFound && attempt >= notFoundMaxAttempts) || attempt >= maxAttempts) {
            notifyGenerationFailure(outputId, condenseError(message), message);
            if (onGenerationFailure) {
              onGenerationFailure({
                outputId,
                taskId,
                provider,
                message,
              });
            }
            clearPollTimer(outputId);
            return;
          }
          updateOutputById(outputId, (item) => ({
            ...item,
            taskState: "running",
            status: "ready",
            timestamp: "Retrying status...",
          }));
          pollTimersRef.current[outputId] = window.setTimeout(
            () => startPollingTask(taskId, outputId, attempt + 1, provider, startedAt),
            delay,
          );
        }
      }, delay);
      pollTimersRef.current[outputId] = timeoutId;
    },
    [clearPollTimer, notifyGenerationFailure, onGenerationFailure, onGenerationSuccess, updateOutputById],
  );

  useEffect(
    () => () => {
      Object.values(pollTimersRef.current).forEach((timeoutId) => window.clearTimeout(timeoutId));
      pollTimersRef.current = {};
    },
    [],
  );

  return {
    startPollingTask,
    clearPollTimer,
    pollTimersRef,
  };
}
