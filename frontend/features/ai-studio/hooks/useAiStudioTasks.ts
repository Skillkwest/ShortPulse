/**
 * Side-effectful task runner for AI Studio generations.
 * Handles submit + polling orchestration per provider, isolated from UI state.
 */
import { useCallback, useRef } from "react";
import {
  submitFalFlux2,
  submitFalFlux2Edit,
  submitFalFlux2ProEdit,
  submitFalFlux2Max,
  submitFalFlux2Pro,
  submitFalKlingV26Text,
  submitFalKlingV25,
  submitFalKlingV25Text,
  submitFalSeedance,
  submitFalSeedream,
  submitFalVeo,
  submitImagen4Fast,
  submitFalNanoBanana,
  submitFalNanoBananaEdit,
  submitFalNanoBananaPro,
  submitFalNanoBananaProEdit,
  submitFalSoraPro,
  fetchFalFlux2MaxStatus,
  fetchFalFlux2ProStatus,
  fetchFalFlux2Status,
  fetchFalFlux2KleinStatus,
  fetchFalFlux1SchnellStatus,
  fetchFalFlux2EditStatus,
  fetchFalFlux2ProEditStatus,
  fetchFalKlingStatus,
  fetchFalKlingV25Status,
  fetchFalNanoBananaStatus,
  fetchFalNanoBananaEditStatus,
  fetchFalNanoBananaProStatus,
  fetchFalNanoBananaProEditStatus,
  fetchFalStatus,
  fetchImagen4FastStatus,
  fetchFalSoraStatus,
  fetchFalSeedanceStatus,
  fetchFalSeedreamStatus,
  fetchFalVeoStatus,
  fetchFalKlingV26Status,
} from "../../../lib/falClient";
import { createKeiTask, fetchKeiTaskStatus } from "../../../lib/keiClient";
import { extractFalMediaUrls, extractResultUrls, Provider } from "../logic/stateParsers";
import { StudioOutput } from "../types";

type TaskCallbacks = {
  updateOutputById: (id: string, updater: (item: StudioOutput) => StudioOutput) => void;
  notifyGenerationFailure: (outputId: string, message: string) => void;
  setUiError: (message: string | null) => void;
};

const fetchStatusByProvider = async (provider: Provider, taskId: string) => {
  switch (provider) {
    case "fal":
      return fetchFalStatus(taskId);
    case "fal-flux1-schnell":
      return fetchFalFlux1SchnellStatus(taskId);
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
    case "fal-flux2-max":
      return fetchFalFlux2MaxStatus(taskId);
    case "fal-imagen4-fast":
      return fetchImagen4FastStatus(taskId);
    case "fal-kling":
      return fetchFalKlingStatus(taskId);
    case "fal-kling-25":
      return fetchFalKlingV25Status(taskId);
    case "fal-kling-26":
      return fetchFalKlingV26Status(taskId);
    case "fal-seedance":
      return fetchFalSeedanceStatus(taskId);
    case "fal-sora":
      return fetchFalSoraStatus(taskId);
    case "fal-seedream":
      return fetchFalSeedreamStatus(taskId);
    case "fal-veo":
      return fetchFalVeoStatus(taskId);
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

export function useAiStudioTasks({ updateOutputById, notifyGenerationFailure, setUiError }: TaskCallbacks) {
  const pollTimersRef = useRef<Record<string, number>>({});

  const clearPollTimer = useCallback((outputId: string) => {
    const timeoutId = pollTimersRef.current[outputId];
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      delete pollTimersRef.current[outputId];
    }
  }, []);

  const startPollingTask = useCallback(
    (taskId: string, outputId: string, attempt = 0, provider: Provider = "kei") => {
      const delay = Math.min(6000, 1200 + attempt * 400);
      const timeoutId = window.setTimeout(async () => {
        try {
          const status = await fetchStatusByProvider(provider, taskId);
          const stateRaw =
            status?.status?.toString().toLowerCase() ??
            status?.state?.toString().toLowerCase() ??
            "pending";
          const state = stateRaw === "succeeded" ? "success" : stateRaw;

          if (state === "success" || state === "completed") {
            const allUrls = extractMediaByProvider(provider, status);
            const hasMedia = allUrls.length > 0;
            const shouldRetryForMedia = !hasMedia && attempt < 3;
            if (shouldRetryForMedia) {
              updateOutputById(outputId, (item) => ({
                ...item,
                taskState: "running",
                status: "processing",
                timestamp: "Waiting for media...",
              }));
              pollTimersRef.current[outputId] = window.setTimeout(
                () => startPollingTask(taskId, outputId, attempt + 1, provider),
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
            }));
            clearPollTimer(outputId);
            return;
          }

          if (state === "fail" || state === "error") {
            const failureMessage =
              status?.failMsg ||
              status?.failCode ||
              status?.error ||
              "Generation failed";
            notifyGenerationFailure(outputId, failureMessage);
            clearPollTimer(outputId);
            return;
          }

          updateOutputById(outputId, (item) => ({
            ...item,
            taskState: (state as StudioOutput["taskState"]) ?? "running",
            timestamp: "Processing...",
          }));
          pollTimersRef.current[outputId] = window.setTimeout(
            () => startPollingTask(taskId, outputId, attempt + 1, provider),
            delay,
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to check status";
          if (attempt >= 4 || message.includes("404")) {
            notifyGenerationFailure(outputId, message);
            clearPollTimer(outputId);
            return;
          }
          pollTimersRef.current[outputId] = window.setTimeout(
            () => startPollingTask(taskId, outputId, attempt + 1, provider),
            delay,
          );
        }
      }, delay);
      pollTimersRef.current[outputId] = timeoutId;
    },
    [clearPollTimer, notifyGenerationFailure, updateOutputById],
  );

  return {
    startPollingTask,
    clearPollTimer,
    pollTimersRef,
  };
}
