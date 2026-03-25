/**
 * Character Manager surface policy hook.
 * Owns beginner-mode persistence and returns surface-specific policy flags for page and panel shells.
 */
import React from "react";
import { resolveCharacterManagerSurfacePolicy } from "../logic/characterManagerSurfacePolicy";
import type { CharacterManagerShellSurface } from "../types";

const CHARACTER_MANAGER_BEGINNER_MODE_STORAGE_KEY = "shortpulse.character_manager.beginner_mode";

const resolveInitialBeginnerMode = (): boolean => {
  if (typeof window === "undefined") return true;
  try {
    const stored = window.localStorage.getItem(CHARACTER_MANAGER_BEGINNER_MODE_STORAGE_KEY);
    if (stored == null) return true;
    return stored === "true";
  } catch {
    return true;
  }
};

type UseCharacterManagerSurfacePolicyParams = {
  surface: CharacterManagerShellSurface;
  beginnerModeOverride?: boolean;
};

/**
 * Returns beginner-mode state plus derived surface policy for Character Manager shells.
 */
export const useCharacterManagerSurfacePolicy = ({
  surface,
  beginnerModeOverride,
}: UseCharacterManagerSurfacePolicyParams) => {
  const [beginnerMode, setBeginnerMode] = React.useState(resolveInitialBeginnerMode);
  const isBeginnerModeControlled = typeof beginnerModeOverride === "boolean";

  React.useEffect(() => {
    if (isBeginnerModeControlled) return;
    if (typeof window === "undefined") return;
    window.localStorage.setItem(CHARACTER_MANAGER_BEGINNER_MODE_STORAGE_KEY, String(beginnerMode));
  }, [beginnerMode, isBeginnerModeControlled]);

  return {
    beginnerMode,
    setBeginnerMode,
    ...resolveCharacterManagerSurfacePolicy({
      surface,
      beginnerMode,
      beginnerModeOverride,
    }),
  };
};
