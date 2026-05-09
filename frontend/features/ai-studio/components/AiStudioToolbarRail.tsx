/**
 * AI Studio toolbar rail boundary.
 * Isolates toolbar rendering from unrelated shell updates.
 */
import React from "react";
import { AiStudioToolbar } from "./AiStudioToolbar";
import type { ToolId } from "../types";
import { recordAiStudioShellSectionRender } from "../logic/shellRenderCounters";

type AiStudioToolbarRailProps = {
  selectedTool: ToolId | null;
  showCreateTools: boolean;
  onOpenProjects?: () => void;
  onSelectTool: (tool: ToolId | null) => void;
  onToggleCreateTools: (value: boolean) => void;
};

export const AiStudioToolbarRail = React.memo(function AiStudioToolbarRail({
  selectedTool,
  showCreateTools,
  onOpenProjects,
  onSelectTool,
  onToggleCreateTools,
}: AiStudioToolbarRailProps) {
  recordAiStudioShellSectionRender("toolbar");
  return (
    <AiStudioToolbar
      selectedTool={selectedTool}
      showCreateTools={showCreateTools}
      onOpenProjects={onOpenProjects}
      onSelectTool={onSelectTool}
      onToggleCreateTools={onToggleCreateTools}
    />
  );
});
