/**
 * Queue-status polling helper for queued Fal submissions.
 * Owns retry/backoff/timeout behavior until provider request id is dispatched.
 */
import { addBreadcrumb } from "../../../../lib/clientBreadcrumbs";
import {
  fetchFalQueueStatus,
  type FalQueuedSubmitResponse,
  type FalQueueStatusResponse,
} from "../../../../lib/falClient";
import type { SubmissionPatch } from "./types";
import { normalizeProviderForPolling, type Provider } from "../../logic/stateParsers";
import { applyQueuedSubmissionPatch } from "./outputLifecyclePatches";
import type { StudioOutput, ToolId } from "../../types";

export const QUEUE_STATUS_MAX_WAIT_MS = 30 * 60 * 1000;
export const QUEUE_STATUS_NOT_FOUND_MAX_RETRIES = 8;
export const clampQueuePollMs = (value: number) =>
  Math.max(500, Math.min(10000, Math.trunc(value)));
const HIDDEN_TAB_QUEUE_STATUS_RETRY_MS = 10_000;

const isDocumentVisible = (): boolean =>
  typeof document === "undefined" || document.visibilityState === "visible";

type NumberMapRef = {
  current: Record<string, number>;
};

type StartQueuedStatusPollingParams = {
  outputId: string;
  provider: Provider;
  finalModel: string;
  effectiveTool: ToolId | null;
  queuedResponse: FalQueuedSubmitResponse;
  patch: SubmissionPatch;
  queueStatusTimersRef: NumberMapRef;
  queueStatusSessionRef: NumberMapRef;
  clearQueueStatusPolling: (outputId: string) => void;
  updateOutputById: (id: string, updater: (item: StudioOutput) => StudioOutput) => void;
  notifyGenerationFailure: (outputId: string, message: string, detail?: string) => void;
  onDispatched: (requestId: string, generationId: string, provider: Provider) => void;
};

const queueStatusRetryDelayMs = (
  queueStatus: FalQueueStatusResponse,
  initialDelayMs: number,
  attempt: number
) =>
  queueStatus.status === "queued"
    ? clampQueuePollMs(queueStatus.retryAfterMs)
    : clampQueuePollMs(initialDelayMs * Math.min(4, attempt + 1));

const resolveDispatchedPollingProvider = ({
  queueStatusProvider,
  queueStatusModelId,
  submitProvider,
}: {
  queueStatusProvider: string | null | undefined;
  queueStatusModelId?: string | null;
  submitProvider: Provider;
}): Provider => {
  const normalizedProvider = normalizeProviderForPolling(queueStatusProvider, submitProvider);
  // Queue-status can return a generic "fal" provider token even when submit-time routing was model-specific.
  if (normalizedProvider === "fal" && submitProvider.startsWith("fal-")) {
    return submitProvider;
  }
  // Queue-status can return a generic "kie" token for dispatched rows.
  // Use model id when present so kling/veo polling routes cannot drift.
  if (normalizedProvider === "kie-veo") {
    const providerToken = queueStatusProvider?.trim().toLowerCase();
    if (providerToken === "kie") {
      const modelScopedProvider = normalizeProviderForPolling(queueStatusModelId, submitProvider);
      if (modelScopedProvider === "kie-kling" || modelScopedProvider === "kie-veo") {
        return modelScopedProvider;
      }
      if (submitProvider === "kie-kling" || submitProvider === "kie-veo") {
        return submitProvider;
      }
    }
  }
  return normalizedProvider;
};

/**
 * Starts queue-status polling and dispatch handoff for queued submits.
 */
export const startQueuedStatusPolling = ({
  outputId,
  provider,
  finalModel,
  effectiveTool,
  queuedResponse,
  patch,
  queueStatusTimersRef,
  queueStatusSessionRef,
  clearQueueStatusPolling,
  updateOutputById,
  notifyGenerationFailure,
  onDispatched,
}: StartQueuedStatusPollingParams): void => {
  clearQueueStatusPolling(outputId);
  const pollSession = (queueStatusSessionRef.current[outputId] ?? 0) + 1;
  queueStatusSessionRef.current[outputId] = pollSession;
  const initialDelayMs = clampQueuePollMs(queuedResponse.pollAfterMs);
  const queueEnqueuedAtMs = Date.now();
  let hiddenPauseMs = 0;
  let notFoundRetries = 0;

  updateOutputById(outputId, (item) =>
    applyQueuedSubmissionPatch({
      item,
      patch,
      provider,
      generationId: queuedResponse.generationId,
      queueEnqueuedAtMs,
    })
  );

  addBreadcrumb({
    type: "ui",
    level: "info",
    message: "fal_submit_queued",
    data: {
      output_id: outputId,
      model_id: finalModel,
      provider,
      source_ref: queuedResponse.sourceRef,
      generation_id: queuedResponse.generationId,
      tool: effectiveTool,
    },
  });

  const pollQueuedStatus = async (attempt: number): Promise<void> => {
    if ((queueStatusSessionRef.current[outputId] ?? 0) !== pollSession) {
      return;
    }
    if (!isDocumentVisible()) {
      const hiddenRetryAfterMs = clampQueuePollMs(
        Math.max(initialDelayMs, HIDDEN_TAB_QUEUE_STATUS_RETRY_MS)
      );
      hiddenPauseMs += hiddenRetryAfterMs;
      queueStatusTimersRef.current[outputId] = window.setTimeout(() => {
        void pollQueuedStatus(attempt);
      }, hiddenRetryAfterMs);
      return;
    }

    try {
      const queueStatus = await fetchFalQueueStatus({
        sourceRef: queuedResponse.sourceRef,
        generationId: queuedResponse.generationId,
      });

      if (queueStatus.status === "dispatched") {
        clearQueueStatusPolling(outputId);
        onDispatched(
          queueStatus.requestId,
          queueStatus.generationId || queuedResponse.generationId,
          resolveDispatchedPollingProvider({
            queueStatusProvider: queueStatus.provider,
            queueStatusModelId: queueStatus.modelId,
            submitProvider: provider,
          })
        );
        return;
      }

      if (queueStatus.status === "failed") {
        clearQueueStatusPolling(outputId);
        notifyGenerationFailure(outputId, queueStatus.message, queueStatus.message);
        return;
      }

      if (queueStatus.status === "not_found") {
        notFoundRetries += 1;
        if (notFoundRetries >= QUEUE_STATUS_NOT_FOUND_MAX_RETRIES) {
          clearQueueStatusPolling(outputId);
          notifyGenerationFailure(
            outputId,
            "Queued generation could not be found. Please retry.",
            "Generation queue status remained unresolved while waiting for dispatch."
          );
          return;
        }
      } else {
        notFoundRetries = 0;
      }

      if (Date.now() - queueEnqueuedAtMs - hiddenPauseMs >= QUEUE_STATUS_MAX_WAIT_MS) {
        clearQueueStatusPolling(outputId);
        notifyGenerationFailure(
          outputId,
          "Generation queue timed out. Please retry.",
          "Generation queue timed out while waiting for dispatch."
        );
        return;
      }

      const retryAfterMs = queueStatusRetryDelayMs(queueStatus, initialDelayMs, attempt);
      queueStatusTimersRef.current[outputId] = window.setTimeout(() => {
        void pollQueuedStatus(attempt + 1);
      }, retryAfterMs);
    } catch (error) {
      if (Date.now() - queueEnqueuedAtMs - hiddenPauseMs >= QUEUE_STATUS_MAX_WAIT_MS) {
        clearQueueStatusPolling(outputId);
        const message =
          error instanceof Error ? error.message : "Unable to read queued generation status.";
        notifyGenerationFailure(outputId, message, message);
        return;
      }

      const retryAfterMs = clampQueuePollMs(initialDelayMs * Math.min(4, attempt + 1));
      queueStatusTimersRef.current[outputId] = window.setTimeout(() => {
        void pollQueuedStatus(attempt + 1);
      }, retryAfterMs);
    }
  };

  queueStatusTimersRef.current[outputId] = window.setTimeout(() => {
    void pollQueuedStatus(0);
  }, initialDelayMs);
};
