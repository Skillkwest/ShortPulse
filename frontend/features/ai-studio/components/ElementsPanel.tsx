/**
 * Primary Elements panel for AI Studio.
 * Mounts the split Elements workspace and applies properties-rail scroll locking.
 */
import React from "react";
import { ElementsPanelSplitHost } from "../../elements-manager/components/ElementsPanelSplitHost";
import { useElementsPanelPropertiesScrollLock } from "../hooks/useElementsPanelPropertiesScrollLock";
import type { ResolveInternalReferenceDrop } from "../logic/referenceSource/internalReferenceSource";
import type { InternalReferenceDragPayload } from "../utils/dragDrop";

type ElementsPanelProps = {
  resolveProfileImageDropSource?: ResolveInternalReferenceDrop;
  resolveMediaLibraryInternalDropItem?: (payload: InternalReferenceDragPayload) => Promise<{
    kind: "media" | "prompt";
    id: string;
  } | null>;
  createRequestKey?: number;
  projectId?: string | null;
};

export function ElementsPanel({
  resolveProfileImageDropSource,
  resolveMediaLibraryInternalDropItem,
  createRequestKey = 0,
  projectId = null,
}: ElementsPanelProps) {
  const panelRootRef = React.useRef<HTMLDivElement | null>(null);

  useElementsPanelPropertiesScrollLock({
    rootRef: panelRootRef,
  });

  return (
    <div ref={panelRootRef} className="elements-panel-root">
      <ElementsPanelSplitHost
        externalCreateRequestKey={createRequestKey}
        projectId={projectId}
        resolveMediaLibraryInternalDropItem={resolveMediaLibraryInternalDropItem}
        resolveProfileImageDropSource={resolveProfileImageDropSource}
      />
    </div>
  );
}
