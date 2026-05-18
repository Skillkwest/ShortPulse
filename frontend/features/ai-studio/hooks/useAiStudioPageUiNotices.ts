/**
 * AI Studio page UI notice policy hook.
 * Centralizes page-level notice arbitration for page-specific sync state.
 */
import { useMemo } from "react";

type PreferenceSyncState = "loading" | "ready" | "saving" | "error";

type UseAiStudioPageUiNoticesParams = {
  uiNotice: string | null;
  mediaAutosaveError: string | null;
  mediaAutosaveSyncState: PreferenceSyncState;
};

export const useAiStudioPageUiNotices = ({
  uiNotice,
  mediaAutosaveError,
  mediaAutosaveSyncState,
}: UseAiStudioPageUiNoticesParams) => {
  const effectiveUiNotice = useMemo(() => {
    const mediaAutosaveUiNotice = mediaAutosaveError
      ? `Media autosave preference sync failed: ${mediaAutosaveError}`
      : mediaAutosaveSyncState === "saving"
        ? "Saving media autosave preference..."
        : null;
    return uiNotice ?? mediaAutosaveUiNotice;
  }, [mediaAutosaveError, mediaAutosaveSyncState, uiNotice]);

  return {
    effectiveUiNotice,
  };
};
