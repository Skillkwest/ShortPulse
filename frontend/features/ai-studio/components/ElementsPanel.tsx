/**
 * Primary Elements panel for AI Studio.
 * Mounts the split Elements workspace and applies properties-rail scroll locking.
 */
import React from "react";
import { ElementsPanelSplitHost } from "../../elements-manager/components/ElementsPanelSplitHost";
import type {
  SharedMediaDetailSelectionTarget,
  SharedMediaDetailVideoSnapshotErrorHandler,
  SharedMediaDetailVideoSnapshotHandler,
} from "./detail-modal/detailModalPlatformTypes";
import { useElementsPanelPropertiesScrollLock } from "../hooks/useElementsPanelPropertiesScrollLock";
import type { CanvasTearOutComposerTargetRegistry } from "../hooks/useAiStudioCanvasTearOutTargets";
import type { ResolveInternalReferenceDrop } from "../logic/referenceSource/internalReferenceSource";
import type { InternalReferenceDragPayload } from "../utils/dragDrop";

type ElementsPanelProps = {
  resolveProfileImageDropSource?: ResolveInternalReferenceDrop;
  canvasTearOutTargetRegistry?: CanvasTearOutComposerTargetRegistry;
  resolveMediaLibraryInternalDropItem?: (payload: InternalReferenceDragPayload) => Promise<{
    kind: "media" | "prompt";
    id: string;
  } | null>;
  createRequestKey?: number;
  projectId?: string | null;
  isStorageQuotaBlocked?: boolean;
  detailSelectionTarget?: SharedMediaDetailSelectionTarget | null;
  onDetailSelectionTargetChange?: (target: SharedMediaDetailSelectionTarget | null) => void;
  onSnapshotVideoFrame?: SharedMediaDetailVideoSnapshotHandler;
  onSnapshotVideoFrameError?: SharedMediaDetailVideoSnapshotErrorHandler;
};

const ELEMENTS_PANEL_SIDE_GUTTER_REDUCTION_PX = 8;
const ELEMENTS_PANEL_ROOT_INLINE_STYLE: React.CSSProperties = {
  width: `calc(100% + ${ELEMENTS_PANEL_SIDE_GUTTER_REDUCTION_PX * 2}px)`,
  marginLeft: `-${ELEMENTS_PANEL_SIDE_GUTTER_REDUCTION_PX}px`,
  marginRight: `-${ELEMENTS_PANEL_SIDE_GUTTER_REDUCTION_PX}px`,
  maxWidth: "none",
};

export function ElementsPanel({
  resolveProfileImageDropSource,
  canvasTearOutTargetRegistry,
  resolveMediaLibraryInternalDropItem,
  createRequestKey = 0,
  projectId = null,
  isStorageQuotaBlocked = false,
  detailSelectionTarget = null,
  onDetailSelectionTargetChange,
  onSnapshotVideoFrame,
  onSnapshotVideoFrameError,
}: ElementsPanelProps) {
  const panelRootRef = React.useRef<HTMLDivElement | null>(null);

  useElementsPanelPropertiesScrollLock({
    rootRef: panelRootRef,
  });

  return (
    <div
      ref={panelRootRef}
      className="elements-panel-root"
      style={ELEMENTS_PANEL_ROOT_INLINE_STYLE}
    >
      <ElementsPanelSplitHost
        externalCreateRequestKey={createRequestKey}
        projectId={projectId}
        isStorageQuotaBlocked={isStorageQuotaBlocked}
        resolveMediaLibraryInternalDropItem={resolveMediaLibraryInternalDropItem}
        resolveProfileImageDropSource={resolveProfileImageDropSource}
        canvasTearOutTargetRegistry={canvasTearOutTargetRegistry}
        detailSelectionTarget={detailSelectionTarget}
        onDetailSelectionTargetChange={onDetailSelectionTargetChange}
        onSnapshotVideoFrame={onSnapshotVideoFrame}
        onSnapshotVideoFrameError={onSnapshotVideoFrameError}
      />
    </div>
  );
}
