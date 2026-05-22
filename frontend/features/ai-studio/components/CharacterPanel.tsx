/**
 * Primary Character panel for AI Studio.
 * Mounts the split Character workspace and applies properties-rail scroll locking.
 */
import React from "react";
import { CharacterPanelSplitHost } from "../../character-manager/components/CharacterPanelSplitHost";
import { useCharacterPanelPropertiesScrollLock } from "../hooks/useCharacterPanelPropertiesScrollLock";
import type { ResolveCharacterDropReference } from "../../character-manager/hooks/useCharacterManagerDroppedReferenceController";
import type { CharacterPanelUploadRequest } from "../../../lib/characterPanelUploadRequest";
import type { InternalReferenceDragPayload } from "../utils/dragDrop";

type CharacterPanelProps = {
  resolveCharacterDropReference?: ResolveCharacterDropReference;
  resolveMediaLibraryInternalDropItem?: (payload: InternalReferenceDragPayload) => Promise<{
    kind: "media" | "prompt";
    id: string;
  } | null>;
  createRequestKey?: number;
  externalUploadRequest?: CharacterPanelUploadRequest | null;
  onExternalUploadRequestHandled?: (requestId: number) => void;
  projectId?: string | null;
  projectRouteRequested?: boolean;
  selectedCharacterId?: string | null;
  onSelectedCharacterIdChange?: (characterId: string | null) => void;
};

export function CharacterPanel({
  resolveCharacterDropReference,
  resolveMediaLibraryInternalDropItem,
  createRequestKey = 0,
  externalUploadRequest = null,
  onExternalUploadRequestHandled,
  projectId = null,
  projectRouteRequested = false,
  selectedCharacterId = null,
  onSelectedCharacterIdChange,
}: CharacterPanelProps) {
  const panelRootRef = React.useRef<HTMLDivElement | null>(null);

  useCharacterPanelPropertiesScrollLock({
    rootRef: panelRootRef,
  });

  return (
    <div ref={panelRootRef} className="character-panel-root">
      <CharacterPanelSplitHost
        externalCreateRequestKey={createRequestKey}
        externalUploadRequest={externalUploadRequest}
        onExternalUploadRequestHandled={onExternalUploadRequestHandled}
        projectId={projectId}
        preferredCharacterId={selectedCharacterId}
        suppressSelectedCharacterPersistence={projectRouteRequested || Boolean(projectId)}
        onSelectedCharacterIdChange={onSelectedCharacterIdChange}
        resolveCharacterDropReference={resolveCharacterDropReference}
        resolveMediaLibraryInternalDropItem={resolveMediaLibraryInternalDropItem}
      />
    </div>
  );
}
