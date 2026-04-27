/**
 * AI Studio properties rail boundary.
 * Keeps properties panel rendering isolated behind memoized shell contracts.
 */
import React from "react";
import type { ToolId } from "../types";
import { recordAiStudioShellSectionRender } from "../logic/shellRenderCounters";

const AI_PROPERTIES_RAIL_TRANSITION_MS = 180;

type AiStudioPropertiesRailProps = {
  selectedTool: ToolId | null;
  leftColumnRef: React.RefObject<HTMLElement>;
  panelKey: string | null;
  panelContent: React.ReactNode;
};

export const AiStudioPropertiesRail = React.memo(function AiStudioPropertiesRail({
  selectedTool,
  leftColumnRef,
  panelKey,
  panelContent,
}: AiStudioPropertiesRailProps) {
  const clearExitTimeoutRef = React.useRef<number | null>(null);
  const previousPanelSnapshotRef = React.useRef<{ key: string; content: React.ReactNode } | null>(
    selectedTool && panelKey ? { key: panelKey, content: panelContent } : null
  );
  const [exitingPanel, setExitingPanel] = React.useState<{
    key: string;
    content: React.ReactNode;
  } | null>(null);
  const [enterAnimationName, setEnterAnimationName] = React.useState<string | null>(null);
  const nextEnterAnimationNameRef = React.useRef<
    "ai-properties-rail-enter-a" | "ai-properties-rail-enter-b"
  >("ai-properties-rail-enter-a");

  const activePanelSnapshot = React.useMemo(
    () => (selectedTool && panelKey ? { key: panelKey, content: panelContent } : null),
    [panelContent, panelKey, selectedTool]
  );
  const shouldRenderRail = activePanelSnapshot !== null || exitingPanel !== null;

  const clearExitTimeout = React.useCallback(() => {
    if (clearExitTimeoutRef.current == null) return;
    window.clearTimeout(clearExitTimeoutRef.current);
    clearExitTimeoutRef.current = null;
  }, []);

  React.useEffect(() => clearExitTimeout, [clearExitTimeout]);

  React.useEffect(() => {
    const previousPanelSnapshot = previousPanelSnapshotRef.current;
    const panelKeyChanged = previousPanelSnapshot?.key !== activePanelSnapshot?.key;

    if (!panelKeyChanged) {
      previousPanelSnapshotRef.current = activePanelSnapshot;
      return;
    }

    if (
      previousPanelSnapshot &&
      leftColumnRef.current &&
      typeof document !== "undefined" &&
      document.activeElement instanceof HTMLElement &&
      leftColumnRef.current.contains(document.activeElement)
    ) {
      document.activeElement.blur();
    }

    clearExitTimeout();
    if (previousPanelSnapshot) {
      setExitingPanel(previousPanelSnapshot);
      clearExitTimeoutRef.current = window.setTimeout(() => {
        setExitingPanel((currentValue) =>
          currentValue?.key === previousPanelSnapshot.key ? null : currentValue
        );
        clearExitTimeoutRef.current = null;
      }, AI_PROPERTIES_RAIL_TRANSITION_MS);
    } else {
      setExitingPanel(null);
    }

    if (activePanelSnapshot) {
      const nextAnimationName = nextEnterAnimationNameRef.current;
      setEnterAnimationName(nextAnimationName);
      nextEnterAnimationNameRef.current =
        nextAnimationName === "ai-properties-rail-enter-a"
          ? "ai-properties-rail-enter-b"
          : "ai-properties-rail-enter-a";
    } else {
      setEnterAnimationName(null);
    }

    previousPanelSnapshotRef.current = activePanelSnapshot;
  }, [activePanelSnapshot, clearExitTimeout, leftColumnRef]);

  if (!shouldRenderRail) return null;
  recordAiStudioShellSectionRender("properties");
  return (
    <aside
      ref={leftColumnRef}
      className="panel ai-panel ai-properties"
      data-panel-transition={enterAnimationName ? "enter" : undefined}
      style={
        enterAnimationName
          ? {
              animationDuration: `${AI_PROPERTIES_RAIL_TRANSITION_MS}ms`,
              animationFillMode: "both",
              animationName: enterAnimationName,
              animationTimingFunction: "cubic-bezier(0.22, 0.61, 0.36, 1)",
            }
          : undefined
      }
    >
      {activePanelSnapshot ? activePanelSnapshot.content : null}
      {exitingPanel ? (
        <div
          aria-hidden="true"
          className="ai-properties-panel-transition-exit"
          data-exiting-panel-key={exitingPanel.key}
        >
          {exitingPanel.content}
        </div>
      ) : null}
    </aside>
  );
});
