/**
 * Character Manager surface policy helpers.
 * Computes surface-specific UI policy flags without coupling shared view state to host concerns.
 */
import type { CharacterManagerShellSurface } from "../types";

type ResolveCharacterManagerSurfacePolicyParams = {
  surface: CharacterManagerShellSurface;
  beginnerMode: boolean;
  beginnerModeOverride?: boolean;
};

export type CharacterManagerSurfacePolicy = {
  isEmbeddedSurface: boolean;
  effectiveBeginnerMode: boolean;
  showQuickSwapCollapseToggle: boolean;
  showQuickSwapHelperText: boolean;
};

/**
 * Resolves surface-specific policy flags for Character Manager page and panel variants.
 */
export const resolveCharacterManagerSurfacePolicy = ({
  surface,
  beginnerMode,
  beginnerModeOverride,
}: ResolveCharacterManagerSurfacePolicyParams): CharacterManagerSurfacePolicy => {
  const isEmbeddedSurface = surface === "panel";
  const isBeginnerModeControlled = typeof beginnerModeOverride === "boolean";
  const effectiveBeginnerMode = isBeginnerModeControlled ? beginnerModeOverride : beginnerMode;

  return {
    isEmbeddedSurface,
    effectiveBeginnerMode,
    showQuickSwapCollapseToggle: surface !== "panel" || effectiveBeginnerMode,
    showQuickSwapHelperText: surface !== "panel",
  };
};
