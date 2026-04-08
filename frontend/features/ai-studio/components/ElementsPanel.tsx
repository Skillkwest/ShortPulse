/**
 * Primary Elements panel for AI Studio.
 * Mounts the Character-style Elements shell and applies manage-mode properties-rail scroll locking.
 */
import React from "react";
import { ElementsManagerShell } from "../../elements-manager/components/ElementsManagerShell";
import type { ElementsWorkflowTab } from "../../elements-manager/types";
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
  const [activeTab, setActiveTab] = React.useState<ElementsWorkflowTab>("manage");

  useElementsPanelPropertiesScrollLock({
    activeTab,
    rootRef: panelRootRef,
  });

  return (
    <div ref={panelRootRef} className="elements-panel-root">
      <ElementsManagerShell
        externalCreateRequestKey={createRequestKey}
        onActiveTabChange={setActiveTab}
        resolveProfileImageDropSource={resolveProfileImageDropSource}
      />
    </div>
  );
}
