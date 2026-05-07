/**
 * Wrapper around persisted beginner-mode preference that applies runtime policy overrides.
 * Keeps storage sync behavior intact while enforcing the retired beginner-mode runtime contract.
 */
import { useCallback, useEffect, useRef } from "react";
import {
  BEGINNER_MODE_FORCE_OFF,
  isBeginnerModeToggleVisible,
  resolveEffectiveBeginnerMode,
} from "../../../lib/ui-modes/beginnerModeRuntime";
import { useBeginnerModePreference } from "./useBeginnerModePreference";

type UseEffectiveBeginnerModePreferenceResult = {
  beginnerMode: boolean;
  loading: boolean;
  error: string | null;
  syncState: "loading" | "ready" | "saving" | "error";
  showBeginnerModeToggle: boolean;
  setBeginnerMode: (value: boolean) => void;
};

export const useEffectiveBeginnerModePreference = (): UseEffectiveBeginnerModePreferenceResult => {
  const {
    beginnerMode: storedBeginnerMode,
    loading,
    error,
    syncState,
    setBeginnerMode: setStoredBeginnerMode,
  } = useBeginnerModePreference();

  const showBeginnerModeToggle = isBeginnerModeToggleVisible();
  const beginnerMode = resolveEffectiveBeginnerMode(storedBeginnerMode);
  const hasIssuedForceOffSyncRef = useRef<boolean>(false);

  // Keep persisted state aligned with the retired beginner-mode runtime contract.
  useEffect(() => {
    if (!BEGINNER_MODE_FORCE_OFF || loading) return;
    if (!storedBeginnerMode) {
      hasIssuedForceOffSyncRef.current = false;
      return;
    }
    if (hasIssuedForceOffSyncRef.current) return;
    hasIssuedForceOffSyncRef.current = true;
    setStoredBeginnerMode(false);
  }, [loading, setStoredBeginnerMode, storedBeginnerMode]);

  const setBeginnerMode = useCallback(
    (value: boolean) => {
      if (BEGINNER_MODE_FORCE_OFF || !showBeginnerModeToggle) return;
      setStoredBeginnerMode(value);
    },
    [setStoredBeginnerMode, showBeginnerModeToggle]
  );

  return {
    beginnerMode,
    loading,
    error,
    syncState,
    showBeginnerModeToggle,
    setBeginnerMode,
  };
};
