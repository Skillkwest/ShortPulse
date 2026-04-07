/**
 * AI Studio Elements panel scroll-lock hook.
 * Locks the properties rail scroll while the embedded Elements manager tab is active.
 */
import React from "react";
import type { ElementsWorkflowTab } from "../../elements-manager/types";

type UseElementsPanelPropertiesScrollLockParams = {
  activeTab: ElementsWorkflowTab;
  rootRef: React.RefObject<HTMLElement | null>;
};

export function useElementsPanelPropertiesScrollLock({
  activeTab,
  rootRef,
}: UseElementsPanelPropertiesScrollLockParams) {
  React.useEffect(() => {
    if (activeTab !== "manage") return;
    const rootNode = rootRef.current;
    if (!rootNode) return;
    const propertiesPanel = rootNode.closest(".ai-properties");
    if (!(propertiesPanel instanceof HTMLElement)) return;
    const previousOverflowY = propertiesPanel.style.overflowY;
    const previousOverscrollBehaviorY = propertiesPanel.style.overscrollBehaviorY;
    propertiesPanel.style.overflowY = "hidden";
    propertiesPanel.style.overscrollBehaviorY = "none";
    return () => {
      propertiesPanel.style.overflowY = previousOverflowY;
      propertiesPanel.style.overscrollBehaviorY = previousOverscrollBehaviorY;
    };
  }, [activeTab, rootRef]);
}
