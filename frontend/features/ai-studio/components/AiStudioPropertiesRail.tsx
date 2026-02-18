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
  panelContent: React.ReactNode;
};

export const AiStudioPropertiesRail = React.memo(function AiStudioPropertiesRail({
  selectedTool,
  leftColumnRef,
  panelContent,
}: AiStudioPropertiesRailProps) {
  if (!selectedTool) return null;
  recordAiStudioShellSectionRender("properties");
  return (
    <aside ref={leftColumnRef} className="panel ai-panel ai-properties">
      {panelContent}
    </aside>
  );
});
