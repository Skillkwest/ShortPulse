/**
 * AI Studio reference rail boundary.
 * Contains the reference-grid canvas surface as an isolated shell section.
 */
import React from "react";
import { ReferenceCanvas } from "./ReferenceCanvas";
import type { ToolId } from "../types";
import type { ReferenceCanvasProps } from "./ReferenceCanvas";
import { recordAiStudioShellSectionRender } from "../logic/shellRenderCounters";

type AiStudioReferenceRailProps = {
  referenceCanvasProps: ReferenceCanvasProps;
  onDropFiles: (files: FileList) => void;
  onTriggerFilePicker: () => void;
  selectedTool: ToolId | null;
  onOpenMediaLibrary?: () => void;
};

export const AiStudioReferenceRail = React.memo(function AiStudioReferenceRail({
  referenceCanvasProps,
  onDropFiles,
  onTriggerFilePicker,
  selectedTool,
  onOpenMediaLibrary,
}: AiStudioReferenceRailProps) {
  recordAiStudioShellSectionRender("reference");
  return (
    <div className="ai-preview-column reference-column">
      <div className="reference-column-sticky">
        <ReferenceCanvas
          {...referenceCanvasProps}
          onDropFiles={onDropFiles}
          onTriggerFileSelect={onTriggerFilePicker}
          selectedTool={selectedTool}
          onOpenMediaLibrary={onOpenMediaLibrary}
        />
      </div>
    </div>
  );
});
