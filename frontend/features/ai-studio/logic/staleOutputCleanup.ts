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
  autoFailedRetentionMs: number;
};

export type StaleOutputCleanupResult = {
  nextLifecycle: OutputLifecycleMap;
  staleLoadingIds: string[];
  removableIds: string[];
};

const isGeneratedOutput = (output: StudioOutput): boolean => output.id.startsWith("out-");

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
  const removableIds: string[] = [];

  outputs.forEach((output) => {
    const previous = lifecycle[output.id];
    const nextState: OutputLifecycleState = previous ? { ...previous } : {};

    if (isLoadingWithoutPreview(output)) {
      if (nextState.pendingSinceMs == null) {
        nextState.pendingSinceMs = now;
      }
      if (now - nextState.pendingSinceMs >= config.loadingTimeoutMs) {
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
    removableIds,
  };
};
