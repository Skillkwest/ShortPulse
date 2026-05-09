/**
 * Character Manager surface policy helpers.
 * Computes surface-specific UI policy flags without coupling shared view state to host concerns.
 */
import type { CharacterManagerShellSurface } from "../types";

type ResolveCharacterManagerSurfacePolicyParams = {
  surface: CharacterManagerShellSurface;
};

export type CharacterManagerSurfacePolicy = {
  isEmbeddedSurface: boolean;
  showQuickSwapCollapseToggle: boolean;
  showQuickSwapHelperText: boolean;
};

/**
 * Resolves surface-specific policy flags for Character Manager page and panel variants.
 */
export const resolveCharacterManagerSurfacePolicy = ({
  surface,
}: ResolveCharacterManagerSurfacePolicyParams): CharacterManagerSurfacePolicy => {
  const isEmbeddedSurface = surface === "panel";

  return {
    isEmbeddedSurface,
    showQuickSwapCollapseToggle: surface !== "panel",
    showQuickSwapHelperText: surface !== "panel",
  };
};
