import React from "react";

import {
  ExpertEditMarkupModalGeneralPanel,
  ExpertEditMarkupModalInpaintPanel,
  ExpertEditMoveControlsContent,
  ExpertEditPresetUtilityActionButtons,
} from "./ExpertEditStageControls";
import type { InpaintMode, InpaintSelectionTab, RailTool } from "./expertEditPanelViewContract";
import type { AspectOption } from "../../types";

type UseExpertEditStageControlPanelsParams = {
  isMoveToolSelected: boolean;
  moveStageZoomSliderValue: number;
  isMoveTransformCentered: boolean;
  isMarkupViewportAtRest: boolean;
  canUndoGeneralAction: boolean;
  canRedoGeneralAction: boolean;
  setSelectedRailTool: React.Dispatch<React.SetStateAction<RailTool>>;
  handleRecenterMoveAction: () => void;
  openMarkupModal: (tool?: RailTool) => void;
  handleMoveZoomSliderChange: React.ChangeEventHandler<HTMLInputElement>;
  handleUndoGeneralAction: () => void;
  handleRedoGeneralAction: () => void;
  aspect: string;
  aspectOptionsForModel: AspectOption[];
  isGeneralResetDisabled: boolean;
  onAspectChange: (value: string) => void;
  handleResetGeneralAction: () => void;
  isGenerateDisabled: boolean;
  selectedLayerImageUrl: string | null;
  handleCompositeRegeneratePromptInsert: () => void;
  selectedInpaintMode: InpaintMode;
  isInpaintToolSelected: boolean;
  inpaintStrokeSize: number;
  selectedInpaintSelectionTab: InpaintSelectionTab;
  imageHasInteractiveMask: boolean;
  setSelectedInpaintMode: React.Dispatch<React.SetStateAction<InpaintMode>>;
  setInpaintStrokeSize: React.Dispatch<React.SetStateAction<number>>;
  setSelectedInpaintSelectionTab: React.Dispatch<React.SetStateAction<InpaintSelectionTab>>;
  clearInpaintSelectionWithHistory: () => void;
  invertInpaintSelectionWithHistory: () => void;
};

export const useExpertEditStageControlPanels = ({
  isMoveToolSelected,
  moveStageZoomSliderValue,
  isMoveTransformCentered,
  isMarkupViewportAtRest,
  canUndoGeneralAction,
  canRedoGeneralAction,
  setSelectedRailTool,
  handleRecenterMoveAction,
  openMarkupModal,
  handleMoveZoomSliderChange,
  handleUndoGeneralAction,
  handleRedoGeneralAction,
  aspect,
  aspectOptionsForModel,
  isGeneralResetDisabled,
  onAspectChange,
  handleResetGeneralAction,
  isGenerateDisabled,
  selectedLayerImageUrl,
  handleCompositeRegeneratePromptInsert,
  selectedInpaintMode,
  isInpaintToolSelected,
  inpaintStrokeSize,
  selectedInpaintSelectionTab,
  imageHasInteractiveMask,
  setSelectedInpaintMode,
  setInpaintStrokeSize,
  setSelectedInpaintSelectionTab,
  clearInpaintSelectionWithHistory,
  invertInpaintSelectionWithHistory,
}: UseExpertEditStageControlPanelsParams) => {
  const renderMoveControlsContent = React.useCallback(
    (scope: "inline" | "modal") => (
      <ExpertEditMoveControlsContent
        scope={scope}
        isMoveToolSelected={isMoveToolSelected}
        moveStageZoomSliderValue={moveStageZoomSliderValue}
        isMoveTransformCentered={isMoveTransformCentered}
        isMarkupViewportAtRest={isMarkupViewportAtRest}
        canUndoGeneralAction={canUndoGeneralAction}
        canRedoGeneralAction={canRedoGeneralAction}
        setSelectedRailTool={setSelectedRailTool}
        handleRecenterMoveAction={handleRecenterMoveAction}
        openMarkupModal={openMarkupModal}
        handleMoveZoomSliderChange={handleMoveZoomSliderChange}
        handleUndoGeneralAction={handleUndoGeneralAction}
        handleRedoGeneralAction={handleRedoGeneralAction}
      />
    ),
    [
      canRedoGeneralAction,
      canUndoGeneralAction,
      handleMoveZoomSliderChange,
      handleRecenterMoveAction,
      handleRedoGeneralAction,
      handleUndoGeneralAction,
      isMarkupViewportAtRest,
      isMoveToolSelected,
      isMoveTransformCentered,
      moveStageZoomSliderValue,
      openMarkupModal,
      setSelectedRailTool,
    ]
  );

  const renderMarkupModalGeneralPanel = React.useMemo(
    () => (
      <ExpertEditMarkupModalGeneralPanel
        aspect={aspect}
        aspectOptionsForModel={aspectOptionsForModel}
        canUndoGeneralAction={canUndoGeneralAction}
        canRedoGeneralAction={canRedoGeneralAction}
        isGeneralResetDisabled={isGeneralResetDisabled}
        onAspectChange={onAspectChange}
        handleUndoGeneralAction={handleUndoGeneralAction}
        handleRedoGeneralAction={handleRedoGeneralAction}
        handleResetGeneralAction={handleResetGeneralAction}
      />
    ),
    [
      aspect,
      aspectOptionsForModel,
      canRedoGeneralAction,
      canUndoGeneralAction,
      handleRedoGeneralAction,
      handleResetGeneralAction,
      handleUndoGeneralAction,
      isGeneralResetDisabled,
      onAspectChange,
    ]
  );

  const renderPresetUtilityActionButtons = React.useMemo(
    () => (
      <ExpertEditPresetUtilityActionButtons
        isGenerateDisabled={isGenerateDisabled}
        selectedLayerImageUrl={selectedLayerImageUrl}
        handleCompositeRegeneratePromptInsert={handleCompositeRegeneratePromptInsert}
      />
    ),
    [handleCompositeRegeneratePromptInsert, isGenerateDisabled, selectedLayerImageUrl]
  );

  const renderMarkupModalInpaintPanel = React.useCallback(
    (scope: "modal" | "rail" = "modal") => (
      <ExpertEditMarkupModalInpaintPanel
        scope={scope}
        selectedInpaintMode={selectedInpaintMode}
        isInpaintToolSelected={isInpaintToolSelected}
        inpaintStrokeSize={inpaintStrokeSize}
        selectedInpaintSelectionTab={selectedInpaintSelectionTab}
        imageHasInteractiveMask={imageHasInteractiveMask}
        setSelectedRailTool={setSelectedRailTool}
        setSelectedInpaintMode={setSelectedInpaintMode}
        setInpaintStrokeSize={setInpaintStrokeSize}
        setSelectedInpaintSelectionTab={setSelectedInpaintSelectionTab}
        clearInpaintSelectionWithHistory={clearInpaintSelectionWithHistory}
        invertInpaintSelectionWithHistory={invertInpaintSelectionWithHistory}
      />
    ),
    [
      clearInpaintSelectionWithHistory,
      imageHasInteractiveMask,
      inpaintStrokeSize,
      invertInpaintSelectionWithHistory,
      isInpaintToolSelected,
      selectedInpaintMode,
      selectedInpaintSelectionTab,
      setSelectedRailTool,
      setSelectedInpaintMode,
      setInpaintStrokeSize,
      setSelectedInpaintSelectionTab,
    ]
  );

  return {
    renderMarkupModalGeneralPanel,
    renderMarkupModalInpaintPanel,
    renderMoveControlsContent,
    renderPresetUtilityActionButtons,
  };
};
