/**
 * Stage-control composition runtime for the Expert Edit panel.
 * Owns tool-mode flags plus the memoized control-surface renderers used by inline and modal stage UI.
 */
import React from "react";
import type { AspectOption } from "../../types";

import {
  ExpertEditInpaintControlsContent,
  ExpertEditMarkupModalGeneralPanel,
  ExpertEditMoveControlsContent,
  ExpertEditPresetUtilityActionButtons,
} from "./ExpertEditStageControls";
import type { InpaintMode, InpaintSelectionTab, RailTool } from "./expertEditPanelViewContract";

type UseExpertEditPanelControlsRuntimeArgs = {
  selectedRailTool: RailTool;
  isGenerationModeToggleEnabled: boolean;
  effectiveEditSubmitIntent: "standard" | "inpaint" | "markup";
  moveStageZoomSliderValue: number;
  canUndoGeneralAction: boolean;
  canRedoGeneralAction: boolean;
  isGeneralResetDisabled: boolean;
  aspect: string;
  aspectOptionsForModel: AspectOption[];
  onAspectChange: (nextAspect: string) => void;
  setSelectedRailTool: React.Dispatch<React.SetStateAction<RailTool>>;
  handleRecenterMoveAction: () => void;
  openMarkupModal: () => void;
  handleMoveZoomSliderChange: (value: number) => void;
  handleUndoGeneralAction: () => void;
  handleRedoGeneralAction: () => void;
  handleResetGeneralAction: () => void;
  selectedInpaintMode: InpaintMode;
  inpaintStrokeSize: number;
  selectedInpaintSelectionTab: InpaintSelectionTab;
  imageHasInteractiveMask: boolean;
  setSelectedInpaintMode: React.Dispatch<React.SetStateAction<InpaintMode>>;
  setInpaintStrokeSize: React.Dispatch<React.SetStateAction<number>>;
  setSelectedInpaintSelectionTab: React.Dispatch<React.SetStateAction<InpaintSelectionTab>>;
  clearInpaintSelectionWithHistory: () => void;
  invertInpaintSelectionWithHistory: () => void;
  isGenerateDisabled: boolean;
  selectedLayerImageUrl: string | null;
  handleCompositeRegeneratePromptInsert: () => void;
};

/**
 * Derives the stage tool-mode view model and memoized control renderers for Expert Edit.
 */
export function useExpertEditPanelControlsRuntime({
  selectedRailTool,
  isGenerationModeToggleEnabled,
  effectiveEditSubmitIntent,
  moveStageZoomSliderValue,
  canUndoGeneralAction,
  canRedoGeneralAction,
  isGeneralResetDisabled,
  aspect,
  aspectOptionsForModel,
  onAspectChange,
  setSelectedRailTool,
  handleRecenterMoveAction,
  openMarkupModal,
  handleMoveZoomSliderChange,
  handleUndoGeneralAction,
  handleRedoGeneralAction,
  handleResetGeneralAction,
  selectedInpaintMode,
  inpaintStrokeSize,
  selectedInpaintSelectionTab,
  imageHasInteractiveMask,
  setSelectedInpaintMode,
  setInpaintStrokeSize,
  setSelectedInpaintSelectionTab,
  clearInpaintSelectionWithHistory,
  invertInpaintSelectionWithHistory,
  isGenerateDisabled,
  selectedLayerImageUrl,
  handleCompositeRegeneratePromptInsert,
}: UseExpertEditPanelControlsRuntimeArgs) {
  const isInpaintToolSelected = selectedRailTool === "inpaint";
  const isMarkupToolSelected = selectedRailTool === "markup";
  const isMoveToolSelected = selectedRailTool === "move";
  const isInpaintLikeToolSelected = isInpaintToolSelected || isMarkupToolSelected;
  const shouldHideSelectedModeRailPanel =
    isGenerationModeToggleEnabled && effectiveEditSubmitIntent === "standard";
  const collapsedToolsThemeClass = isMoveToolSelected
    ? "is-active-move"
    : isMarkupToolSelected
      ? "is-active-markup"
      : "is-active-inpaint";

  const renderMoveControlsContent = React.useCallback(
    (scope: "inline" | "modal" | "rail") => (
      <ExpertEditMoveControlsContent
        scope={scope === "rail" ? "inline" : scope}
        isMoveToolSelected={isMoveToolSelected}
        moveStageZoomSliderValue={moveStageZoomSliderValue}
        canUndoGeneralAction={canUndoGeneralAction}
        canRedoGeneralAction={canRedoGeneralAction}
        setSelectedRailTool={setSelectedRailTool}
        handleRecenterMoveAction={handleRecenterMoveAction}
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
      isMoveToolSelected,
      moveStageZoomSliderValue,
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

  const renderInpaintControlsContent = React.useCallback(
    (scope: "inline" | "modal" | "rail") => (
      <ExpertEditInpaintControlsContent
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
        openMarkupModal={openMarkupModal}
      />
    ),
    [
      clearInpaintSelectionWithHistory,
      imageHasInteractiveMask,
      inpaintStrokeSize,
      invertInpaintSelectionWithHistory,
      isInpaintToolSelected,
      openMarkupModal,
      selectedInpaintMode,
      selectedInpaintSelectionTab,
      setSelectedRailTool,
      setSelectedInpaintMode,
      setInpaintStrokeSize,
      setSelectedInpaintSelectionTab,
    ]
  );

  return {
    isInpaintLikeToolSelected,
    shouldHideSelectedModeRailPanel,
    collapsedToolsThemeClass,
    renderMoveControlsContent,
    renderMarkupModalGeneralPanel,
    renderPresetUtilityActionButtons,
    renderInpaintControlsContent,
  };
}
