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
  hidden?: boolean;
};

export const AiStudioPropertiesRail = React.memo(function AiStudioPropertiesRail({
  selectedTool,
  leftColumnRef,
  panelKey,
  panelContent,
  hidden,
}: AiStudioPropertiesRailProps) {
  if (!selectedTool || !panelKey) return null;

  recordAiStudioShellSectionRender("properties");

  return (
    <aside
      key={panelKey}
      ref={leftColumnRef}
      className="panel ai-panel ai-properties ai-properties--motion-flat ai-properties--panel-enter"
      data-left-column-hidden={hidden ? "true" : undefined}
    >
      {hidden ? null : panelContent}
    </aside>
  );
});
