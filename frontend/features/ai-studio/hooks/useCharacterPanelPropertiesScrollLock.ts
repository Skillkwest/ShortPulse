/**
 * AI Studio Character panel scroll-lock hook.
 * Locks the properties rail scroll only while the embedded Character Profile tab is active.
 */
import React from "react";
import type { CharacterWorkflowTab } from "../../character-manager/types";

type UseCharacterPanelPropertiesScrollLockParams = {
  activeTab: CharacterWorkflowTab;
  rootRef: React.RefObject<HTMLElement | null>;
};

/**
 * Applies and restores the AI Studio properties-rail scroll lock for the embedded Character panel.
 */
export function useCharacterPanelPropertiesScrollLock({
  activeTab,
  rootRef,
}: UseCharacterPanelPropertiesScrollLockParams) {
  React.useEffect(() => {
    if (activeTab !== "create") return;
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
