/**
 * AI Studio Character panel scroll-lock hook.
 * Locks the properties rail scroll while the embedded Character panel is mounted.
 */
import React from "react";

type UseCharacterPanelPropertiesScrollLockParams = {
  rootRef: React.RefObject<HTMLElement | null>;
};

/**
 * Applies and restores the AI Studio properties-rail scroll lock for the embedded Character panel.
 */
export function useCharacterPanelPropertiesScrollLock({
  rootRef,
}: UseCharacterPanelPropertiesScrollLockParams) {
  React.useEffect(() => {
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
  }, [rootRef]);
}
