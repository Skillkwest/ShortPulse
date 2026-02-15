/**
 * Side-effectful task runner for AI Studio generations.
 * Handles submit + polling orchestration per provider, isolated from UI state.
 */
import { useCallback, useEffect, useRef } from "react";
import {
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
import { addBreadcrumb } from "../../../lib/clientBreadcrumbs";
import { fetchKeiTaskStatus } from "../../../lib/keiClient";
import { extractFalMediaUrls, extractResultUrls, Provider } from "../logic/stateParsers";
import { StudioOutput } from "../types";

type GenerationFailureReason =
  | "no_media_after_terminal_success"
  | "poll_timeout"
  | "provider_error"
  | "status_poll_error";

type TaskCallbacks = {
  updateOutputById: (id: string, updater: (item: StudioOutput) => StudioOutput) => void;
  notifyGenerationFailure: (outputId: string, message: string, detail?: string) => void;
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
};

type PollStatus = {
  status?: unknown;
  state?: unknown;
  data?: { status?: unknown; result?: { status?: unknown } };
  result?: { status?: unknown };
  output?: { status?: unknown };
  resultJson?: unknown;
  raw?: unknown;
  error?: unknown;
  failMsg?: unknown;
  failCode?: unknown;
  message?: unknown;
  statusMessage?: unknown;
  detail?: unknown;
};

const longRunningVideoProviders = new Set<Provider>([
  "fal-kling",
  "fal-kling-3",
  "fal-seedance",
  "fal-seedance-i2v",
  "fal-sora",
  "fal-veo",
  "fal-veo-i2v",
]);

const nonTerminalStates = new Set([
  "pending",
  "queued",
  "in_queue",
  "in-progress",
  "in_progress",
  "running",
  "processing",
  "starting",
  "submitted",
  "created",
]);

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
  if (
    lower.includes("content") &&
    (lower.includes("policy") || lower.includes("checker") || lower.includes("flagged"))
  ) {
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
  return /error|fail|denied|invalid|timed out|timeout|insufficient|reject|policy|unsafe|nsfw/i.test(
    value
  );
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

const extractMediaByProvider = (provider: Provider, status: PollStatus) => {
  if (provider === "kei") {
    const keiResultJson =
      typeof status?.resultJson === "string"
        ? status.resultJson
        : status?.resultJson && typeof status.resultJson === "object"
          ? (status.resultJson as Record<string, unknown>)
          : null;
    const resultUrls = extractResultUrls(keiResultJson, status?.raw);
    return resultUrls;
  }
  return extractFalMediaUrls(status);
};

export function useAiStudioTasks({
  updateOutputById,
  notifyGenerationFailure,
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
    function pollTask(
      taskId: string,
      outputId: string,
      attempt = 0,
      provider: Provider = "fal",
      startedAt = Date.now(),
      noMediaAttempt = 0
    ) {
      const elapsedMs = Date.now() - startedAt;
      const maxWaitMs = longRunningVideoProviders.has(provider) ? 20 * 60 * 1000 : 8 * 60 * 1000;
      if (elapsedMs > maxWaitMs) {
        const timeoutMessage = "Timed out waiting for provider result.";
        notifyGenerationFailure(outputId, timeoutMessage, timeoutMessage);
        if (onGenerationFailure) {
          onGenerationFailure({
            outputId,
            taskId,
            provider,
            message: timeoutMessage,
            reasonCode: "poll_timeout",
          });
        }
        clearPollTimer(outputId);
        return;
      }

      const delay = Math.min(8000, 1200 + attempt * 600);
      const timeoutId = window.setTimeout(async () => {
        try {
          const status = (await fetchStatusByProvider(provider, taskId)) as PollStatus;
          const stateRaw =
            status?.status?.toString().toLowerCase() ??
            status?.state?.toString().toLowerCase() ??
            status?.data?.status?.toString().toLowerCase() ??
            status?.result?.status?.toString().toLowerCase() ??
            status?.output?.status?.toString().toLowerCase() ??
            status?.data?.result?.status?.toString().toLowerCase() ??
            "pending";
          const state = stateRaw === "succeeded" ? "success" : stateRaw;
          const hasExplicitState =
            status?.status != null ||
            status?.state != null ||
            status?.data?.status != null ||
            status?.result?.status != null ||
            status?.output?.status != null ||
            status?.data?.result?.status != null;

          const allUrls = extractMediaByProvider(provider, status);
          const hasMedia = allUrls.length > 0;
          const isTerminalSuccess = state === "success" || state === "completed";
          // Fal capture/debit happens in status endpoints on terminal states, so avoid
          // short-circuiting early success when provider explicitly reports in-progress.
          const canUseMediaShortcut =
            provider === "kei" || !hasExplicitState || !nonTerminalStates.has(state);

          if (isTerminalSuccess || (hasMedia && canUseMediaShortcut)) {
            // Provider may report terminal success before media URLs are materialized.
            // Track a dedicated "no media yet" retry budget instead of using total poll attempts.
            const maxNoMediaAttempts =
              provider === "kei" ? 10 : longRunningVideoProviders.has(provider) ? 30 : 20;
            const shouldRetryForMedia = !hasMedia && noMediaAttempt < maxNoMediaAttempts;
            if (shouldRetryForMedia) {
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
                  },
                });
              }
              updateOutputById(outputId, (item) => ({
                ...item,
                taskState: "running",
                status: "ready",
                timestamp: "Finalizing media...",
              }));
              pollTimersRef.current[outputId] = window.setTimeout(
                () =>
                  pollTask(taskId, outputId, attempt + 1, provider, startedAt, noMediaAttempt + 1),
                delay
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
              notifyGenerationFailure(outputId, failureMessage, failureMessage);
              updateOutputById(outputId, (item) => ({
                ...item,
                status: "ready",
                taskState: "fail",
                errorMessage: failureMessage,
                errorMessageShort: "No media returned.",
                errorDetail: failureMessage,
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
              clearPollTimer(outputId);
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
          const isErrorState = state === "fail" || state === "error" || state === "failed";

          const hasErrorField =
            Boolean(status?.error) || Boolean(status?.failMsg) || Boolean(status?.failCode);

          const isExplicitErrorStatus =
            String(status?.status ?? "").toLowerCase() === "error" ||
            String(status?.state ?? "").toLowerCase() === "error";

          const hasFailureMessage =
            looksLikeFailureMessage(status?.message) ||
            looksLikeFailureMessage(status?.statusMessage) ||
            looksLikeFailureMessage(status?.detail);

          // If ANY condition is true, treat as error
          if (isErrorState || hasErrorField || isExplicitErrorStatus || hasFailureMessage) {
            const rawFailureDetail =
              status?.failMsg ||
              status?.failCode ||
              status?.error ||
              (hasFailureMessage ? status?.message : null) ||
              status?.statusMessage ||
              status?.detail ||
              "Generation failed";
            const failureDetail =
              typeof rawFailureDetail === "string"
                ? rawFailureDetail
                : rawFailureDetail != null
                  ? String(rawFailureDetail)
                  : "Generation failed";

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
                reasonCode: "provider_error",
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
            () => pollTask(taskId, outputId, attempt + 1, provider, startedAt, 0),
            delay
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
                reasonCode: "status_poll_error",
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
            () => pollTask(taskId, outputId, attempt + 1, provider, startedAt, 0),
            delay
          );
        }
      }, delay);
      pollTimersRef.current[outputId] = timeoutId;
    },
    [
      clearPollTimer,
      notifyGenerationFailure,
      onGenerationFailure,
      onGenerationSuccess,
      updateOutputById,
    ]
  );

  useEffect(
    () => () => {
      Object.values(pollTimersRef.current).forEach((timeoutId) => window.clearTimeout(timeoutId));
      pollTimersRef.current = {};
    },
    []
  );

  return {
    startPollingTask,
    clearPollTimer,
    pollTimersRef,
  };
}
