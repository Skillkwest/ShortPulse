import React from "react";
import { ElementsEmbeddedMediaLibraryPanel } from "../../ai-studio/components/ElementsEmbeddedMediaLibraryPanel";
import type { ResolveInternalReferenceDrop } from "../../ai-studio/logic/referenceSource/internalReferenceSource";
import type { InternalReferenceDragPayload } from "../../ai-studio/utils/dragDrop";
import { ElementsManagerShell } from "./ElementsManagerShell";

type ElementsPanelSplitHostProps = {
  projectId?: string | null;
  resolveMediaLibraryInternalDropItem?: (payload: InternalReferenceDragPayload) => Promise<{
    kind: "media" | "prompt";
    id: string;
  } | null>;
  resolveProfileImageDropSource?: ResolveInternalReferenceDrop;
  externalCreateRequestKey?: number;
};

const ELEMENTS_PANEL_MIN_TOP_HEIGHT_PX = 336;
const ELEMENTS_PANEL_MAX_BOTTOM_HEIGHT_PX = 544;
const ELEMENTS_PANEL_TOP_SECTION_INLINE_STYLE: React.CSSProperties = {
  flex: "1 1 auto",
  minHeight: `${ELEMENTS_PANEL_MIN_TOP_HEIGHT_PX}px`,
};

export function ElementsPanelSplitHost({
  projectId = null,
  resolveMediaLibraryInternalDropItem,
  resolveProfileImageDropSource,
  externalCreateRequestKey = 0,
}: ElementsPanelSplitHostProps) {
  const bottomSectionStyle = React.useMemo<React.CSSProperties>(
    () => ({
      flexGrow: 0,
      flexShrink: 0,
      flexBasis: `${ELEMENTS_PANEL_MAX_BOTTOM_HEIGHT_PX}px`,
      height: `${ELEMENTS_PANEL_MAX_BOTTOM_HEIGHT_PX}px`,
      minHeight: `${ELEMENTS_PANEL_MAX_BOTTOM_HEIGHT_PX}px`,
      maxHeight: `${ELEMENTS_PANEL_MAX_BOTTOM_HEIGHT_PX}px`,
      overflow: "hidden",
    }),
    []
  );

  return (
    <div className="elements-panel-split-host">
      <div className="elements-panel-top-section" style={ELEMENTS_PANEL_TOP_SECTION_INLINE_STYLE}>
        <ElementsManagerShell
          externalCreateRequestKey={externalCreateRequestKey}
          resolveProfileImageDropSource={resolveProfileImageDropSource}
        />
      </div>

      <div className="elements-panel-bottom-section" style={bottomSectionStyle}>
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
