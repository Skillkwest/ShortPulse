/**
 * AI Studio reference rail boundary.
 * Contains the reference-grid canvas surface as an isolated shell section.
 */
import React from "react";
import { ReferenceGrid } from "./ReferenceGrid";
import type { ToolId } from "../types";
import type { ReferenceGridProps } from "./ReferenceGrid";
import type { CanvasPropertiesPanelProps } from "./canvas/useAiStudioCanvasWorkspaceState";
import { recordAiStudioShellSectionRender } from "../logic/shellRenderCounters";

type AiStudioReferenceRailProps = {
  referenceGridProps: ReferenceGridProps;
  railCanvasProps?: CanvasPropertiesPanelProps;
  onDropFiles: (files: FileList) => void;
  onTriggerFilePicker: () => void;
  selectedTool: ToolId | null;
  onOpenMediaLibrary?: () => void;
};

export const AiStudioReferenceRail = React.memo(function AiStudioReferenceRail({
  referenceGridProps,
  railCanvasProps,
  onDropFiles,
  onTriggerFilePicker,
  selectedTool,
  onOpenMediaLibrary,
}: AiStudioReferenceRailProps) {
  recordAiStudioShellSectionRender("reference");
  return (
    <div className="ai-preview-column reference-column">
      <div className="reference-column-sticky">
        <ReferenceGrid
          {...referenceGridProps}
          railCanvasProps={railCanvasProps}
          onDropFiles={onDropFiles}
          onTriggerFileSelect={onTriggerFilePicker}
          selectedTool={selectedTool}
          onOpenMediaLibrary={onOpenMediaLibrary}
        />
      </div>
    </div>
  );
});
