/**
 * Stage workspace composition runtime for the Expert Edit panel.
 * Owns inline scene, post-stage tools, and modal stage-surface assembly so the panel body stays focused on runtime orchestration.
 */
import React from "react";

import { ExpertEditInlinePostStageTools } from "./ExpertEditInlinePostStageTools";
import { ExpertEditLayersPanel } from "./ExpertEditLayersPanel";
import { ExpertEditSecondaryReferences } from "./ExpertEditReferenceControls";
import { ExpertEditStageScene } from "./ExpertEditStageScene";
import type { StageInteractionHandlers, StagePanHandlers } from "./ExpertEditStageSurface";
import type { RailTool } from "./expertEditPanelViewContract";
import type { ExpertEditStyleTile } from "./expertEditStyles";
import type { MarkupStroke } from "./markupStrokeController";
import type { ExpertEditLayer } from "./expertEditLayerSessionUtils";
import type { LayerTransform } from "./expertEditLayerTransformUtils";
import type { StageViewportSize } from "./expertEditViewportUtils";

type StageInteractionRouterHandlers = StageInteractionHandlers & {
  onWheel: React.WheelEventHandler<HTMLDivElement>;
};

type UseExpertEditStageWorkspaceRuntimeArgs = {
  isAdvancedEditModesEnabled: boolean;
  layers: ExpertEditLayer[];
  markupStrokes: MarkupStroke[];
  overlayCanvasRef: React.RefObject<HTMLCanvasElement>;
  previewCanvasRef: React.RefObject<HTMLCanvasElement>;
  modalOverlayCanvasRef: React.RefObject<HTMLCanvasElement>;
  modalPreviewCanvasRef: React.RefObject<HTMLCanvasElement>;
  inlineCompositionSurfaceViewportSize: StageViewportSize;
  primaryCanvasFrameStackElement: HTMLDivElement | null;
  resolveLayerImageAspectRatio: (layer: ExpertEditLayer) => number;
  resolveRenderableLayerTransform: (layer: ExpertEditLayer) => LayerTransform;
  isFlattenPending: boolean;
  isRemoveBackgroundPending: boolean;
  isPrimaryStageGenerating: boolean;
  renderSelectedLayerTransformOverlay: (
    scope: "inline" | "modal",
    stageSize: StageViewportSize,
    stageElement: HTMLDivElement | null,
    interactionHandlers: StageInteractionHandlers
  ) => React.ReactNode;
  inlineStageInteractionRouter: StageInteractionRouterHandlers;
  inlineBackdropPanHandlers: StagePanHandlers;
  modalStageInteractionRouter: StageInteractionRouterHandlers;
  isInpaintCollapsed: boolean;
  isInpaintCollapsing: boolean;
  collapsedToolsThemeClass: string;
  selectedRailTool: RailTool;
  isInpaintToolSelected: boolean;
  isMarkupToolSelected: boolean;
  isMoveToolSelected: boolean;
  isInpaintLikeToolSelected: boolean;
  setSelectedRailTool: React.Dispatch<React.SetStateAction<RailTool>>;
  handleInpaintCollapseToggle: () => void;
  renderInpaintControlsContent: (scope: "inline" | "modal" | "rail") => React.ReactNode;
  renderMarkupControlsContent: (scope: "inline" | "modal" | "rail") => React.ReactNode;
  renderMoveControlsContent: (scope: "inline" | "modal" | "rail") => React.ReactNode;
  shouldShowSecondaryReferenceAndStylesRow: boolean;
  extraImageUrls: [string | null, string | null, string | null];
  inputRefs: readonly React.RefObject<HTMLInputElement | null>[];
  extraDragActive: boolean[];
  promptTokenPickerIsOpen: boolean;
  highlightPromptPickerSecondaryTargets: boolean;
  promptTokenPickerSelectedSlotIndex: number | "main" | null;
  allowPromptTokenSecondaryDrag: boolean;
  handleSecondaryPromptTokenDragStart: (
    event: React.DragEvent<HTMLDivElement>,
    index: number
  ) => void;
  handleExtraDrop: (index: number) => React.DragEventHandler<HTMLDivElement>;
  handleExtraDragEnter: (index: number) => React.DragEventHandler<HTMLDivElement>;
  handleExtraDragOver: (index: number) => React.DragEventHandler<HTMLDivElement>;
  handleExtraDragLeave: (index: number) => () => void;
  onExtraImageChange: (index: number, url: string | null) => void;
  isStylesPanelOpen: boolean;
  selectedStyleId: string | null;
  stylesCatalog: readonly ExpertEditStyleTile[] | undefined;
  handleStylesPanelToggle: () => void;
  isMarkupExpandSelected: boolean;
  handleMarkupModalRef: React.Ref<HTMLDivElement>;
  handleMarkupModalControlsRef: React.Ref<HTMLDivElement>;
  handleMarkupModalStageRef: React.Ref<HTMLDivElement>;
  markupModalStageStyle: React.CSSProperties;
  renderMarkupModalGeneralPanel: React.ReactNode;
  modalStageViewportStyle: React.CSSProperties;
  markupModalViewportSize: StageViewportSize;
  markupModalStageElement: HTMLDivElement | null;
  editingLayerIndex: number | null;
  editingLayerValue: string;
  draggingLayerIndex: number | null;
  dragOverLayerIndex: number | null;
  resolvedSelectedLayerIndex: number | null;
  isGenerateDisabled: boolean;
  selectedLayerImageUrl: string | null;
  populatedLayerCount: number;
  setEditingLayerValue: React.Dispatch<React.SetStateAction<string>>;
  handleCommitLayerRename: (index: number) => void;
  clearLayerEditing: () => void;
  beginLayerRename: (index: number, value: string) => void;
  handleLayerDragStart: (event: React.DragEvent<HTMLDivElement>, index: number) => void;
  handleLayerDragOver: (event: React.DragEvent<HTMLDivElement>, index: number) => void;
  handleLayerDrop: (event: React.DragEvent<HTMLDivElement>, index: number) => void;
  handleLayerDragEnd: () => void;
  handleSelectLayer: (index: number) => void;
  handleDeleteLayer: (index: number) => void;
  handleManualFlatten: () => void | Promise<void>;
  handleRemoveBackground: () => void | Promise<void>;
  closeMarkupModal: () => void;
  handleMarkupModalLayersRef: React.Ref<HTMLDivElement>;
  handleMarkupModalDragShield: React.DragEventHandler<HTMLDivElement>;
};

/**
 * Builds the heavy inline and modal stage workspace content for Expert Edit.
 */
export function useExpertEditStageWorkspaceRuntime({
  isAdvancedEditModesEnabled,
  layers,
  markupStrokes,
  overlayCanvasRef,
  previewCanvasRef,
  modalOverlayCanvasRef,
  modalPreviewCanvasRef,
  inlineCompositionSurfaceViewportSize,
  primaryCanvasFrameStackElement,
  resolveLayerImageAspectRatio,
  resolveRenderableLayerTransform,
  isFlattenPending,
  isRemoveBackgroundPending,
  isPrimaryStageGenerating,
  renderSelectedLayerTransformOverlay,
  inlineStageInteractionRouter,
  inlineBackdropPanHandlers,
  modalStageInteractionRouter,
  isInpaintCollapsed,
  isInpaintCollapsing,
  collapsedToolsThemeClass,
  selectedRailTool,
  isInpaintToolSelected,
  isMarkupToolSelected,
  isMoveToolSelected,
  isInpaintLikeToolSelected,
  setSelectedRailTool,
  handleInpaintCollapseToggle,
  renderInpaintControlsContent,
  renderMarkupControlsContent,
  renderMoveControlsContent,
  shouldShowSecondaryReferenceAndStylesRow,
  extraImageUrls,
  inputRefs,
  extraDragActive,
  promptTokenPickerIsOpen,
  highlightPromptPickerSecondaryTargets,
  promptTokenPickerSelectedSlotIndex,
  allowPromptTokenSecondaryDrag,
  handleSecondaryPromptTokenDragStart,
  handleExtraDrop,
  handleExtraDragEnter,
  handleExtraDragOver,
  handleExtraDragLeave,
  onExtraImageChange,
  isStylesPanelOpen,
  selectedStyleId,
  stylesCatalog,
  handleStylesPanelToggle,
  isMarkupExpandSelected,
  handleMarkupModalRef,
  handleMarkupModalControlsRef,
  handleMarkupModalStageRef,
  markupModalStageStyle,
  renderMarkupModalGeneralPanel,
  modalStageViewportStyle,
  markupModalViewportSize,
  markupModalStageElement,
  editingLayerIndex,
  editingLayerValue,
  draggingLayerIndex,
  dragOverLayerIndex,
  resolvedSelectedLayerIndex,
  isGenerateDisabled,
  selectedLayerImageUrl,
  populatedLayerCount,
  setEditingLayerValue,
  handleCommitLayerRename,
  clearLayerEditing,
  beginLayerRename,
  handleLayerDragStart,
  handleLayerDragOver,
  handleLayerDrop,
  handleLayerDragEnd,
  handleSelectLayer,
  handleDeleteLayer,
  handleManualFlatten,
  handleRemoveBackground,
  closeMarkupModal,
  handleMarkupModalLayersRef,
  handleMarkupModalDragShield,
}: UseExpertEditStageWorkspaceRuntimeArgs) {
  const inlineInteractionHandlers = React.useMemo(
    () => ({
      onPointerDown: inlineStageInteractionRouter.onPointerDown,
      onPointerMove: inlineStageInteractionRouter.onPointerMove,
      onPointerUp: inlineStageInteractionRouter.onPointerUp,
      onPointerCancel: inlineStageInteractionRouter.onPointerCancel,
      onPointerLeave: inlineStageInteractionRouter.onPointerLeave,
    }),
    [inlineStageInteractionRouter]
  );

  const modalInteractionHandlers = React.useMemo(
    () => ({
      onPointerDown: modalStageInteractionRouter.onPointerDown,
      onPointerMove: modalStageInteractionRouter.onPointerMove,
      onPointerUp: modalStageInteractionRouter.onPointerUp,
      onPointerCancel: modalStageInteractionRouter.onPointerCancel,
      onPointerLeave: modalStageInteractionRouter.onPointerLeave,
    }),
    [modalStageInteractionRouter]
  );

  const inlineSceneContent = (
    <ExpertEditStageScene
      scope="inline"
      layers={layers}
      markupStrokes={markupStrokes}
      overlayCanvasRef={overlayCanvasRef}
      previewCanvasRef={previewCanvasRef}
      stageSize={inlineCompositionSurfaceViewportSize}
      stageElement={primaryCanvasFrameStackElement}
      inlineFallbackStageSize={inlineCompositionSurfaceViewportSize}
      resolveLayerImageAspectRatio={resolveLayerImageAspectRatio}
      resolveRenderableLayerTransform={resolveRenderableLayerTransform}
      isFlattenPending={isFlattenPending}
      isRemoveBackgroundPending={isRemoveBackgroundPending}
      isPrimaryStageGenerating={isPrimaryStageGenerating}
    />
  );

  const inlineTransformOverlay = renderSelectedLayerTransformOverlay(
    "inline",
    inlineCompositionSurfaceViewportSize,
    primaryCanvasFrameStackElement,
    inlineInteractionHandlers
  );

  const inlinePostStageTools = (
    <ExpertEditInlinePostStageTools
      isAdvancedEditModesEnabled={isAdvancedEditModesEnabled}
      isInpaintCollapsed={isInpaintCollapsed}
      isInpaintCollapsing={isInpaintCollapsing}
      collapsedToolsThemeClass={collapsedToolsThemeClass}
      selectedRailTool={selectedRailTool}
      isInpaintToolSelected={isInpaintToolSelected}
      isMarkupToolSelected={isMarkupToolSelected}
      isMoveToolSelected={isMoveToolSelected}
      isInpaintLikeToolSelected={isInpaintLikeToolSelected}
      setSelectedRailTool={setSelectedRailTool}
      handleInpaintCollapseToggle={handleInpaintCollapseToggle}
      renderInpaintControlsContent={renderInpaintControlsContent}
      renderMarkupControlsContent={renderMarkupControlsContent}
      renderMoveControlsContent={renderMoveControlsContent}
      secondaryContent={
        shouldShowSecondaryReferenceAndStylesRow ? (
          <ExpertEditSecondaryReferences
            extraImageUrls={extraImageUrls}
            inputRefs={inputRefs}
            extraDragActive={extraDragActive}
            isPromptTokenPickerOpen={promptTokenPickerIsOpen}
            highlightPromptPickerSecondaryTargets={highlightPromptPickerSecondaryTargets}
            promptTokenPickerSelectedSlotIndex={promptTokenPickerSelectedSlotIndex}
            allowPromptTokenSecondaryDrag={allowPromptTokenSecondaryDrag}
            onSecondaryDragStart={handleSecondaryPromptTokenDragStart}
            onSecondaryDrop={handleExtraDrop}
            onSecondaryDragEnter={handleExtraDragEnter}
            onSecondaryDragOver={handleExtraDragOver}
            onSecondaryDragLeave={handleExtraDragLeave}
            onExtraImageChange={onExtraImageChange}
            isStylesPanelOpen={isStylesPanelOpen}
            selectedStyleId={selectedStyleId}
            stylesCatalog={stylesCatalog}
            onStylesPanelToggle={handleStylesPanelToggle}
          />
        ) : null
      }
    />
  );

  const modalSurface = {
    isOpen: isMarkupExpandSelected,
    modalRef: handleMarkupModalRef,
    controlsColumnRef: handleMarkupModalControlsRef,
    stageRef: handleMarkupModalStageRef,
    stageStyle: markupModalStageStyle,
    generalPanel: renderMarkupModalGeneralPanel,
    movePanel: renderMoveControlsContent("modal"),
    inpaintPanel: renderInpaintControlsContent("modal"),
    markupPanel: renderMarkupControlsContent("modal"),
    viewportStyle: modalStageViewportStyle,
    sceneContent: (
      <ExpertEditStageScene
        scope="modal"
        layers={layers}
        markupStrokes={markupStrokes}
        overlayCanvasRef={modalOverlayCanvasRef}
        previewCanvasRef={modalPreviewCanvasRef}
        stageSize={markupModalViewportSize}
        stageElement={markupModalStageElement}
        inlineFallbackStageSize={inlineCompositionSurfaceViewportSize}
        resolveLayerImageAspectRatio={resolveLayerImageAspectRatio}
        resolveRenderableLayerTransform={resolveRenderableLayerTransform}
        isFlattenPending={isFlattenPending}
        isRemoveBackgroundPending={isRemoveBackgroundPending}
        isPrimaryStageGenerating={isPrimaryStageGenerating}
      />
    ),
    transformOverlay: renderSelectedLayerTransformOverlay(
      "modal",
      markupModalViewportSize,
      markupModalStageElement,
      modalInteractionHandlers
    ),
    layersPanel: (
      <ExpertEditLayersPanel
        scope="modal"
        layers={layers}
        editingLayerIndex={editingLayerIndex}
        editingLayerValue={editingLayerValue}
        draggingLayerIndex={draggingLayerIndex}
        dragOverLayerIndex={dragOverLayerIndex}
        resolvedSelectedLayerIndex={resolvedSelectedLayerIndex}
        isGenerateDisabled={isGenerateDisabled}
        selectedLayerImageUrl={selectedLayerImageUrl}
        isRemoveBackgroundPending={isRemoveBackgroundPending}
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
        onDeleteLayer={handleDeleteLayer}
        onFlatten={() => void handleManualFlatten()}
        onRemoveBackground={handleRemoveBackground}
        onCloseModal={closeMarkupModal}
        modalLayersRef={handleMarkupModalLayersRef}
      />
    ),
    onClose: closeMarkupModal,
    onDragShield: handleMarkupModalDragShield,
    interactionHandlers: modalInteractionHandlers,
    onStageWheel: modalStageInteractionRouter.onWheel,
  };

  return {
    inlineBackdropPanHandlers,
    inlineInteractionHandlers,
    inlineStageWheelHandler: inlineStageInteractionRouter.onWheel,
    inlineSceneContent,
    inlineTransformOverlay,
    inlinePostStageTools,
    modalSurface,
  };
}
