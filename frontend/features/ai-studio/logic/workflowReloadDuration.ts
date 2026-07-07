/**
 * Duration helpers for workflow reload metadata that can hydrate display outputs.
 */
import type { WorkflowReloadConfig } from "../types";

export const normalizeDurationSecondsToMs = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return Math.max(1, Math.round(value * 1000));
};

/**
 * Returns the requested video duration stored in workflow reload metadata.
 */
export const resolveWorkflowReloadVideoDurationMs = (
  workflowReload: WorkflowReloadConfig | null | undefined
): number | null => {
  if (workflowReload?.payload?.kind !== "video") return null;
  return normalizeDurationSecondsToMs(workflowReload.payload.durationSeconds);
};
