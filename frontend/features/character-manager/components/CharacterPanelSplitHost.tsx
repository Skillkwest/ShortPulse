import React from "react";
import { ElementsEmbeddedMediaLibraryPanel } from "../../ai-studio/components/ElementsEmbeddedMediaLibraryPanel";
import { useReferenceGridHorizontalSplit } from "../../ai-studio/hooks/useReferenceGridHorizontalSplit";
import type { CharacterPanelUploadRequest } from "../../../lib/characterPanelUploadRequest";
import type { ResolveCharacterDropReference } from "../hooks/useCharacterManagerDroppedReferenceController";
import type { MediaLibrarySelectionPayload } from "../../ai-studio/hooks/useMediaLibraryPanelSelectionController";
import { CharacterPanelWorkspace } from "./CharacterPanelWorkspace";

type CharacterPanelSplitHostProps = {
  resolveCharacterDropReference?: ResolveCharacterDropReference;
  externalCreateRequestKey?: number;
  externalUploadRequest?: CharacterPanelUploadRequest | null;
  onExternalUploadRequestHandled?: (requestId: number) => void;
};

const CHARACTER_PANEL_DEFAULT_TOP_RATIO = 0.54;
const CHARACTER_PANEL_MIN_TOP_HEIGHT_PX = 232;
const CHARACTER_PANEL_MIN_BOTTOM_HEIGHT_PX = 248;

export function CharacterPanelSplitHost({
  resolveCharacterDropReference,
  externalCreateRequestKey = 0,
  externalUploadRequest = null,
  onExternalUploadRequestHandled,
}: CharacterPanelSplitHostProps) {
  const splitContainerRef = React.useRef<HTMLDivElement | null>(null);
  const [pendingMediaSelection, setPendingMediaSelection] = React.useState<{
    key: number;
    payload: MediaLibrarySelectionPayload;
  } | null>(null);
  const split = useReferenceGridHorizontalSplit({
    enabled: true,
    containerRef: splitContainerRef as React.MutableRefObject<HTMLElement | null>,
    defaultTopRatio: CHARACTER_PANEL_DEFAULT_TOP_RATIO,
    minTopSectionHeightPx: CHARACTER_PANEL_MIN_TOP_HEIGHT_PX,
    minBottomSectionHeightPx: CHARACTER_PANEL_MIN_BOTTOM_HEIGHT_PX,
    minTopRatioFloor: 0.32,
    ariaLabel: "Resize character workspace and media library sections",
  });

  return (
    <div ref={splitContainerRef} className="character-panel-split-host">
      <div className="character-panel-top-section" style={split.topSectionStyle}>
        <CharacterPanelWorkspace
          resolveCharacterDropReference={resolveCharacterDropReference}
          externalCreateRequestKey={externalCreateRequestKey}
          externalUploadRequest={externalUploadRequest}
          onExternalUploadRequestHandled={onExternalUploadRequestHandled}
          isEmbeddedMediaLibraryMaximized={split.isAllRefsExpanded}
          pendingMediaSelection={pendingMediaSelection}
        />
      </div>

      <div
        className="reference-grid-horizontal-divider-wrap character-panel-horizontal-divider-wrap"
        {...split.dividerProps}
      >
        <div className="reference-grid-horizontal-divider" />
      </div>

      <div className="character-panel-bottom-section" style={split.bottomSectionStyle}>
        <ElementsEmbeddedMediaLibraryPanel
          mediaCardInteractionMode="assignment"
          onSelectMedia={(payload) => {
            setPendingMediaSelection((current) => ({
              key: (current?.key ?? 0) + 1,
              payload,
            }));
          }}
        />
      </div>
    </div>
  );
}
