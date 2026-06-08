/**
 * Sidebar and context-menu composition runtime for the Expert Edit panel.
 * Owns the final stage-shell nodes so the panel body stays focused on orchestration instead of large JSX payload assembly.
 */
import React from "react";

import type { EditSubmitIntent } from "../../logic/editSubmitIntent";
import { ExpertEditLayersPanel } from "./ExpertEditLayersPanel";
import type {
  ExpertEditCustomPresetId,
  ExpertEditCustomPresetOverride,
  ExpertEditPresetId,
  ExpertEditResolvedPreset,
} from "./expertEditPresets";
import type { RailTool } from "./expertEditPanelViewContract";
import { ExpertEditStageSidebar } from "./ExpertEditStageSidebar";
import type { ExpertEditLayer } from "./expertEditLayerSessionUtils";

type UseExpertEditPanelShellRuntimeArgs = {
  isAdvancedEditModesEnabled: boolean;
  isGenerationModeToggleEnabled: boolean;
  generationModeTabsStyle: React.CSSProperties;
  effectiveEditSubmitIntent: EditSubmitIntent;
  visibleEditGenerationModeOptions: ReadonlyArray<{ id: EditSubmitIntent; label: string }>;
  handleGenerationModeChange: (nextMode: EditSubmitIntent) => void;
  shouldHideSelectedModeRailPanel: boolean;
  selectedRailTool: RailTool;
  renderInpaintControlsContent: (scope: "inline" | "modal" | "rail") => React.ReactNode;
  renderMarkupControlsContent: (scope: "inline" | "modal" | "rail") => React.ReactNode;
  renderMoveControlsContent: (scope: "inline" | "modal" | "rail") => React.ReactNode;
  hasSelectedPresetIds: boolean;
  selectedPanelPresets: Array<{ presetId: ExpertEditPresetId; label: string }>;
  isPresetPanelDropActive: boolean;
  isMorePresetsSurfaceOpen: boolean;
  morePresetsSurfaceId: string;
  setIsMorePresetsSurfaceOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handlePanelPresetApply: (presetId: ExpertEditPresetId) => void;
  handlePanelPresetDragStart: (
    event: React.DragEvent<HTMLButtonElement>,
    presetId: ExpertEditPresetId
  ) => void;
  handlePresetDragEnd: () => void;
  handlePresetPanelDragOver: (event: React.DragEvent<HTMLElement>) => void;
  handlePresetPanelDragLeave: (event: React.DragEvent<HTMLElement>) => void;
  handlePresetPanelDrop: (event: React.DragEvent<HTMLElement>) => void;
  toggleMorePresetsSurface: () => void;
  layers: ExpertEditLayer[];
  editingLayerIndex: number | null;
  editingLayerValue: string;
  draggingLayerIndex: number | null;
  dragOverLayerIndex: number | null;
  resolvedSelectedLayerIndex: number | null;
  isGenerateDisabled: boolean;
  selectedLayerImageUrl: string | null;
  isRemoveBackgroundPending: boolean;
  removeBackgroundCostCredits: number | null;
  populatedLayerCount: number;
  isFlattenPending: boolean;
  setEditingLayerValue: React.Dispatch<React.SetStateAction<string>>;
  handleCommitLayerRename: (index: number) => void;
  clearLayerEditing: () => void;
  beginLayerRename: (index: number, value: string) => void;
  handleLayerDragStart: (event: React.DragEvent<HTMLDivElement>, index: number) => void;
  handleLayerDragOver: (event: React.DragEvent<HTMLDivElement>, index: number) => void;
  handleLayerDrop: (event: React.DragEvent<HTMLDivElement>, index: number) => void;
  handleLayerDragEnd: () => void;
  handleSelectLayer: (index: number) => void;
  handleClearAllLayers: () => void;
  handleDeleteLayer: (index: number) => void;
  handleManualFlatten: () => void | Promise<void>;
  handleRemoveBackground: () => void | Promise<void>;
  renderPresetUtilityActionButtons: React.ReactNode;
  availablePresets: readonly ExpertEditResolvedPreset[];
  closeMorePresetsSurface: () => void;
  handleSurfacePresetDragStart: (
    event: React.DragEvent<HTMLButtonElement>,
    presetId: ExpertEditPresetId
  ) => void;
  handlePresetsSurfaceDragOver: (event: React.DragEvent<HTMLElement>) => void;
  handlePresetsSurfaceDragLeave: (event: React.DragEvent<HTMLElement>) => void;
  handlePresetsSurfaceDrop: (event: React.DragEvent<HTMLElement>) => void;
  handleCustomPresetSave: (
    presetId: ExpertEditCustomPresetId,
    override: ExpertEditCustomPresetOverride
  ) => void;
  isPresetsSurfaceDropActive: boolean;
  onOpenPresetsLibrary?: () => void;
  stageContextMenuState: {
    isOpen: boolean;
    x: number;
    y: number;
  };
  stageContextMenuRef: React.Ref<HTMLDivElement>;
  isMarkupExpandSelected: boolean;
  handleStageContextMenuResetView: () => void;
  handleStageContextMenuExpand: () => void;
  handleStageContextMenuAddImage: () => void;
  handleStageContextMenuReset: () => void;
  handleStageContextMenuRemoveImage: () => void;
};

/**
 * Builds the sidebar node and context-menu payload for the Expert Edit shell.
 */
export function useExpertEditPanelShellRuntime({
  isAdvancedEditModesEnabled,
  isGenerationModeToggleEnabled,
  generationModeTabsStyle,
  effectiveEditSubmitIntent,
  visibleEditGenerationModeOptions,
  handleGenerationModeChange,
  shouldHideSelectedModeRailPanel,
  selectedRailTool,
  renderInpaintControlsContent,
  renderMarkupControlsContent,
  renderMoveControlsContent,
  hasSelectedPresetIds,
  selectedPanelPresets,
  isPresetPanelDropActive,
  isMorePresetsSurfaceOpen,
  morePresetsSurfaceId,
  setIsMorePresetsSurfaceOpen,
  handlePanelPresetApply,
  handlePanelPresetDragStart,
  handlePresetDragEnd,
  handlePresetPanelDragOver,
  handlePresetPanelDragLeave,
  handlePresetPanelDrop,
  toggleMorePresetsSurface,
  layers,
  editingLayerIndex,
  editingLayerValue,
  draggingLayerIndex,
  dragOverLayerIndex,
  resolvedSelectedLayerIndex,
  isGenerateDisabled,
  selectedLayerImageUrl,
  isRemoveBackgroundPending,
  removeBackgroundCostCredits,
  populatedLayerCount,
  isFlattenPending,
  setEditingLayerValue,
  handleCommitLayerRename,
  clearLayerEditing,
  beginLayerRename,
  handleLayerDragStart,
  handleLayerDragOver,
  handleLayerDrop,
  handleLayerDragEnd,
  handleSelectLayer,
  handleClearAllLayers,
  handleDeleteLayer,
  handleManualFlatten,
  handleRemoveBackground,
  renderPresetUtilityActionButtons,
  availablePresets,
  closeMorePresetsSurface,
  handleSurfacePresetDragStart,
  handlePresetsSurfaceDragOver,
  handlePresetsSurfaceDragLeave,
  handlePresetsSurfaceDrop,
  handleCustomPresetSave,
  isPresetsSurfaceDropActive,
  onOpenPresetsLibrary,
  stageContextMenuState,
  stageContextMenuRef,
  isMarkupExpandSelected,
  handleStageContextMenuResetView,
  handleStageContextMenuExpand,
  handleStageContextMenuAddImage,
  handleStageContextMenuReset,
  handleStageContextMenuRemoveImage,
}: UseExpertEditPanelShellRuntimeArgs) {
  const sidebar = (
    <ExpertEditStageSidebar
      isGenerationModeToggleEnabled={isGenerationModeToggleEnabled}
      generationModeTabsStyle={generationModeTabsStyle}
      effectiveEditSubmitIntent={effectiveEditSubmitIntent}
      editGenerationModeOptions={visibleEditGenerationModeOptions}
      onGenerationModeChange={handleGenerationModeChange}
      shouldHideSelectedModeRailPanel={shouldHideSelectedModeRailPanel}
      selectedRailTool={selectedRailTool}
      renderInpaintControlsContent={renderInpaintControlsContent}
      renderMarkupControlsContent={renderMarkupControlsContent}
      renderMoveControlsContent={renderMoveControlsContent}
      hasSelectedPresetIds={hasSelectedPresetIds}
      selectedPanelPresets={selectedPanelPresets}
      isPresetPanelDropActive={isPresetPanelDropActive}
      isMorePresetsSurfaceOpen={isMorePresetsSurfaceOpen}
      morePresetsSurfaceId={morePresetsSurfaceId}
      setIsMorePresetsSurfaceOpen={setIsMorePresetsSurfaceOpen}
      handlePanelPresetApply={handlePanelPresetApply}
      handlePanelPresetDragStart={handlePanelPresetDragStart}
      handlePresetDragEnd={handlePresetDragEnd}
      handlePresetPanelDragOver={handlePresetPanelDragOver}
      handlePresetPanelDragLeave={handlePresetPanelDragLeave}
      handlePresetPanelDrop={handlePresetPanelDrop}
      toggleMorePresetsSurface={toggleMorePresetsSurface}
      layersPanel={
        <ExpertEditLayersPanel
          scope="main"
          placement="sidebar"
          layers={layers}
          editingLayerIndex={editingLayerIndex}
          editingLayerValue={editingLayerValue}
          draggingLayerIndex={draggingLayerIndex}
          dragOverLayerIndex={dragOverLayerIndex}
          resolvedSelectedLayerIndex={resolvedSelectedLayerIndex}
          isGenerateDisabled={isGenerateDisabled}
          selectedLayerImageUrl={selectedLayerImageUrl}
          isRemoveBackgroundPending={isRemoveBackgroundPending}
          removeBackgroundCostCredits={removeBackgroundCostCredits}
          populatedLayerCount={populatedLayerCount}
          isFlattenPending={isFlattenPending}
          setEditingLayerValue={setEditingLayerValue}
          onCommitLayerRename={handleCommitLayerRename}
          onClearLayerEditing={clearLayerEditing}
          onBeginLayerRename={beginLayerRename}
          onLayerDragStart={handleLayerDragStart}
          onLayerDragOver={handleLayerDragOver}
          onLayerDrop={handleLayerDrop}
          onLayerDragEnd={handleLayerDragEnd}
          onSelectLayer={handleSelectLayer}
          onClearAllLayers={handleClearAllLayers}
          onDeleteLayer={handleDeleteLayer}
          onFlatten={() => void handleManualFlatten()}
          onRemoveBackground={handleRemoveBackground}
        />
      }
      renderPresetUtilityActionButtons={renderPresetUtilityActionButtons}
      isGenerateDisabled={isGenerateDisabled}
      selectedLayerImageUrl={selectedLayerImageUrl}
      isRemoveBackgroundPending={isRemoveBackgroundPending}
      removeBackgroundCostCredits={removeBackgroundCostCredits}
      populatedLayerCount={populatedLayerCount}
      isFlattenPending={isFlattenPending}
      handleManualFlatten={() => Promise.resolve(handleManualFlatten())}
      handleRemoveBackground={() => Promise.resolve(handleRemoveBackground())}
      availablePresets={availablePresets}
      closeMorePresetsSurface={closeMorePresetsSurface}
      handleSurfacePresetDragStart={handleSurfacePresetDragStart}
      handlePresetsSurfaceDragOver={handlePresetsSurfaceDragOver}
      handlePresetsSurfaceDragLeave={handlePresetsSurfaceDragLeave}
      handlePresetsSurfaceDrop={handlePresetsSurfaceDrop}
      handleCustomPresetSave={handleCustomPresetSave}
      isPresetsSurfaceDropActive={isPresetsSurfaceDropActive}
      onOpenPresetsLibrary={onOpenPresetsLibrary}
    />
  );

  const contextMenu = React.useMemo(
    () => ({
      isOpen: stageContextMenuState.isOpen,
      menuRef: stageContextMenuRef,
      x: stageContextMenuState.x,
      y: stageContextMenuState.y,
      canExpand: isAdvancedEditModesEnabled,
      isMarkupExpandSelected,
      hasSelectedLayerImage: Boolean(selectedLayerImageUrl),
      onResetView: handleStageContextMenuResetView,
      onExpand: handleStageContextMenuExpand,
      onAddImage: handleStageContextMenuAddImage,
      onReset: handleStageContextMenuReset,
      onRemoveImage: handleStageContextMenuRemoveImage,
    }),
    [
      handleStageContextMenuAddImage,
      handleStageContextMenuExpand,
      handleStageContextMenuResetView,
      handleStageContextMenuRemoveImage,
      handleStageContextMenuReset,
      isAdvancedEditModesEnabled,
      isMarkupExpandSelected,
      selectedLayerImageUrl,
      stageContextMenuRef,
      stageContextMenuState.isOpen,
      stageContextMenuState.x,
      stageContextMenuState.y,
    ]
  );

  return {
    sidebar,
    contextMenu,
  };
}
