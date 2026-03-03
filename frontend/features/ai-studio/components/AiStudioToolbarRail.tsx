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
  beginnerMode: boolean;
  showBeginnerModeToggle: boolean;
  onSelectTool: (tool: ToolId | null) => void;
  onToggleCreateTools: (value: boolean) => void;
  onBeginnerModeChange: (value: boolean) => void;
  onOpenSessions: () => void;
};

export const AiStudioToolbarRail = React.memo(function AiStudioToolbarRail({
  selectedTool,
  showCreateTools,
  beginnerMode,
  showBeginnerModeToggle,
  onSelectTool,
  onToggleCreateTools,
  onBeginnerModeChange,
  onOpenSessions,
}: AiStudioToolbarRailProps) {
  recordAiStudioShellSectionRender("toolbar");
  return (
    <AiStudioToolbar
      selectedTool={selectedTool}
      showCreateTools={showCreateTools}
      beginnerMode={beginnerMode}
      showBeginnerModeToggle={showBeginnerModeToggle}
      onSelectTool={onSelectTool}
      onToggleCreateTools={onToggleCreateTools}
      onToggleBeginnerMode={onBeginnerModeChange}
      onOpenSessions={onOpenSessions}
    />
  );
});
