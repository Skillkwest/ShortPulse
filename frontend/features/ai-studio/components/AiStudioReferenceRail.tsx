/**
 * AI Studio reference rail boundary.
 * Contains the reference-grid canvas surface as an isolated shell section.
 */
import React from "react";
import { ReferenceGrid } from "./ReferenceGrid";
import type { ToolId } from "../types";
import type { CanvasPropertiesPanelProps } from "./canvas/useAiStudioCanvasWorkspaceState";
import type { AiStudioReferenceGridContract } from "../hooks/contracts/pageContentContracts";
import { areReferenceGridPropsEqual } from "../reference-grid/logic/referenceGridPropsEquality";
import { recordAiStudioShellSectionRender } from "../logic/shellRenderCounters";

type AiStudioReferenceRailProps = {
  referenceGridProps: AiStudioReferenceGridContract;
  railCanvasProps?: CanvasPropertiesPanelProps;
  onDropFiles: (files: FileList) => void;
  onTriggerFilePicker: () => void;
  selectedTool: ToolId | null;
  onOpenMediaLibrary?: () => void;
};

const areAiStudioReferenceRailPropsEqual = (
  previous: Readonly<AiStudioReferenceRailProps>,
  next: Readonly<AiStudioReferenceRailProps>
): boolean =>
  areReferenceGridPropsEqual(previous.referenceGridProps, next.referenceGridProps) &&
  previous.railCanvasProps === next.railCanvasProps &&
  previous.onDropFiles === next.onDropFiles &&
  previous.onTriggerFilePicker === next.onTriggerFilePicker &&
  previous.selectedTool === next.selectedTool &&
  previous.onOpenMediaLibrary === next.onOpenMediaLibrary;

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
}, areAiStudioReferenceRailPropsEqual);
