/**
 * Aging rules for unresolved AI Studio generation cards.
 * Identifies stale loading outputs and auto-failed outputs eligible for removal.
 */
import { hasGeneratedOutputRuntimeIdentity } from "./generatedOutputRuntimeIdentity";
import { hasStorageAuthority } from "./referenceOutputAuthority";
import type { StudioOutput } from "../types";

export type OutputLifecycleState = {
  pendingSinceMs?: number;
  autoFailedAtMs?: number;
};

export type OutputLifecycleMap = Record<string, OutputLifecycleState>;

export type StaleOutputCleanupConfig = {
  submitStartTimeoutMs: number;
  directRequestTimeoutMs: number;
  taskBackedLoadingTimeoutMs: number;
  queueWaitTimeoutMs: number;
  autoFailedRetentionMs: number;
};

export type StaleOutputCleanupResult = {
  nextLifecycle: OutputLifecycleMap;
  staleLoadingIds: string[];
  submitStartTimeoutIds: string[];
  directRequestTimeoutIds: string[];
  taskBackedTimeoutIds: string[];
  queueWaitTimeoutIds: string[];
  uploadPersistenceTimeoutIds: string[];
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
  if (hasGeneratedOutputRuntimeIdentity(output)) return false;
  if (output.submissionMode === "direct-request") return false;
  return output.taskState === "pending" || output.taskState === "running";
};

const isDirectRequestLoadingWithoutPreview = (output: StudioOutput): boolean => {
  if (!isGeneratedOutput(output)) return false;
  if (output.previewUrl || output.previewText) return false;
  if (hasGeneratedOutputRuntimeIdentity(output)) return false;
  if (output.submissionMode !== "direct-request") return false;
  return output.taskState === "pending" || output.taskState === "running";
};

const isServerRecoverableLoadingWithoutPreview = (output: StudioOutput): boolean => {
  if (!isGeneratedOutput(output)) return false;
  if (output.previewUrl || output.previewText) return false;
  if (!hasGeneratedOutputRuntimeIdentity(output)) return false;
  return output.taskState === "pending" || output.taskState === "running";
};

const isProviderTaskLoadingWithoutDurableAuthority = (output: StudioOutput): boolean => {
  if (!isGeneratedOutput(output)) return false;
  if (output.submissionMode !== "provider-task") return false;
  if (hasStorageAuthority(output)) return false;
  if (!hasGeneratedOutputRuntimeIdentity(output)) return false;
  return output.taskState === "pending" || output.taskState === "running";
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

const isUploadPendingPersistence = (output: StudioOutput): boolean => {
  if (output.mediaSource !== "upload") return false;
  if (output.saveState !== "saving") return false;
  if (hasStorageAuthority(output)) return false;
  return output.taskState === "pending" || output.taskState === "running";
};

const isFailedWithoutPreview = (output: StudioOutput): boolean =>
  output.taskState === "fail" && !output.previewUrl && !output.previewText && !output.taskId;

export const hasStaleOutputCleanupCandidate = (output: StudioOutput): boolean =>
  isLoadingWithoutPreview(output) ||
  isDirectRequestLoadingWithoutPreview(output) ||
  isServerRecoverableLoadingWithoutPreview(output) ||
  isProviderTaskLoadingWithoutDurableAuthority(output) ||
  isUploadPendingPersistence(output) ||
  isFailedWithoutPreview(output);

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
  const directRequestTimeoutIds: string[] = [];
  const taskBackedTimeoutIds: string[] = [];
  const queueWaitTimeoutIds: string[] = [];
  const uploadPersistenceTimeoutIds: string[] = [];
  const removableIds: string[] = [];

  outputs.forEach((output) => {
    const previous = lifecycle[output.id];
    const nextState: OutputLifecycleState = previous ? { ...previous } : {};

    const isPlaceholderLoading = isLoadingWithoutPreview(output);
    const isDirectRequestLoading = isDirectRequestLoadingWithoutPreview(output);
    const isTaskBackedLoading =
      isServerRecoverableLoadingWithoutPreview(output) ||
      isProviderTaskLoadingWithoutDurableAuthority(output);
    const isUploadPersistenceLoading = isUploadPendingPersistence(output);

    if (
      isPlaceholderLoading ||
      isDirectRequestLoading ||
      isTaskBackedLoading ||
      isUploadPersistenceLoading
    ) {
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
      if (isQueuedOutput(output)) {
        if (elapsedMs >= config.queueWaitTimeoutMs) {
          staleLoadingIds.push(output.id);
          queueWaitTimeoutIds.push(output.id);
        }
      } else if (isUploadPersistenceLoading) {
        if (elapsedMs >= config.directRequestTimeoutMs) {
          staleLoadingIds.push(output.id);
          uploadPersistenceTimeoutIds.push(output.id);
        }
      } else if (isDirectRequestLoading) {
        if (elapsedMs >= config.directRequestTimeoutMs) {
          staleLoadingIds.push(output.id);
          directRequestTimeoutIds.push(output.id);
        }
      } else if (isTaskBackedLoading) {
        if (
          config.taskBackedLoadingTimeoutMs > 0 &&
          elapsedMs >= config.taskBackedLoadingTimeoutMs
        ) {
          staleLoadingIds.push(output.id);
          taskBackedTimeoutIds.push(output.id);
        }
      } else if (elapsedMs >= config.submitStartTimeoutMs) {
        staleLoadingIds.push(output.id);
        submitStartTimeoutIds.push(output.id);
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
    directRequestTimeoutIds,
    taskBackedTimeoutIds,
    queueWaitTimeoutIds,
    uploadPersistenceTimeoutIds,
    removableIds,
  };
};
