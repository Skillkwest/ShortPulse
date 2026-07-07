/**
 * AI Studio toolbar rail boundary.
 * Isolates toolbar rendering from unrelated shell updates.
 */
import React from "react";
import { AiStudioToolbar } from "./AiStudioToolbar";
import type { ToolId } from "../types";
import { recordAiStudioShellSectionRender } from "../logic/shellRenderCounters";
import type { GenerationAccessCta } from "../logic/generationAccessCta";

type AiStudioToolbarRailProps = {
  selectedTool: ToolId | null;
  showCreateTools: boolean;
  workflowPlanAccessCta?: GenerationAccessCta | null;
  onOpenProjects?: () => void;
  onSelectTool: (tool: ToolId | null) => void;
  onWorkflowPlanAccessAttempt?: () => void;
  onToggleCreateTools: (value: boolean) => void;
};

export const AiStudioToolbarRail = React.memo(function AiStudioToolbarRail({
  selectedTool,
  showCreateTools,
  workflowPlanAccessCta = null,
  onOpenProjects,
  onSelectTool,
  onWorkflowPlanAccessAttempt,
  onToggleCreateTools,
}: AiStudioToolbarRailProps) {
  recordAiStudioShellSectionRender("toolbar");
  return (
    <AiStudioToolbar
      selectedTool={selectedTool}
      showCreateTools={showCreateTools}
      workflowPlanAccessCta={workflowPlanAccessCta}
      onOpenProjects={onOpenProjects}
      onSelectTool={onSelectTool}
      onWorkflowPlanAccessAttempt={onWorkflowPlanAccessAttempt}
      onToggleCreateTools={onToggleCreateTools}
    />
  );
});
