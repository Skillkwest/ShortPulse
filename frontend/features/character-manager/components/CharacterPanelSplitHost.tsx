import React from "react";
import { ElementsEmbeddedMediaLibraryPanel } from "../../ai-studio/components/ElementsEmbeddedMediaLibraryPanel";
import type { CharacterPanelUploadRequest } from "../../../lib/characterPanelUploadRequest";
import type { ResolveCharacterDropReference } from "../hooks/useCharacterManagerDroppedReferenceController";
import type { InternalReferenceDragPayload } from "../../ai-studio/utils/dragDrop";
import { CharacterPanelWorkspace } from "./CharacterPanelWorkspace";

type CharacterPanelSplitHostProps = {
  resolveCharacterDropReference?: ResolveCharacterDropReference;
  resolveMediaLibraryInternalDropItem?: (payload: InternalReferenceDragPayload) => Promise<{
    kind: "media" | "prompt";
    id: string;
  } | null>;
  externalCreateRequestKey?: number;
  externalUploadRequest?: CharacterPanelUploadRequest | null;
  onExternalUploadRequestHandled?: (requestId: number) => void;
  projectId?: string | null;
  preferredCharacterId?: string | null;
  suppressSelectedCharacterPersistence?: boolean;
  onSelectedCharacterIdChange?: (characterId: string | null) => void;
};

const CHARACTER_PANEL_MIN_TOP_HEIGHT_PX = 336;
const CHARACTER_PANEL_MAX_BOTTOM_HEIGHT_PX = 502;
const CHARACTER_PANEL_MAKE_WRAPPER_BACKGROUND = "#131518";
const CHARACTER_PANEL_SPLIT_HOST_INLINE_STYLE = {
  "--character-panel-section-bg": CHARACTER_PANEL_MAKE_WRAPPER_BACKGROUND,
} as React.CSSProperties;
const CHARACTER_PANEL_TOP_SECTION_INLINE_STYLE: React.CSSProperties = {
  flex: "1 1 auto",
  minHeight: `${CHARACTER_PANEL_MIN_TOP_HEIGHT_PX}px`,
};

export function CharacterPanelSplitHost({
  resolveCharacterDropReference,
  resolveMediaLibraryInternalDropItem,
  externalCreateRequestKey = 0,
  externalUploadRequest = null,
  onExternalUploadRequestHandled,
  projectId = null,
  preferredCharacterId = null,
  suppressSelectedCharacterPersistence = false,
  onSelectedCharacterIdChange,
}: CharacterPanelSplitHostProps) {
  const bottomSectionStyle = React.useMemo<React.CSSProperties>(
    () => ({
      flexGrow: 0,
      flexShrink: 0,
      flexBasis: `${CHARACTER_PANEL_MAX_BOTTOM_HEIGHT_PX}px`,
      height: `${CHARACTER_PANEL_MAX_BOTTOM_HEIGHT_PX}px`,
      minHeight: `${CHARACTER_PANEL_MAX_BOTTOM_HEIGHT_PX}px`,
      maxHeight: `${CHARACTER_PANEL_MAX_BOTTOM_HEIGHT_PX}px`,
      background: CHARACTER_PANEL_MAKE_WRAPPER_BACKGROUND,
      backgroundColor: CHARACTER_PANEL_MAKE_WRAPPER_BACKGROUND,
      overflow: "hidden",
    }),
    []
  );
  return (
    <div className="character-panel-split-host" style={CHARACTER_PANEL_SPLIT_HOST_INLINE_STYLE}>
      <div className="character-panel-top-section" style={CHARACTER_PANEL_TOP_SECTION_INLINE_STYLE}>
        <CharacterPanelWorkspace
          resolveCharacterDropReference={resolveCharacterDropReference}
          externalCreateRequestKey={externalCreateRequestKey}
          externalUploadRequest={externalUploadRequest}
          onExternalUploadRequestHandled={onExternalUploadRequestHandled}
          preferredCharacterId={preferredCharacterId}
          suppressSelectedCharacterPersistence={suppressSelectedCharacterPersistence}
          onSelectedCharacterIdChange={onSelectedCharacterIdChange}
        />
      </div>

      <div className="character-panel-bottom-section" style={bottomSectionStyle}>
        <ElementsEmbeddedMediaLibraryPanel
          mediaCardInteractionMode="assignment"
          fixedVisualAspectRatio={null}
          projectId={projectId}
          resolveInternalDropItem={resolveMediaLibraryInternalDropItem}
        />
      </div>
    </div>
  );
}
