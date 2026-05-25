/**
 * Resolves the Create workflow model modal context from the active runtime lane.
 * Keeps Standard Character Mode from drifting away from the edit-model picker lane.
 */

export type CreateModelModalRuntimeMode = "standard" | "pulse";

/**
 * Returns the canonical Create model modal context for the current runtime state.
 */
export const resolveCreateModelModalContext = ({
  expertCreateMode,
  isCharacterModeEnabled,
}: {
  expertCreateMode: CreateModelModalRuntimeMode;
  isCharacterModeEnabled: boolean;
}): "character-image" | "text-image" => {
  if (expertCreateMode === "standard" && isCharacterModeEnabled) {
    return "character-image";
  }
  return "text-image";
};
