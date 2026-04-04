/**
 * Aging rules for unresolved AI Studio generation cards.
 * Identifies stale loading outputs and auto-failed outputs eligible for removal.
 */
import type { StudioOutput } from "../types";

export type OutputLifecycleState = {
  pendingSinceMs?: number;
  autoFailedAtMs?: number;
};

export type OutputLifecycleMap = Record<string, OutputLifecycleState>;

export type StaleOutputCleanupConfig = {
  loadingTimeoutMs: number;
  submitStartTimeoutMs: number;
  taskBackedLoadingTimeoutMs: number;
  queueWaitTimeoutMs: number;
  autoFailedRetentionMs: number;
};

export type StaleOutputCleanupResult = {
  nextLifecycle: OutputLifecycleMap;
  staleLoadingIds: string[];
  submitStartTimeoutIds: string[];
  taskBackedTimeoutIds: string[];
  queueWaitTimeoutIds: string[];
  removableIds: string[];
};

const isGeneratedOutput = (output: StudioOutput): boolean => {
  if (output.mediaSource === "generated") return true;
  // Keep legacy fallback for older optimistic ids that predate mediaSource wiring.
  return output.id.startsWith("out-");
};

const isLoadingWithoutPreview = (output: StudioOutput): boolean => {
  if (!isGeneratedOutput(output)) return false;
  if (output.previewUrl || output.previewText) return false;
  // Once a provider task id exists, polling owns timeout/failure behavior.
  // Cleanup is only for placeholders that never reached task-backed polling.
  if (output.taskId) return false;
  return (
    output.taskState === "pending" ||
    output.taskState === "running" ||
    output.taskState === "success"
  );
};

const isQueuedOutput = (output: StudioOutput): boolean => {
  if (output.queueState === "queued") return true;
  const hasGenerationId =
    typeof output.generationId === "string" && output.generationId.trim().length > 0;
  const hasTaskId = typeof output.taskId === "string" && output.taskId.trim().length > 0;
  // Legacy/restored snapshots may miss queueState; generationId-without-taskId still indicates
  // queue-wait semantics and should not be downgraded to submit-start timeout behavior.
  return hasGenerationId && !hasTaskId;
};

const isTaskBackedLoadingWithoutPreview = (output: StudioOutput): boolean => {
  if (!isGeneratedOutput(output)) return false;
  if (output.previewUrl || output.previewText) return false;
  if (!output.taskId) return false;
  return (
    output.taskState === "pending" ||
    output.taskState === "running" ||
    output.taskState === "success"
  );
};

const isFailedWithoutPreview = (output: StudioOutput): boolean =>
  output.taskState === "fail" && !output.previewUrl && !output.previewText && !output.taskId;

/**
 * Returns stale-loading and removable ids plus next lifecycle tracking state.
 */
export const evaluateStaleOutputCleanup = (
  outputs: StudioOutput[],
  lifecycle: OutputLifecycleMap,
  now: number,
  config: StaleOutputCleanupConfig
): StaleOutputCleanupResult => {
  const nextLifecycle: OutputLifecycleMap = {};
  const staleLoadingIds: string[] = [];
  const submitStartTimeoutIds: string[] = [];
  const taskBackedTimeoutIds: string[] = [];
  const queueWaitTimeoutIds: string[] = [];
  const removableIds: string[] = [];

  outputs.forEach((output) => {
    const previous = lifecycle[output.id];
    const nextState: OutputLifecycleState = previous ? { ...previous } : {};

    if (isLoadingWithoutPreview(output) || isTaskBackedLoadingWithoutPreview(output)) {
      if (nextState.pendingSinceMs == null) {
        const queuedSinceMs =
          isQueuedOutput(output) && typeof output.queueEnqueuedAtMs === "number"
            ? Math.trunc(output.queueEnqueuedAtMs)
            : null;
        nextState.pendingSinceMs =
          queuedSinceMs != null && Number.isFinite(queuedSinceMs)
            ? Math.min(queuedSinceMs, now)
            : now;
      }
      const elapsedMs = now - nextState.pendingSinceMs;
      if (isTaskBackedLoadingWithoutPreview(output)) {
        if (elapsedMs >= config.taskBackedLoadingTimeoutMs) {
          staleLoadingIds.push(output.id);
          taskBackedTimeoutIds.push(output.id);
        }
      } else if (isQueuedOutput(output)) {
        if (elapsedMs >= config.queueWaitTimeoutMs) {
          staleLoadingIds.push(output.id);
          queueWaitTimeoutIds.push(output.id);
        }
      } else if (elapsedMs >= config.submitStartTimeoutMs) {
        staleLoadingIds.push(output.id);
        submitStartTimeoutIds.push(output.id);
      } else if (elapsedMs >= config.loadingTimeoutMs) {
        staleLoadingIds.push(output.id);
      }
    } else {
      delete nextState.pendingSinceMs;
    }

    if (isFailedWithoutPreview(output)) {
      if (
        nextState.autoFailedAtMs != null &&
        now - nextState.autoFailedAtMs >= config.autoFailedRetentionMs
      ) {
        removableIds.push(output.id);
      }
    } else {
      delete nextState.autoFailedAtMs;
    }

    if (nextState.pendingSinceMs != null || nextState.autoFailedAtMs != null) {
      nextLifecycle[output.id] = nextState;
    }
  });

  return {
    nextLifecycle,
    staleLoadingIds,
    submitStartTimeoutIds,
    taskBackedTimeoutIds,
    queueWaitTimeoutIds,
    removableIds,
  };
};
