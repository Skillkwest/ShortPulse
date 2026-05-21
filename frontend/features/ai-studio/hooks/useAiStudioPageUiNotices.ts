/**
 * AI Studio page UI notice policy hook.
 * Centralizes page-level notice arbitration for page-specific sync state.
 */
import { useMemo } from "react";

type PreferenceSyncState = "loading" | "ready" | "saving" | "error";

const PULSE_SUPPRESSED_UI_NOTICES = new Set<string>([
  "Add a reference image before generating.",
  "Character Mode is enabled with no character selected. Generated without character injection.",
  "Character Mode context is still loading. Generated without character injection.",
  "Selected character context could not be loaded. Generated without character injection.",
  "Selected character has no description or look references. Generated without character injection.",
  "Selected character has no description. Generated using look references only.",
  "Selected character has no look references. Generated using description only.",
]);

type UseAiStudioPageUiNoticesParams = {
  expertCreateMode: "standard" | "pulse";
  uiNotice: string | null;
  mediaAutosaveError: string | null;
  mediaAutosaveSyncState: PreferenceSyncState;
};

export const useAiStudioPageUiNotices = ({
  expertCreateMode,
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
    if (expertCreateMode === "pulse" && uiNotice && PULSE_SUPPRESSED_UI_NOTICES.has(uiNotice)) {
      return mediaAutosaveUiNotice;
    }
    return uiNotice ?? mediaAutosaveUiNotice;
  }, [expertCreateMode, mediaAutosaveError, mediaAutosaveSyncState, uiNotice]);

  return {
    effectiveUiNotice,
  };
};
