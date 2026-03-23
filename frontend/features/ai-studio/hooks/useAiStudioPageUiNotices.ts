/**
 * AI Studio page UI notice policy hook.
 * Centralizes page-level notice arbitration and guarded beginner-mode toggle behavior without changing the visible contract.
 */
import { useCallback, useMemo } from "react";

type PreferenceSyncState = "loading" | "ready" | "saving" | "error";

type UseAiStudioPageUiNoticesParams = {
  uiNotice: string | null;
  beginnerModeError: string | null;
  beginnerModeLoading: boolean;
  beginnerModeSyncState: PreferenceSyncState;
  showBeginnerModeToggle: boolean;
  setBeginnerMode: (value: boolean) => void;
  mediaAutosaveError: string | null;
  mediaAutosaveSyncState: PreferenceSyncState;
};

/**
 * Returns the effective notice banner content and guarded beginner-mode toggle handler for the page shell.
 */
export const useAiStudioPageUiNotices = ({
  uiNotice,
  beginnerModeError,
  beginnerModeLoading,
  beginnerModeSyncState,
  showBeginnerModeToggle,
  setBeginnerMode,
  mediaAutosaveError,
  mediaAutosaveSyncState,
}: UseAiStudioPageUiNoticesParams) => {
  const effectiveUiNotice = useMemo(() => {
    const beginnerModeUiNotice = beginnerModeError
      ? `Beginner mode preference sync failed: ${beginnerModeError}`
      : beginnerModeSyncState === "saving"
        ? "Saving beginner mode preference..."
        : null;
    const mediaAutosaveUiNotice = mediaAutosaveError
      ? `Media autosave preference sync failed: ${mediaAutosaveError}`
      : mediaAutosaveSyncState === "saving"
        ? "Saving media autosave preference..."
        : null;
    return uiNotice ?? beginnerModeUiNotice ?? mediaAutosaveUiNotice;
  }, [
    beginnerModeError,
    beginnerModeSyncState,
    mediaAutosaveError,
    mediaAutosaveSyncState,
    uiNotice,
  ]);

  const handleBeginnerModeChange = useCallback(
    (value: boolean) => {
      if (!showBeginnerModeToggle) return;
      if (beginnerModeLoading || beginnerModeSyncState === "saving") return;
      setBeginnerMode(value);
    },
    [beginnerModeLoading, beginnerModeSyncState, setBeginnerMode, showBeginnerModeToggle]
  );

  return {
    effectiveUiNotice,
    handleBeginnerModeChange,
  };
};
