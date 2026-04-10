import { useCallback, useRef, type MutableRefObject } from "react";
import { addBreadcrumb } from "../../../../lib/clientBreadcrumbs";
import { Provider } from "../../logic/stateParsers";
import type { StudioOutput } from "../../types";

type OutputLookupHardStopPayload = {
  outputId: string;
  taskId: string;
  provider: Provider;
  lookupMisses: number;
  missingDurationMs: number;
};

type UseAiStudioTaskRecoveryControllerArgs = {
  clearPollTimer: (outputId: string) => void;
  onPollingOutputLookupHardStop?: (payload: OutputLookupHardStopPayload) => void;
  queueOutputUpdate: (
    outputId: string,
    updater: (item: StudioOutput) => StudioOutput,
    options?: { nonUrgent?: boolean }
  ) => void;
};

type UseAiStudioTaskRecoveryControllerResult = {
  handleOutputLookupHardStop: (payload: OutputLookupHardStopPayload) => void;
  outputLookupHardStopNotifiedRef: MutableRefObject<Record<string, boolean>>;
  outputLookupMissesRef: MutableRefObject<Record<string, number>>;
  outputLookupMissingSinceRef: MutableRefObject<Record<string, number>>;
  resetRecoveryState: () => void;
};

export const useAiStudioTaskRecoveryController = ({
  clearPollTimer,
  onPollingOutputLookupHardStop,
  queueOutputUpdate,
}: UseAiStudioTaskRecoveryControllerArgs): UseAiStudioTaskRecoveryControllerResult => {
  const SERVER_RECOVERY_PENDING_TIMESTAMP = "Waiting for server recovery...";
  const outputLookupMissesRef = useRef<Record<string, number>>({});
  const outputLookupMissingSinceRef = useRef<Record<string, number>>({});
  const outputLookupHardStopNotifiedRef = useRef<Record<string, boolean>>({});

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
      clearPollTimer(outputId);
    },
    [clearPollTimer, onPollingOutputLookupHardStop, queueOutputUpdate]
  );

  const resetRecoveryState = useCallback(() => {
    outputLookupMissesRef.current = {};
    outputLookupMissingSinceRef.current = {};
    outputLookupHardStopNotifiedRef.current = {};
  }, []);

  return {
    handleOutputLookupHardStop,
    outputLookupHardStopNotifiedRef,
    outputLookupMissesRef,
    outputLookupMissingSinceRef,
    resetRecoveryState,
  };
};
