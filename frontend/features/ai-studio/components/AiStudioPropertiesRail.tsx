/**
 * AI Studio properties rail boundary.
 * Keeps properties panel rendering isolated behind memoized shell contracts.
 */
import React from "react";
import type { ToolId } from "../types";
import { recordAiStudioShellSectionRender } from "../logic/shellRenderCounters";

const AI_PROPERTIES_RAIL_ENTER_TRANSITION_MS = 180;
const AI_PROPERTIES_RAIL_EXIT_TRANSITION_MS = 180;

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
  const pendingPanelSnapshotRef = React.useRef<{ key: string; content: React.ReactNode } | null>(
    null
  );
  const [renderedPanel, setRenderedPanel] = React.useState<{
    key: string;
    content: React.ReactNode;
  } | null>(() => (selectedTool && panelKey ? { key: panelKey, content: panelContent } : null));
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
  const shouldRenderRail = renderedPanel !== null || exitingPanel !== null;

  const clearExitTimeout = React.useCallback(() => {
    if (clearExitTimeoutRef.current == null) return;
    window.clearTimeout(clearExitTimeoutRef.current);
    clearExitTimeoutRef.current = null;
  }, []);

  React.useEffect(() => clearExitTimeout, [clearExitTimeout]);

  React.useEffect(() => {
    if (activePanelSnapshot?.key === renderedPanel?.key) {
      setRenderedPanel(activePanelSnapshot);
      return;
    }

    if (
      (renderedPanel || exitingPanel) &&
      leftColumnRef.current &&
      typeof document !== "undefined" &&
      document.activeElement instanceof HTMLElement &&
      leftColumnRef.current.contains(document.activeElement)
    ) {
      document.activeElement.blur();
    }

    pendingPanelSnapshotRef.current = activePanelSnapshot;

    if (exitingPanel) {
      return;
    }

    clearExitTimeout();

    if (renderedPanel) {
      setExitingPanel(renderedPanel);
      setRenderedPanel(null);
      clearExitTimeoutRef.current = window.setTimeout(() => {
        const nextPanelSnapshot = pendingPanelSnapshotRef.current;
        pendingPanelSnapshotRef.current = null;
        setExitingPanel(null);
        setRenderedPanel(nextPanelSnapshot);
        if (nextPanelSnapshot) {
          const nextAnimationName = nextEnterAnimationNameRef.current;
          setEnterAnimationName(nextAnimationName);
          nextEnterAnimationNameRef.current =
            nextAnimationName === "ai-properties-rail-enter-a"
              ? "ai-properties-rail-enter-b"
              : "ai-properties-rail-enter-a";
        } else {
          setEnterAnimationName(null);
        }
        clearExitTimeoutRef.current = null;
      }, AI_PROPERTIES_RAIL_EXIT_TRANSITION_MS);
      return;
    }

    if (activePanelSnapshot) {
      const nextAnimationName = nextEnterAnimationNameRef.current;
      setExitingPanel(null);
      setRenderedPanel(activePanelSnapshot);
      setEnterAnimationName(nextAnimationName);
      nextEnterAnimationNameRef.current =
        nextAnimationName === "ai-properties-rail-enter-a"
          ? "ai-properties-rail-enter-b"
          : "ai-properties-rail-enter-a";
    } else {
      setRenderedPanel(null);
      setExitingPanel(null);
      setEnterAnimationName(null);
    }
  }, [activePanelSnapshot, clearExitTimeout, exitingPanel, leftColumnRef, renderedPanel]);

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
              animationDuration: `${AI_PROPERTIES_RAIL_ENTER_TRANSITION_MS}ms`,
              animationFillMode: "both",
              animationName: enterAnimationName,
              animationTimingFunction: "cubic-bezier(0.22, 0.61, 0.36, 1)",
            }
          : undefined
      }
    >
      {renderedPanel ? renderedPanel.content : null}
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
