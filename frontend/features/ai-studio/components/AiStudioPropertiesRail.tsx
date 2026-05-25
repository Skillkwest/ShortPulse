/**
 * AI Studio properties rail boundary.
 * Keeps properties panel rendering isolated behind memoized shell contracts.
 */
import React from "react";
import type { ToolId } from "../types";
import { recordAiStudioShellSectionRender } from "../logic/shellRenderCounters";

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
  if (!selectedTool || !panelKey) return null;

  recordAiStudioShellSectionRender("properties");

  const inlineStyle =
    selectedTool === "character"
      ? {
          minHeight: 0,
          height: "auto",
          maxHeight: "none",
          overflow: "visible",
        }
      : undefined;

  return (
    <aside
      key={panelKey}
      ref={leftColumnRef}
      className="panel ai-panel ai-properties ai-properties--motion-flat ai-properties--panel-enter"
      style={inlineStyle}
    >
      {panelContent}
    </aside>
  );
});
