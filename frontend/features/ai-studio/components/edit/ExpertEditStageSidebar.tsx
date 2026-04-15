/**
 * Left-rail shell for the Expert Edit stage, including mode controls, presets, layers, and utility actions.
 */
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
import { REMOVE_BACKGROUND_ACTION_ID, type RailTool } from "./expertEditPanelViewContract";
import type { EditSubmitIntent } from "../../logic/editSubmitIntent";

type ExpertEditStageSidebarProps = {
  isGenerationModeToggleEnabled: boolean;
  generationModeTabsStyle: React.CSSProperties;
  effectiveEditSubmitIntent: EditSubmitIntent;
  editGenerationModeOptions: ReadonlyArray<{ id: EditSubmitIntent; label: string }>;
  onGenerationModeChange: (nextMode: EditSubmitIntent) => void;
  shouldHideSelectedModeRailPanel: boolean;
  selectedRailTool: RailTool;
  renderInpaintControlsContent: (scope: "inline" | "modal" | "rail") => React.ReactNode;
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
  generationModeTabsStyle,
  effectiveEditSubmitIntent,
  editGenerationModeOptions,
  onGenerationModeChange,
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
  const shouldShowSidebarModePanel =
    isGenerationModeToggleEnabled && !shouldHideSelectedModeRailPanel;
  const shouldCollapseSidebarLayersPanel = selectedRailTool !== "move";

  return (
    <div className="edit-expert-column-wrapper edit-expert-column-wrapper--left edit-expert-sidebar-shell">
      {isGenerationModeToggleEnabled ? (
        <div className="edit-expert-sidebar-generation-mode-controls">
          <div className="edit-expert-panel-title">Select Edit Mode</div>
          <div
            className="edit-expert-generation-mode-tabs edit-expert-generation-mode-tabs--sidebar"
            role="tablist"
            aria-label="Generation mode"
            style={generationModeTabsStyle}
          >
            <span className="edit-expert-generation-mode-indicator" aria-hidden="true" />
            {editGenerationModeOptions.map((modeOption) => (
              <button
                key={modeOption.id}
                type="button"
                className={`edit-expert-generation-mode-tab ${
                  effectiveEditSubmitIntent === modeOption.id ? "is-active" : ""
                }`}
                role="tab"
                aria-selected={effectiveEditSubmitIntent === modeOption.id}
                onClick={() => onGenerationModeChange(modeOption.id)}
              >
                {modeOption.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {isGenerationModeToggleEnabled ? (
        <div
          className={`edit-expert-sidebar-mode-panel-shell ${
            shouldShowSidebarModePanel ? "is-expanded" : "is-collapsed"
          }`.trim()}
          aria-hidden={!shouldShowSidebarModePanel}
        >
          <div className="edit-expert-sidebar-mode-panel-shell-inner">
            <ExpertEditModeRailPanel
              selectedRailTool={selectedRailTool}
              renderInpaintControlsContent={renderInpaintControlsContent}
              renderMarkupControlsContent={renderMarkupControlsContent}
              renderMoveControlsContent={renderMoveControlsContent}
            />
          </div>
        </div>
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
      {React.isValidElement(layersPanel)
        ? React.cloneElement(layersPanel, {
            isCollapsed: shouldCollapseSidebarLayersPanel,
          } as { isCollapsed: boolean })
        : layersPanel}
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
          actionIds={[REMOVE_BACKGROUND_ACTION_ID]}
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
