/**
 * Primary Character panel for AI Studio.
 * Embeds the Character Manager workflow body without the standalone route chrome.
 */
import React from "react";
import { CharacterManagerShell } from "../../character-manager/components/CharacterManagerShell";

type CharacterPanelProps = {
  beginnerMode: boolean;
};

export function CharacterPanel({ beginnerMode }: CharacterPanelProps) {
  return <CharacterManagerShell surface="panel" beginnerModeOverride={beginnerMode} />;
}
