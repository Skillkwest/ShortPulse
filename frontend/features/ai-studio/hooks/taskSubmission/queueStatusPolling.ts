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
import {
  QUEUE_STATUS_NOT_FOUND_MAX_RETRIES,
  shouldEscalateQueuedNotFoundRecovery,
} from "./queueStatusNotFoundPolicy";

export const QUEUE_STATUS_MAX_WAIT_MS = 30 * 60 * 1000;
export const clampQueuePollMs = (value: number) =>
  Math.max(500, Math.min(10000, Math.trunc(value)));
const HIDDEN_TAB_QUEUE_STATUS_RETRY_MS = 10_000;
const MAX_ACTIVE_QUEUE_STATUS_FETCHES = 3;
let activeQueueStatusFetches = 0;
const SLOT_SATURATED_BREADCRUMB_LIMIT = 2;
const SERVER_RECOVERY_PENDING_TIMESTAMP = "Waiting for server recovery...";

const isDocumentVisible = (): boolean =>
  typeof document === "undefined" || document.visibilityState === "visible";

const tryAcquireQueueStatusFetchSlot = (): boolean => {
  if (activeQueueStatusFetches >= MAX_ACTIVE_QUEUE_STATUS_FETCHES) {
    return false;
  }
  activeQueueStatusFetches += 1;
  return true;
};

const releaseQueueStatusFetchSlot = (): void => {
  activeQueueStatusFetches = Math.max(0, activeQueueStatusFetches - 1);
};

export const __resetQueueStatusPollingTestState = (): void => {
  activeQueueStatusFetches = 0;
};

const resolveDeterministicJitterMs = (
  outputId: string,
  attempt: number,
  maxJitterMs: number
): number => {
  if (!Number.isFinite(maxJitterMs) || maxJitterMs <= 0) return 0;
  let hash = 0;
  for (let index = 0; index < outputId.length; index += 1) {
    hash = (hash * 31 + outputId.charCodeAt(index)) | 0;
  }
  const mixed = (hash ^ Math.imul(attempt + 1, 0x9e3779b1)) >>> 0;
  return mixed % (Math.floor(maxJitterMs) + 1);
};

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
  queueStatus.status === "queued" || queueStatus.status === "dispatching"
    ? clampQueuePollMs(queueStatus.retryAfterMs)
    : clampQueuePollMs(initialDelayMs * Math.min(4, attempt + 1));

export const resolveDispatchedPollingProvider = ({
  pollingProvider,
  queueStatusProvider,
  queueStatusModelId,
  submitProvider,
}: {
  pollingProvider?: string | null;
  queueStatusProvider: string | null | undefined;
  queueStatusModelId?: string | null;
  submitProvider: Provider;
}): Provider => {
  const serverResolvedProvider = normalizeProviderForPolling(pollingProvider, submitProvider);
  if (pollingProvider && serverResolvedProvider !== submitProvider) {
    return serverResolvedProvider;
  }
  if (pollingProvider && serverResolvedProvider === submitProvider) {
    return submitProvider;
  }
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

export const normalizeQueuedLifecycleQueueState = (
  queueState: "queued" | "dispatching" | "dispatched" | "failed" | null | undefined,
  fallback: "queued" | "dispatching" | "dispatched"
): StudioOutput["queueState"] => {
  if (queueState === "queued") return "queued";
  if (queueState === "dispatching") return "dispatching";
  if (queueState === "dispatched") return "dispatched";
  return fallback;
};

export const markQueuedStatusRecoveryPending = ({
  outputId,
  updateOutputById,
}: {
  outputId: string;
  updateOutputById: (id: string, updater: (item: StudioOutput) => StudioOutput) => void;
}): void => {
  updateOutputById(outputId, (item) => ({
    ...item,
    taskState: item.taskState === "fail" ? "pending" : (item.taskState ?? "pending"),
    status: "ready",
    timestamp: SERVER_RECOVERY_PENDING_TIMESTAMP,
    errorMessage: null,
    errorMessageShort: null,
    errorDetail: null,
  }));
};

export const syncQueuedStatusLifecycle = ({
  outputId,
  queueStatus,
  updateOutputById,
}: {
  outputId: string;
  queueStatus: Extract<FalQueueStatusResponse, { status: "queued" | "dispatching" }>;
  updateOutputById: (id: string, updater: (item: StudioOutput) => StudioOutput) => void;
}): void => {
  const lifecycle = queueStatus.shortpulseLifecycle;
  updateOutputById(outputId, (item) => ({
    ...item,
    sourceRef:
      item.sourceRef ??
      (typeof queueStatus.sourceRef === "string" && queueStatus.sourceRef.trim().length > 0
        ? queueStatus.sourceRef.trim()
        : item.sourceRef),
    generationId:
      item.generationId ??
      (typeof queueStatus.generationId === "string" && queueStatus.generationId.trim().length > 0
        ? queueStatus.generationId.trim()
        : item.generationId),
    queueState: normalizeQueuedLifecycleQueueState(lifecycle?.queueState, queueStatus.status),
    taskState: lifecycle?.taskState ?? (queueStatus.status === "queued" ? "pending" : "running"),
    status: "ready",
    timestamp:
      lifecycle?.statusLabel ??
      (queueStatus.status === "dispatching"
        ? "Dispatching..."
        : item.timestamp === SERVER_RECOVERY_PENDING_TIMESTAMP
          ? item.timestamp
          : "Waiting in queue..."),
    errorMessage: null,
    errorMessageShort: null,
    errorDetail: null,
  }));
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
  let slotSaturatedBreadcrumbCount = 0;

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

    if (!tryAcquireQueueStatusFetchSlot()) {
      const retryAfterMs = clampQueuePollMs(
        initialDelayMs + resolveDeterministicJitterMs(outputId, attempt, 250)
      );
      if (slotSaturatedBreadcrumbCount < SLOT_SATURATED_BREADCRUMB_LIMIT) {
        slotSaturatedBreadcrumbCount += 1;
        addBreadcrumb({
          type: "ui",
          level: "info",
          message: "fal_queue_status_poll_saturated",
          data: {
            output_id: outputId,
            source_ref: queuedResponse.sourceRef,
            generation_id: queuedResponse.generationId,
            active_fetches: activeQueueStatusFetches,
            retry_after_ms: retryAfterMs,
            attempt,
          },
        });
      }
      queueStatusTimersRef.current[outputId] = window.setTimeout(() => {
        void pollQueuedStatus(attempt);
      }, retryAfterMs);
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
            pollingProvider: queueStatus.pollingProvider,
            queueStatusProvider: queueStatus.provider,
            queueStatusModelId: queueStatus.modelId,
            submitProvider: provider,
          })
        );
        return;
      }

      if (queueStatus.status === "failed") {
        clearQueueStatusPolling(outputId);
        const failureMessage =
          queueStatus.shortpulseLifecycle?.errorMessage?.trim() || queueStatus.message;
        notifyGenerationFailure(outputId, failureMessage, queueStatus.message);
        return;
      }

      if (queueStatus.status === "not_found") {
        notFoundRetries += 1;
        if (
          shouldEscalateQueuedNotFoundRecovery({
            notFoundRetries,
            queueEnqueuedAtMs,
            nowMs: Date.now(),
          })
        ) {
          clearQueueStatusPolling(outputId);
          markQueuedStatusRecoveryPending({
            outputId,
            updateOutputById,
          });
          return;
        }
      } else {
        notFoundRetries = 0;
      }

      if (queueStatus.status === "queued" || queueStatus.status === "dispatching") {
        syncQueuedStatusLifecycle({
          outputId,
          queueStatus,
          updateOutputById,
        });
      }

      if (Date.now() - queueEnqueuedAtMs - hiddenPauseMs >= QUEUE_STATUS_MAX_WAIT_MS) {
        clearQueueStatusPolling(outputId);
        markQueuedStatusRecoveryPending({
          outputId,
          updateOutputById,
        });
        return;
      }

      const retryAfterMs = queueStatusRetryDelayMs(queueStatus, initialDelayMs, attempt);
      queueStatusTimersRef.current[outputId] = window.setTimeout(() => {
        void pollQueuedStatus(attempt + 1);
      }, retryAfterMs);
    } catch {
      if (Date.now() - queueEnqueuedAtMs - hiddenPauseMs >= QUEUE_STATUS_MAX_WAIT_MS) {
        clearQueueStatusPolling(outputId);
        markQueuedStatusRecoveryPending({
          outputId,
          updateOutputById,
        });
        return;
      }

      const retryAfterMs = clampQueuePollMs(
        initialDelayMs * Math.min(4, attempt + 1) +
          resolveDeterministicJitterMs(outputId, attempt, 200)
      );
      queueStatusTimersRef.current[outputId] = window.setTimeout(() => {
        void pollQueuedStatus(attempt + 1);
      }, retryAfterMs);
    } finally {
      releaseQueueStatusFetchSlot();
    }
  };

  queueStatusTimersRef.current[outputId] = window.setTimeout(() => {
    void pollQueuedStatus(0);
  }, initialDelayMs);
};
