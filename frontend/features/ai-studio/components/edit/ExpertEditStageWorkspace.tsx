import React from "react";
import { TrashSimple } from "phosphor-react";

import { ExpertEditStageContextMenu } from "./ExpertEditStagePrimitives";
import {
  ExpertEditInlineStageSurface,
  ExpertEditModalStageSurface,
  type StagePanHandlers,
  type StageInteractionHandlers,
} from "./ExpertEditStageSurface";
type ExpertEditStageWorkspaceProps = {
  sidebar: React.ReactNode;
  hasPrimaryCompositePreview: boolean;
  selectedLayerName: string | null;
  onDeleteSelectedLayer: () => void;
  isPrimaryStageBusy: boolean;
  onInlineStagePointerDownCapture: React.PointerEventHandler<HTMLDivElement>;
  onInlineStagePointerMoveCapture: React.PointerEventHandler<HTMLDivElement>;
  onInlineStagePointerUpCapture: React.PointerEventHandler<HTMLDivElement>;
  onInlineStagePointerCancelCapture: React.PointerEventHandler<HTMLDivElement>;
  inlineViewportStyle: React.CSSProperties;
  inlineStageRef: React.Ref<HTMLDivElement>;
  frameStackRef: React.Ref<HTMLDivElement>;
  isPrimaryDragActive: boolean;
  frameStyle: React.CSSProperties;
  onPrimaryDrop: React.DragEventHandler<HTMLDivElement>;
  onPrimaryDragEnter: React.DragEventHandler<HTMLDivElement>;
  onPrimaryDragOver: React.DragEventHandler<HTMLDivElement>;
  onPrimaryDragLeave: React.DragEventHandler<HTMLDivElement>;
  primarySurfaceRef: React.Ref<HTMLDivElement>;
  isMorePresetsSurfaceOpen: boolean;
  primarySurfaceStyle: React.CSSProperties;
  emptyPrimarySurfaceStyle: React.CSSProperties;
  shouldRenderInlineInteractiveStage: boolean;
  inlineBackdropPanHandlers: StagePanHandlers;
  inlineInteractionHandlers: StageInteractionHandlers;
  onStageMouseDown: React.MouseEventHandler<HTMLDivElement>;
  onStageAuxClick: React.MouseEventHandler<HTMLDivElement>;
  onStageContextMenu: React.MouseEventHandler<HTMLDivElement>;
  onStageClick: React.MouseEventHandler<HTMLDivElement>;
  onStageDoubleClick: React.MouseEventHandler<HTMLDivElement>;
  onInlineStageWheel: React.WheelEventHandler<HTMLDivElement>;
  inlineSceneContent: React.ReactNode;
  inlineTransformOverlay: React.ReactNode;
  inlinePostStageTools: React.ReactNode;
  promptAndSelectors: React.ReactNode;
  shouldBlurPromptUnderlay: boolean;
  statusToast: React.ReactNode;
  modalSurface: {
    isOpen: boolean;
    modalRef: React.Ref<HTMLDivElement>;
    controlsColumnRef: React.Ref<HTMLDivElement>;
    stageRef: React.Ref<HTMLDivElement>;
    stageStyle: React.CSSProperties;
    generalPanel: React.ReactNode;
    movePanel: React.ReactNode;
    inpaintPanel: React.ReactNode;
    markupPanel: React.ReactNode;
    viewportStyle: React.CSSProperties;
    sceneContent: React.ReactNode;
    transformOverlay: React.ReactNode;
    layersPanel: React.ReactNode;
    onClose: () => void;
    onDragShield: React.DragEventHandler<HTMLDivElement>;
    interactionHandlers: StageInteractionHandlers;
    onStageWheel: React.WheelEventHandler<HTMLDivElement>;
  };
  contextMenu: {
    isOpen: boolean;
    menuRef: React.Ref<HTMLDivElement>;
    x: number;
    y: number;
    isMarkupExpandSelected: boolean;
    hasSelectedLayerImage: boolean;
    onResetView: () => void;
    onExpand: () => void;
    onAddImage: () => void;
    onReset: () => void;
    onRemoveImage: () => void;
  };
};

export function ExpertEditStageWorkspace({
  sidebar,
  hasPrimaryCompositePreview,
  selectedLayerName,
  onDeleteSelectedLayer,
  isPrimaryStageBusy,
  onInlineStagePointerDownCapture,
  onInlineStagePointerMoveCapture,
  onInlineStagePointerUpCapture,
  onInlineStagePointerCancelCapture,
  inlineViewportStyle,
  inlineStageRef,
  frameStackRef,
  isPrimaryDragActive,
  frameStyle,
  onPrimaryDrop,
  onPrimaryDragEnter,
  onPrimaryDragOver,
  onPrimaryDragLeave,
  primarySurfaceRef,
  isMorePresetsSurfaceOpen,
  primarySurfaceStyle,
  emptyPrimarySurfaceStyle,
  shouldRenderInlineInteractiveStage,
  inlineBackdropPanHandlers,
  inlineInteractionHandlers,
  onStageMouseDown,
  onStageAuxClick,
  onStageContextMenu,
  onStageClick,
  onStageDoubleClick,
  onInlineStageWheel,
  inlineSceneContent,
  inlineTransformOverlay,
  inlinePostStageTools,
  promptAndSelectors,
  shouldBlurPromptUnderlay,
  statusToast,
  modalSurface,
  contextMenu,
}: ExpertEditStageWorkspaceProps) {
  return (
    <>
      <div className="edit-expert-main-stage">
        <div className="edit-expert-preset-toolbar" aria-label="Edit preset toolbar">
          {sidebar}
        </div>

        <div
          className={`edit-expert-primary-column edit-expert-primary-column-shell ${shouldBlurPromptUnderlay ? "is-composer-expanded" : ""}`.trim()}
        >
          <ExpertEditInlineStageSurface
            stageRef={inlineStageRef}
            isEmpty={!hasPrimaryCompositePreview}
            isBusy={isPrimaryStageBusy}
            overlayActions={
              hasPrimaryCompositePreview && selectedLayerName ? (
                <div className="edit-expert-stage-overlay-ui">
                  <button
                    type="button"
                    className="edit-expert-stage-delete-btn"
                    aria-label={`Delete selected layer (${selectedLayerName})`}
                    onClick={onDeleteSelectedLayer}
                  >
                    <TrashSimple size={12} weight="regular" />
                  </button>
                </div>
              ) : null
            }
            onPointerDownCapture={onInlineStagePointerDownCapture}
            onPointerMoveCapture={onInlineStagePointerMoveCapture}
            onPointerUpCapture={onInlineStagePointerUpCapture}
            onPointerCancelCapture={onInlineStagePointerCancelCapture}
            viewportStyle={inlineViewportStyle}
            frameStackRef={frameStackRef}
            isPopulated={hasPrimaryCompositePreview}
            isDragActive={isPrimaryDragActive}
            frameStyle={frameStyle}
            onDrop={onPrimaryDrop}
            onDragEnter={onPrimaryDragEnter}
            onDragOver={onPrimaryDragOver}
            onDragLeave={onPrimaryDragLeave}
            surfaceRef={primarySurfaceRef}
            isVisible={hasPrimaryCompositePreview}
            isPresetsOpen={isMorePresetsSurfaceOpen}
            surfaceStyle={
              hasPrimaryCompositePreview ? primarySurfaceStyle : emptyPrimarySurfaceStyle
            }
            shouldRenderInteractive={shouldRenderInlineInteractiveStage}
            backdropPanHandlers={inlineBackdropPanHandlers}
            interactionHandlers={inlineInteractionHandlers}
            onStageMouseDown={onStageMouseDown}
            onStageAuxClick={onStageAuxClick}
            onStageContextMenu={onStageContextMenu}
            onStageClick={onStageClick}
            onStageDoubleClick={onStageDoubleClick}
            onStageWheel={onInlineStageWheel}
            sceneContent={inlineSceneContent}
            transformOverlay={inlineTransformOverlay}
          />
          <div className="edit-expert-column-wrapper edit-expert-column-wrapper--center edit-expert-post-stage-wrapper">
            <div
              className={`edit-expert-post-stage-overlay-zone ${shouldBlurPromptUnderlay ? "is-composer-expanded" : ""}`.trim()}
            >
              <div className="edit-expert-post-stage-base-layer">{inlinePostStageTools}</div>
              <div className="edit-expert-post-stage-composer-overlay">{promptAndSelectors}</div>
            </div>
          </div>
        </div>
      </div>

      {statusToast}

      <ExpertEditModalStageSurface
        isOpen={modalSurface.isOpen}
        modalRef={modalSurface.modalRef}
        controlsColumnRef={modalSurface.controlsColumnRef}
        stageRef={modalSurface.stageRef}
        stageStyle={modalSurface.stageStyle}
        generalPanel={modalSurface.generalPanel}
        movePanel={modalSurface.movePanel}
        inpaintPanel={modalSurface.inpaintPanel}
        markupPanel={modalSurface.markupPanel}
        viewportStyle={modalSurface.viewportStyle}
        sceneContent={modalSurface.sceneContent}
        transformOverlay={modalSurface.transformOverlay}
        layersPanel={modalSurface.layersPanel}
        onClose={modalSurface.onClose}
        onDragShield={modalSurface.onDragShield}
        onStageMouseDown={onStageMouseDown}
        onStageAuxClick={onStageAuxClick}
        interactionHandlers={modalSurface.interactionHandlers}
        onStageWheel={modalSurface.onStageWheel}
      />

      {contextMenu.isOpen ? (
        <ExpertEditStageContextMenu
          menuRef={contextMenu.menuRef}
          x={contextMenu.x}
          y={contextMenu.y}
          isMarkupExpandSelected={contextMenu.isMarkupExpandSelected}
          hasSelectedLayerImage={contextMenu.hasSelectedLayerImage}
          onResetView={contextMenu.onResetView}
          onExpand={contextMenu.onExpand}
          onAddImage={contextMenu.onAddImage}
          onReset={contextMenu.onReset}
          onRemoveImage={contextMenu.onRemoveImage}
        />
      ) : null}
    </>
  );
}
