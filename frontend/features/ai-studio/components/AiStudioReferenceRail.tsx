/**
 * AI Studio reference rail boundary.
 * Contains the reference-grid canvas surface as an isolated shell section.
 */
import React from "react";
import { ReferenceGrid } from "./ReferenceGrid";
import type { ToolId } from "../types";
import type { AiStudioReferenceGridContract } from "../hooks/contracts/pageContentContracts";
import { areReferenceGridPropsEqual } from "../reference-grid/logic/referenceGridPropsEquality";
import { recordAiStudioShellSectionRender } from "../logic/shellRenderCounters";

type AiStudioReferenceRailProps = {
  referenceGridProps: AiStudioReferenceGridContract;
  onDropFiles: (files: FileList) => void;
  onTriggerFilePicker: () => void;
  selectedTool: ToolId | null;
};

const areAiStudioReferenceRailPropsEqual = (
  previous: Readonly<AiStudioReferenceRailProps>,
  next: Readonly<AiStudioReferenceRailProps>
): boolean =>
  areReferenceGridPropsEqual(previous.referenceGridProps, next.referenceGridProps) &&
  previous.onDropFiles === next.onDropFiles &&
  previous.onTriggerFilePicker === next.onTriggerFilePicker &&
  previous.selectedTool === next.selectedTool;

export const AiStudioReferenceRail = React.memo(function AiStudioReferenceRail({
  referenceGridProps,
  onDropFiles,
  onTriggerFilePicker,
  selectedTool,
}: AiStudioReferenceRailProps) {
  recordAiStudioShellSectionRender("reference");
  return (
    <div className="ai-preview-column reference-column">
      <div className="reference-column-sticky">
        <ReferenceGrid
          {...referenceGridProps}
          onDropFiles={onDropFiles}
          onTriggerFileSelect={onTriggerFilePicker}
          selectedTool={selectedTool}
        />
      </div>
    </div>
  );
}, areAiStudioReferenceRailPropsEqual);
