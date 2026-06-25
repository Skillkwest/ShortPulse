/**
 * Primary Character panel for AI Studio.
 * Mounts the split Character workspace and applies properties-rail scroll locking.
 */
import React from "react";
import { CharacterPanelSplitHost } from "../../character-manager/components/CharacterPanelSplitHost";
import type {
  SharedMediaDetailSelectionTarget,
  SharedMediaDetailVideoSnapshotErrorHandler,
  SharedMediaDetailVideoSnapshotHandler,
} from "./detail-modal/detailModalPlatformTypes";
import { useCharacterPanelPropertiesScrollLock } from "../hooks/useCharacterPanelPropertiesScrollLock";
import type { CanvasTearOutComposerTargetRegistry } from "../hooks/useAiStudioCanvasTearOutTargets";
import type { ResolveCharacterDropReference } from "../../character-manager/hooks/useCharacterManagerDroppedReferenceController";
import type { CharacterPanelUploadRequest } from "../../../lib/characterPanelUploadRequest";
import type { InternalReferenceDragPayload } from "../utils/dragDrop";

type CharacterPanelProps = {
  resolveCharacterDropReference?: ResolveCharacterDropReference;
  canvasTearOutTargetRegistry?: CanvasTearOutComposerTargetRegistry;
  resolveMediaLibraryInternalDropItem?: (payload: InternalReferenceDragPayload) => Promise<{
    kind: "media" | "prompt";
    id: string;
  } | null>;
  createRequestKey?: number;
  externalUploadRequest?: CharacterPanelUploadRequest | null;
  onExternalUploadRequestHandled?: (requestId: number) => void;
  projectId?: string | null;
  isStorageQuotaBlocked?: boolean;
  projectRouteRequested?: boolean;
  selectedCharacterId?: string | null;
  onSelectedCharacterIdChange?: (characterId: string | null) => void;
  detailSelectionTarget?: SharedMediaDetailSelectionTarget | null;
  onDetailSelectionTargetChange?: (target: SharedMediaDetailSelectionTarget | null) => void;
  onSnapshotVideoFrame?: SharedMediaDetailVideoSnapshotHandler;
  onSnapshotVideoFrameError?: SharedMediaDetailVideoSnapshotErrorHandler;
};

const CHARACTER_PANEL_SIDE_GUTTER_REDUCTION_PX = 8;
const CHARACTER_PANEL_ROOT_INLINE_STYLE: React.CSSProperties = {
  width: `calc(100% + ${CHARACTER_PANEL_SIDE_GUTTER_REDUCTION_PX * 2}px)`,
  marginLeft: `-${CHARACTER_PANEL_SIDE_GUTTER_REDUCTION_PX}px`,
  marginRight: `-${CHARACTER_PANEL_SIDE_GUTTER_REDUCTION_PX}px`,
  maxWidth: "none",
};

export function CharacterPanel({
  resolveCharacterDropReference,
  canvasTearOutTargetRegistry,
  resolveMediaLibraryInternalDropItem,
  createRequestKey = 0,
  externalUploadRequest = null,
  onExternalUploadRequestHandled,
  projectId = null,
  isStorageQuotaBlocked = false,
  projectRouteRequested = false,
  selectedCharacterId = null,
  onSelectedCharacterIdChange,
  detailSelectionTarget = null,
  onDetailSelectionTargetChange,
  onSnapshotVideoFrame,
  onSnapshotVideoFrameError,
}: CharacterPanelProps) {
  const panelRootRef = React.useRef<HTMLDivElement | null>(null);

  useCharacterPanelPropertiesScrollLock({
    rootRef: panelRootRef,
  });

  return (
    <div
      ref={panelRootRef}
      className="character-panel-root"
      style={CHARACTER_PANEL_ROOT_INLINE_STYLE}
    >
      <CharacterPanelSplitHost
        externalCreateRequestKey={createRequestKey}
        externalUploadRequest={externalUploadRequest}
        onExternalUploadRequestHandled={onExternalUploadRequestHandled}
        projectId={projectId}
        preferredCharacterId={selectedCharacterId}
        suppressSelectedCharacterPersistence={projectRouteRequested || Boolean(projectId)}
        onSelectedCharacterIdChange={onSelectedCharacterIdChange}
        isStorageQuotaBlocked={isStorageQuotaBlocked}
        resolveCharacterDropReference={resolveCharacterDropReference}
        canvasTearOutTargetRegistry={canvasTearOutTargetRegistry}
        resolveMediaLibraryInternalDropItem={resolveMediaLibraryInternalDropItem}
        detailSelectionTarget={detailSelectionTarget}
        onDetailSelectionTargetChange={onDetailSelectionTargetChange}
        onSnapshotVideoFrame={onSnapshotVideoFrame}
        onSnapshotVideoFrameError={onSnapshotVideoFrameError}
      />
    </div>
  );
}
