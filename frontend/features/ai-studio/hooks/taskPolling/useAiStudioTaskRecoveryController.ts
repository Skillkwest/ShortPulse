import { useCallback, useRef, type MutableRefObject } from "react";
import { addBreadcrumb } from "../../../../lib/clientBreadcrumbs";
import { resolveNormalizedOutputDelivery } from "../../logic/referenceGridMedia";
import { Provider } from "../../logic/stateParsers";
import type { StudioOutput } from "../../types";
import {
  BACKGROUND_RECOVERY_INTERVAL_MS,
  getBackgroundRecoveryMaxAttempts,
  type BackgroundRecoveryReasonCode,
} from "./backgroundRecoveryPolicy";
import { resolvePollStatusGenerationId, type PollStatus } from "./providerStatusPolicy";

type OutputLookupHardStopPayload = {
  outputId: string;
  taskId: string;
  provider: Provider;
  lookupMisses: number;
  missingDurationMs: number;
};

type UseAiStudioTaskRecoveryControllerArgs = {
  clearPollTimer: (outputId: string) => void;
  extractMediaUrls: (
    provider: Provider,
    status: PollStatus,
    options?: { outputMode?: StudioOutput["mode"] | null }
  ) => string[];
  fetchStatusByProvider: (provider: Provider, taskId: string) => Promise<unknown>;
  findOutputById?: (id: string) => StudioOutput | null;
  onGenerationSuccess?: (payload: {
    outputId: string;
    taskId: string;
    provider: Provider;
    resultUrls: string[];
  }) => void;
  onPollingOutputLookupHardStop?: (payload: OutputLookupHardStopPayload) => void;
  queueOutputUpdate: (
    outputId: string,
    updater: (item: StudioOutput) => StudioOutput,
    options?: { nonUrgent?: boolean }
  ) => void;
};

type UseAiStudioTaskRecoveryControllerResult = {
  clearRecoveryTimer: (outputId: string) => void;
  handleOutputLookupHardStop: (payload: OutputLookupHardStopPayload) => void;
  outputLookupHardStopNotifiedRef: MutableRefObject<Record<string, boolean>>;
  outputLookupMissesRef: MutableRefObject<Record<string, number>>;
  outputLookupMissingSinceRef: MutableRefObject<Record<string, number>>;
  resetRecoveryState: () => void;
  scheduleBackgroundRecovery: (
    taskId: string,
    outputId: string,
    provider: Provider,
    reasonCode: BackgroundRecoveryReasonCode
  ) => void;
};

const areStringArraysEqual = (left: string[] | undefined, right: string[]) => {
  if (!left) return right.length === 0;
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
};

export const useAiStudioTaskRecoveryController = ({
  clearPollTimer,
  extractMediaUrls,
  fetchStatusByProvider,
  findOutputById,
  onGenerationSuccess,
  onPollingOutputLookupHardStop,
  queueOutputUpdate,
}: UseAiStudioTaskRecoveryControllerArgs): UseAiStudioTaskRecoveryControllerResult => {
  const SERVER_RECOVERY_PENDING_TIMESTAMP = "Waiting for server recovery...";
  const recoveryTimersRef = useRef<Record<string, number>>({});
  const recoveryAttemptsRef = useRef<Record<string, number>>({});
  const outputLookupMissesRef = useRef<Record<string, number>>({});
  const outputLookupMissingSinceRef = useRef<Record<string, number>>({});
  const outputLookupHardStopNotifiedRef = useRef<Record<string, boolean>>({});

  const clearRecoveryTimer = useCallback((outputId: string) => {
    const timeoutId = recoveryTimersRef.current[outputId];
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      delete recoveryTimersRef.current[outputId];
    }
    delete recoveryAttemptsRef.current[outputId];
  }, []);

  const scheduleBackgroundRecovery = useCallback(
    (
      taskId: string,
      outputId: string,
      provider: Provider,
      reasonCode: BackgroundRecoveryReasonCode
    ) => {
      if (recoveryTimersRef.current[outputId]) return;
      const maxRecoveryAttempts = getBackgroundRecoveryMaxAttempts(reasonCode);

      addBreadcrumb({
        type: "ui",
        level: "warn",
        message: "generation_background_recovery_scheduled",
        data: {
          provider,
          task_id: taskId,
          output_id: outputId,
          reason_code: reasonCode,
          interval_ms: BACKGROUND_RECOVERY_INTERVAL_MS,
          max_attempts: maxRecoveryAttempts,
        },
      });

      const queueNext = () => {
        recoveryTimersRef.current[outputId] = window.setTimeout(async () => {
          const attempt = (recoveryAttemptsRef.current[outputId] ?? 0) + 1;
          recoveryAttemptsRef.current[outputId] = attempt;

          try {
            const status = (await fetchStatusByProvider(provider, taskId)) as PollStatus;
            const statusGenerationId = resolvePollStatusGenerationId(status);
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
            const outputMode = findOutputById?.(outputId)?.mode ?? null;
            const recoveredUrls = extractMediaUrls(provider, status, { outputMode }).filter(
              Boolean
            );

            if (recoveredUrls.length > 0) {
              addBreadcrumb({
                type: "ui",
                level: "info",
                message: "generation_background_recovery_success",
                data: {
                  provider,
                  task_id: taskId,
                  output_id: outputId,
                  attempt,
                  recovered_count: recoveredUrls.length,
                },
              });

              queueOutputUpdate(outputId, (item) => {
                const nextDelivery = resolveNormalizedOutputDelivery({
                  previewStoragePath: item.previewStoragePath ?? null,
                  fullStoragePath: item.fullStoragePath ?? null,
                  previewUrl: recoveredUrls[0] ?? item.previewUrl ?? null,
                  resultUrls: recoveredUrls,
                });
                return {
                  ...item,
                  taskState: item.taskState === "success" ? item.taskState : "success",
                  status: item.status === "ready" ? item.status : "ready",
                  timestamp:
                    item.timestamp === "Recovered media URL."
                      ? item.timestamp
                      : "Recovered media URL.",
                  resultUrls: areStringArraysEqual(item.resultUrls, recoveredUrls)
                    ? item.resultUrls
                    : recoveredUrls,
                  previewUrl:
                    item.previewUrl === (recoveredUrls[0] ?? item.previewUrl)
                      ? item.previewUrl
                      : (recoveredUrls[0] ?? item.previewUrl),
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
                  archivedAt: null,
                  archiveReason: null,
                  errorMessage: item.errorMessage == null ? item.errorMessage : null,
                  errorMessageShort: item.errorMessageShort == null ? item.errorMessageShort : null,
                  errorDetail: item.errorDetail == null ? item.errorDetail : null,
                };
              });
              onGenerationSuccess?.({
                outputId,
                taskId,
                provider,
                resultUrls: recoveredUrls,
              });
              clearPollTimer(outputId);
              clearRecoveryTimer(outputId);
              return;
            }
          } catch {
            // best-effort fallback polling; keep trying until budget is exhausted
          }

          if (attempt >= maxRecoveryAttempts) {
            addBreadcrumb({
              type: "ui",
              level: "warn",
              message: "generation_background_recovery_exhausted",
              data: {
                provider,
                task_id: taskId,
                output_id: outputId,
                attempts: attempt,
                max_attempts: maxRecoveryAttempts,
              },
            });
            clearRecoveryTimer(outputId);
            return;
          }

          queueNext();
        }, BACKGROUND_RECOVERY_INTERVAL_MS);
      };

      queueNext();
    },
    [
      clearPollTimer,
      clearRecoveryTimer,
      extractMediaUrls,
      fetchStatusByProvider,
      findOutputById,
      onGenerationSuccess,
      queueOutputUpdate,
    ]
  );

  const handleOutputLookupHardStop = useCallback(
    ({
      outputId,
      taskId,
      provider,
      lookupMisses,
      missingDurationMs,
    }: OutputLookupHardStopPayload) => {
      if (outputLookupHardStopNotifiedRef.current[outputId]) return;
      outputLookupHardStopNotifiedRef.current[outputId] = true;
      addBreadcrumb({
        type: "ui",
        level: "warn",
        message: "generation_poll_output_lookup_hard_stop",
        data: {
          provider,
          task_id: taskId,
          output_id: outputId,
          lookup_misses: lookupMisses,
          missing_duration_ms: missingDurationMs,
        },
      });
      onPollingOutputLookupHardStop?.({
        outputId,
        taskId,
        provider,
        lookupMisses,
        missingDurationMs,
      });
      queueOutputUpdate(outputId, (item) => ({
        ...item,
        taskState: item.taskState === "running" ? item.taskState : "running",
        status: item.status === "ready" ? item.status : "ready",
        timestamp:
          item.timestamp === SERVER_RECOVERY_PENDING_TIMESTAMP
            ? item.timestamp
            : SERVER_RECOVERY_PENDING_TIMESTAMP,
        errorMessage: null,
        errorMessageShort: null,
        errorDetail: null,
      }));
      scheduleBackgroundRecovery(taskId, outputId, provider, "output_lookup_missing");
      clearPollTimer(outputId);
      clearRecoveryTimer(outputId);
    },
    [
      clearPollTimer,
      clearRecoveryTimer,
      onPollingOutputLookupHardStop,
      queueOutputUpdate,
      scheduleBackgroundRecovery,
    ]
  );

  const resetRecoveryState = useCallback(() => {
    Object.values(recoveryTimersRef.current).forEach((timeoutId) => window.clearTimeout(timeoutId));
    recoveryTimersRef.current = {};
    recoveryAttemptsRef.current = {};
    outputLookupMissesRef.current = {};
    outputLookupMissingSinceRef.current = {};
    outputLookupHardStopNotifiedRef.current = {};
  }, []);

  return {
    clearRecoveryTimer,
    handleOutputLookupHardStop,
    outputLookupHardStopNotifiedRef,
    outputLookupMissesRef,
    outputLookupMissingSinceRef,
    resetRecoveryState,
    scheduleBackgroundRecovery,
  };
};
