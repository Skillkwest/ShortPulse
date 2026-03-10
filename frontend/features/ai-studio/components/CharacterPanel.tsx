/**
 * Primary Character panel for AI Studio.
 * Embeds the Character Manager workflow body without the standalone route chrome.
 */
import React from "react";
import {
  CharacterManagerShell,
  type ResolveCharacterDropReference,
} from "../../character-manager/components/CharacterManagerShell";

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
