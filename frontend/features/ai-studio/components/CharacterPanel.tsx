/**
 * Primary Character panel for AI Studio.
 * Embeds the Character Manager workflow body without the standalone route chrome.
 */
import React from "react";
import { CharacterManagerShell } from "../../character-manager/components/CharacterManagerShell";
import { useCharacterPanelPropertiesScrollLock } from "../hooks/useCharacterPanelPropertiesScrollLock";
import type { ResolveCharacterDropReference } from "../../character-manager/hooks/useCharacterManagerDroppedReferenceController";
import type { CharacterWorkflowTab } from "../../character-manager/types";
import type { CharacterPanelUploadRequest } from "../../../lib/characterPanelUploadRequest";

type CharacterPanelProps = {
  resolveCharacterDropReference?: ResolveCharacterDropReference;
  createRequestKey?: number;
  externalUploadRequest?: CharacterPanelUploadRequest | null;
  onExternalUploadRequestHandled?: (requestId: number) => void;
};

export function CharacterPanel({
  resolveCharacterDropReference,
  createRequestKey = 0,
  externalUploadRequest = null,
  onExternalUploadRequestHandled,
}: CharacterPanelProps) {
  const panelRootRef = React.useRef<HTMLDivElement | null>(null);
  const [activeTab, setActiveTab] = React.useState<CharacterWorkflowTab>("manage");

  useCharacterPanelPropertiesScrollLock({
    activeTab,
    rootRef: panelRootRef,
  });

  return (
    <div ref={panelRootRef} className="character-panel-root">
      <CharacterManagerShell
        surface="panel"
        initialWorkflowTab="manage"
        externalCreateRequestKey={createRequestKey}
        externalQuickSwapUploadRequest={externalUploadRequest}
        onExternalQuickSwapUploadRequestHandled={onExternalUploadRequestHandled}
        resolveCharacterDropReference={resolveCharacterDropReference}
        onActiveTabChange={setActiveTab}
      />
    </div>
  );
}
