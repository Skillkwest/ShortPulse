/**
 * Character Manager surface policy hook.
 * Returns surface-specific policy flags for page and panel shells.
 */
import React from "react";
import { resolveCharacterManagerSurfacePolicy } from "../logic/characterManagerSurfacePolicy";
import type { CharacterManagerShellSurface } from "../types";

type UseCharacterManagerSurfacePolicyParams = {
  surface: CharacterManagerShellSurface;
};

/**
 * Returns derived surface policy for Character Manager shells.
 */
export const useCharacterManagerSurfacePolicy = ({
  surface,
}: UseCharacterManagerSurfacePolicyParams) => {
  return {
    ...resolveCharacterManagerSurfacePolicy({
      surface,
    }),
  };
};
