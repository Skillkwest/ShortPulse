/**
 * Primary Character panel for AI Studio.
 * Embeds the Character Manager workflow body without the standalone route chrome.
 */
import React from "react";
import { CharacterManagerShell } from "../../character-manager/components/CharacterManagerShell";
import type { ResolveCharacterDropReference } from "../../character-manager/hooks/useCharacterManagerDroppedReferenceController";

type CharacterPanelProps = {
  beginnerMode: boolean;
  resolveCharacterDropReference?: ResolveCharacterDropReference;
};

export function CharacterPanel({
  beginnerMode,
  resolveCharacterDropReference,
}: CharacterPanelProps) {
  return (
    <CharacterManagerShell
      surface="panel"
      initialWorkflowTab="manage"
      beginnerModeOverride={beginnerMode}
      resolveCharacterDropReference={resolveCharacterDropReference}
    />
  );
}
