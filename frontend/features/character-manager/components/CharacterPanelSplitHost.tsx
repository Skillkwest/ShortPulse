import React from "react";
import { ElementsEmbeddedMediaLibraryPanel } from "../../ai-studio/components/ElementsEmbeddedMediaLibraryPanel";
import { useReferenceGridHorizontalSplit } from "../../ai-studio/hooks/useReferenceGridHorizontalSplit";
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

const CHARACTER_PANEL_DEFAULT_TOP_RATIO = 0.36;
const CHARACTER_PANEL_MIN_TOP_HEIGHT_PX = 336;
const CHARACTER_PANEL_MIN_BOTTOM_HEIGHT_PX = 248;
const CHARACTER_PANEL_MAX_BOTTOM_HEIGHT_PX = 500;

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
  const splitContainerRef = React.useRef<HTMLDivElement | null>(null);
  const split = useReferenceGridHorizontalSplit({
    enabled: true,
    containerRef: splitContainerRef as React.MutableRefObject<HTMLElement | null>,
    defaultTopRatio: CHARACTER_PANEL_DEFAULT_TOP_RATIO,
    minTopSectionHeightPx: CHARACTER_PANEL_MIN_TOP_HEIGHT_PX,
    minBottomSectionHeightPx: CHARACTER_PANEL_MIN_BOTTOM_HEIGHT_PX,
    maxBottomSectionHeightPx: CHARACTER_PANEL_MAX_BOTTOM_HEIGHT_PX,
    minTopRatioFloor: 0.32,
    ariaLabel: "Resize character workspace and media library sections",
  });
  const topSectionStyle = React.useMemo<React.CSSProperties>(
    () => ({
      ...split.topSectionStyle,
    }),
    [split.topSectionStyle]
  );
  const bottomSectionStyle = React.useMemo<React.CSSProperties>(
    () => ({
      ...split.bottomSectionStyle,
      maxHeight: `${CHARACTER_PANEL_MAX_BOTTOM_HEIGHT_PX}px`,
    }),
    [split.bottomSectionStyle]
  );

  return (
    <div ref={splitContainerRef} className="character-panel-split-host">
      <div className="character-panel-top-section" style={topSectionStyle}>
        <CharacterPanelWorkspace
          resolveCharacterDropReference={resolveCharacterDropReference}
          externalCreateRequestKey={externalCreateRequestKey}
          externalUploadRequest={externalUploadRequest}
          onExternalUploadRequestHandled={onExternalUploadRequestHandled}
          isEmbeddedMediaLibraryMaximized={split.isAllRefsExpanded}
          preferredCharacterId={preferredCharacterId}
          suppressSelectedCharacterPersistence={suppressSelectedCharacterPersistence}
          onSelectedCharacterIdChange={onSelectedCharacterIdChange}
        />
      </div>

      <div
        className="reference-grid-horizontal-divider-wrap character-panel-horizontal-divider-wrap"
        {...split.dividerProps}
      >
        <div className="reference-grid-horizontal-divider" />
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
