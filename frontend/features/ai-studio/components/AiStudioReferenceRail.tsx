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
import {
  incrementFreezeInvestigationCounter,
  setFreezeInvestigationGauge,
} from "../logic/freezeInvestigationTelemetry";

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
): boolean => {
  if (!areReferenceGridPropsEqual(previous.referenceGridProps, next.referenceGridProps)) {
    incrementFreezeInvestigationCounter("referenceRail.propsMismatch.referenceGridProps");
    return false;
  }
  if (previous.railCanvasProps !== next.railCanvasProps) {
    incrementFreezeInvestigationCounter("referenceRail.propsMismatch.railCanvasProps");
    return false;
  }
  if (previous.onDropFiles !== next.onDropFiles) {
    incrementFreezeInvestigationCounter("referenceRail.propsMismatch.onDropFiles");
    return false;
  }
  if (previous.onTriggerFilePicker !== next.onTriggerFilePicker) {
    incrementFreezeInvestigationCounter("referenceRail.propsMismatch.onTriggerFilePicker");
    return false;
  }
  if (previous.selectedTool !== next.selectedTool) {
    incrementFreezeInvestigationCounter("referenceRail.propsMismatch.selectedTool");
    return false;
  }
  if (previous.onOpenMediaLibrary !== next.onOpenMediaLibrary) {
    incrementFreezeInvestigationCounter("referenceRail.propsMismatch.onOpenMediaLibrary");
    return false;
  }
  return true;
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
  incrementFreezeInvestigationCounter("referenceRail.render");
  setFreezeInvestigationGauge("referenceRail.railCanvasPresent", Boolean(railCanvasProps));
  setFreezeInvestigationGauge("referenceRail.selectedTool", selectedTool ?? null);
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
