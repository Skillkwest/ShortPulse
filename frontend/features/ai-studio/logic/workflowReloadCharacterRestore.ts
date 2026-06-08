/**
 * Character restore policy for workflow reload.
 * Reload may reuse a saved look only when the saved character still exists.
 */
import type { StudioOutput } from "../types";

export type WorkflowReloadCharacterOption = {
  id: string | null | undefined;
};

export type WorkflowReloadCharacterSelection = {
  characterId: string;
  lookId: string;
};

export const resolveWorkflowReloadCharacterSelection = ({
  characterContext,
  characterOptions,
}: {
  characterContext: StudioOutput["characterContext"] | null | undefined;
  characterOptions: readonly WorkflowReloadCharacterOption[];
}): WorkflowReloadCharacterSelection | null => {
  const characterId = characterContext?.characterId?.trim() ?? "";
  if (characterContext?.applied !== true || !characterId) return null;
  const characterExists = characterOptions.some(
    (option) => (option.id?.trim() ?? "") === characterId
  );
  if (!characterExists) return null;
  return {
    characterId,
    lookId: characterContext.lookId?.trim() ?? "",
  };
};
