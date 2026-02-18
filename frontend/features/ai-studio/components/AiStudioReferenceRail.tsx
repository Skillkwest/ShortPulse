/**
 * AI Studio reference rail boundary.
 * Contains the reference-grid header and canvas surface as an isolated shell section.
 */
import React from "react";
import { FolderSimple, UploadSimple } from "phosphor-react";
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
        <div className="preview-column-header">
          <div>
            <p className="eyebrow">Reference Grid</p>
            <p className="tiny subdued helper-text">Double-click a reference to expand.</p>
          </div>
          <div className="preview-header-actions">
            <button
              type="button"
              className="ghost-btn mini preview-media-btn reference-grid-add-files-btn"
              onClick={onTriggerFilePicker}
            >
              <UploadSimple size={14} weight="regular" />
              Add files
            </button>
            <button
              type="button"
              className="ghost-btn mini preview-media-btn reference-grid-media-library-btn"
              onClick={onOpenMediaLibrary}
            >
              <FolderSimple size={14} weight="regular" />
              <span>Media library</span>
            </button>
          </div>
        </div>
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
