/**
 * Shared projection-state helpers for terminal convergence paths.
 * Keeps autosave/save-state decisions aligned across direct settlement and shared recovery.
 */
import { resolveMediaStorageQuotaUserMessage } from "../../mediaStorageQuota";

export type ProjectionSaveOutcome = {
  saveState: "saved" | "idle" | "failed" | "blocked_storage";
  saveError: string | null;
};

/**
 * Derive projection save-state metadata from autosave outcomes.
 */
export const resolveAutosaveProjectionSaveOutcome = ({
  savedMediaIds,
  autosaveDecisionReason,
  autosavePreferenceLookupMessage,
}: {
  savedMediaIds: string[];
  autosaveDecisionReason: string;
  autosavePreferenceLookupMessage: string | null;
}): ProjectionSaveOutcome => {
  if (savedMediaIds.length > 0) {
    return {
      saveState: "saved",
      saveError: null,
    };
  }
  if (autosavePreferenceLookupMessage) {
    return {
      saveState: "failed",
      saveError: autosavePreferenceLookupMessage,
    };
  }
  const saveError = resolveMediaStorageQuotaUserMessage(autosaveDecisionReason);
  return {
    saveState: saveError ? "blocked_storage" : "idle",
    saveError,
  };
};
