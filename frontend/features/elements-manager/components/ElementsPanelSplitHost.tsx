import React from "react";
import { ElementsEmbeddedMediaLibraryPanel } from "../../ai-studio/components/ElementsEmbeddedMediaLibraryPanel";
import { useReferenceGridHorizontalSplit } from "../../ai-studio/hooks/useReferenceGridHorizontalSplit";
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

const ELEMENTS_PANEL_DEFAULT_TOP_RATIO = 0.54;
const ELEMENTS_PANEL_MIN_TOP_HEIGHT_PX = 232;
const ELEMENTS_PANEL_MIN_BOTTOM_HEIGHT_PX = 248;

export function ElementsPanelSplitHost({
  projectId = null,
  resolveMediaLibraryInternalDropItem,
  resolveProfileImageDropSource,
  externalCreateRequestKey = 0,
}: ElementsPanelSplitHostProps) {
  const splitContainerRef = React.useRef<HTMLDivElement | null>(null);
  const split = useReferenceGridHorizontalSplit({
    enabled: true,
    containerRef: splitContainerRef as React.MutableRefObject<HTMLElement | null>,
    defaultTopRatio: ELEMENTS_PANEL_DEFAULT_TOP_RATIO,
    minTopSectionHeightPx: ELEMENTS_PANEL_MIN_TOP_HEIGHT_PX,
    minBottomSectionHeightPx: ELEMENTS_PANEL_MIN_BOTTOM_HEIGHT_PX,
    minTopRatioFloor: 0.32,
    ariaLabel: "Resize elements workspace and media library sections",
  });

  return (
    <div ref={splitContainerRef} className="elements-panel-split-host">
      <div className="elements-panel-top-section" style={split.topSectionStyle}>
        <ElementsManagerShell
          externalCreateRequestKey={externalCreateRequestKey}
          isEmbeddedMediaLibraryMaximized={split.isAllRefsExpanded}
          resolveProfileImageDropSource={resolveProfileImageDropSource}
        />
      </div>

      <div
        className="reference-grid-horizontal-divider-wrap elements-panel-horizontal-divider-wrap"
        {...split.dividerProps}
      >
        <div className="reference-grid-horizontal-divider" />
      </div>

      <div className="elements-panel-bottom-section" style={split.bottomSectionStyle}>
        <ElementsEmbeddedMediaLibraryPanel
          projectId={projectId}
          resolveInternalDropItem={resolveMediaLibraryInternalDropItem}
        />
      </div>
    </div>
  );
}
