/**
 * Primary Elements panel for AI Studio.
 * Mounts the embedded Elements shell and applies properties-rail scroll locking.
 */
import React from "react";
import { ElementsManagerShell } from "../../elements-manager/components/ElementsManagerShell";
import { useElementsPanelPropertiesScrollLock } from "../hooks/useElementsPanelPropertiesScrollLock";
import type { ResolveInternalReferenceDrop } from "../logic/referenceSource/internalReferenceSource";

type ElementsPanelProps = {
  resolveProfileImageDropSource?: ResolveInternalReferenceDrop;
  createRequestKey?: number;
};

export function ElementsPanel({
  resolveProfileImageDropSource,
  createRequestKey = 0,
}: ElementsPanelProps) {
  const panelRootRef = React.useRef<HTMLDivElement | null>(null);

  useElementsPanelPropertiesScrollLock({
    rootRef: panelRootRef,
  });

  return (
    <div ref={panelRootRef} className="elements-panel-root">
      <ElementsManagerShell
        externalCreateRequestKey={createRequestKey}
        resolveProfileImageDropSource={resolveProfileImageDropSource}
      />
    </div>
  );
}
