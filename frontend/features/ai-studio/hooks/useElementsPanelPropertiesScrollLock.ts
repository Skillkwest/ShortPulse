/**
 * AI Studio Elements panel scroll-lock hook.
 * Locks the properties rail scroll while the embedded Elements manager is mounted.
 */
import React from "react";

type UseElementsPanelPropertiesScrollLockParams = {
  rootRef: React.RefObject<HTMLElement | null>;
};

export function useElementsPanelPropertiesScrollLock({
  rootRef,
}: UseElementsPanelPropertiesScrollLockParams) {
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
