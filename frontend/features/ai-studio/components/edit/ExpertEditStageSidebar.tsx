import React from "react";

import { ExpertEditLayerUtilityActions } from "./ExpertEditLayersPanel";
import { ExpertEditModeRailPanel } from "./ExpertEditModeRailPanel";
import { ExpertEditPresetToolbarCard } from "./ExpertEditStageControls";
import { ExpertEditPresetsSurface } from "./ExpertEditPresetsSurface";
import type {
  ExpertEditResolvedPreset,
  ExpertEditPresetId,
  ExpertEditCustomPresetId,
  ExpertEditCustomPresetOverride,
} from "./expertEditPresets";
import type { RailTool } from "./expertEditPanelViewContract";

type ExpertEditStageSidebarProps = {
  isGenerationModeToggleEnabled: boolean;
  shouldHideSelectedModeRailPanel: boolean;
  selectedRailTool: RailTool;
  renderMarkupModalInpaintPanel: (scope?: "modal" | "rail") => React.ReactNode;
  renderMarkupControlsContent: (scope: "inline" | "modal") => React.ReactNode;
  renderMoveControlsContent: (scope: "inline" | "modal") => React.ReactNode;
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
  layersPanel: React.ReactNode;
  renderPresetUtilityActionButtons: React.ReactNode;
  isGenerateDisabled: boolean;
  selectedLayerImageUrl: string | null;
  isRemoveBackgroundPending: boolean;
  populatedLayerCount: number;
  isFlattenPending: boolean;
  handleManualFlatten: () => Promise<void>;
  handleRemoveBackground: () => void;
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
};

export function ExpertEditStageSidebar({
  isGenerationModeToggleEnabled,
  shouldHideSelectedModeRailPanel,
  selectedRailTool,
  renderMarkupModalInpaintPanel,
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
  layersPanel,
  renderPresetUtilityActionButtons,
  isGenerateDisabled,
  selectedLayerImageUrl,
  isRemoveBackgroundPending,
  populatedLayerCount,
  isFlattenPending,
  handleManualFlatten,
  handleRemoveBackground,
  availablePresets,
  closeMorePresetsSurface,
  handleSurfacePresetDragStart,
  handlePresetsSurfaceDragOver,
  handlePresetsSurfaceDragLeave,
  handlePresetsSurfaceDrop,
  handleCustomPresetSave,
  isPresetsSurfaceDropActive,
}: ExpertEditStageSidebarProps) {
  return (
    <div className="edit-expert-column-wrapper edit-expert-column-wrapper--left edit-expert-sidebar-shell">
      {isGenerationModeToggleEnabled && !shouldHideSelectedModeRailPanel ? (
        <ExpertEditModeRailPanel
          selectedRailTool={selectedRailTool}
          renderMarkupModalInpaintPanel={renderMarkupModalInpaintPanel}
          renderMarkupControlsContent={renderMarkupControlsContent}
          renderMoveControlsContent={renderMoveControlsContent}
        />
      ) : null}
      <ExpertEditPresetToolbarCard
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
      />
      {layersPanel}
      <div className="edit-expert-utility-actions" aria-label="Edit utility actions">
        {renderPresetUtilityActionButtons}
        <ExpertEditLayerUtilityActions
          isGenerateDisabled={isGenerateDisabled}
          selectedLayerImageUrl={selectedLayerImageUrl}
          isRemoveBackgroundPending={isRemoveBackgroundPending}
          populatedLayerCount={populatedLayerCount}
          isFlattenPending={isFlattenPending}
          onFlatten={() => void handleManualFlatten()}
          onRemoveBackground={handleRemoveBackground}
          className={null}
        />
      </div>
      <ExpertEditPresetsSurface
        id={morePresetsSurfaceId}
        isOpen={isMorePresetsSurfaceOpen}
        presets={availablePresets}
        onClose={closeMorePresetsSurface}
        onPresetDragStart={handleSurfacePresetDragStart}
        onPresetDragEnd={handlePresetDragEnd}
        onSurfaceDragOver={handlePresetsSurfaceDragOver}
        onSurfaceDragLeave={handlePresetsSurfaceDragLeave}
        onSurfaceDrop={handlePresetsSurfaceDrop}
        onCustomPresetSave={handleCustomPresetSave}
        isDropActive={isPresetsSurfaceDropActive}
      />
    </div>
  );
}
