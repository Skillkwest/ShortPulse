/**
 * Presentational stage-shell mounts for Expert Edit.
 * Renders the inline stage surface and expanded modal shell around the existing stage-core callbacks.
 */
import React from "react";

import { ExpertEditMarkupModalShell } from "./ExpertEditMarkupModalShell";
import {
  PrimaryCanvasFrameStack,
  PrimaryCompositionSurface,
  PrimaryStageShell,
  PrimaryStageViewportLayer,
} from "./ExpertEditStagePrimitives";

export type StageInteractionHandlers = {
  onPointerDown: React.PointerEventHandler<HTMLDivElement>;
  onPointerMove: React.PointerEventHandler<HTMLDivElement>;
  onPointerUp: React.PointerEventHandler<HTMLDivElement>;
  onPointerCancel: React.PointerEventHandler<HTMLDivElement>;
  onPointerLeave: React.PointerEventHandler<HTMLDivElement>;
};

export type StagePanHandlers = Pick<
  StageInteractionHandlers,
  "onPointerDown" | "onPointerMove" | "onPointerUp" | "onPointerCancel" | "onPointerLeave"
>;

type ExpertEditInlineStageSurfaceProps = {
  stageRef: React.Ref<HTMLDivElement>;
  isEmpty: boolean;
  isBusy: boolean;
  overlayActions?: React.ReactNode;
  onPointerDownCapture: React.PointerEventHandler<HTMLDivElement>;
  onPointerMoveCapture: React.PointerEventHandler<HTMLDivElement>;
  onPointerUpCapture: React.PointerEventHandler<HTMLDivElement>;
  onPointerCancelCapture: React.PointerEventHandler<HTMLDivElement>;
  viewportStyle: React.CSSProperties;
  frameStackRef: React.Ref<HTMLDivElement>;
  isPopulated: boolean;
  isDragActive: boolean;
  frameStyle: React.CSSProperties;
  onDrop?: React.DragEventHandler<HTMLDivElement>;
  onDragEnter?: React.DragEventHandler<HTMLDivElement>;
  onDragOver?: React.DragEventHandler<HTMLDivElement>;
  onDragLeave?: React.DragEventHandler<HTMLDivElement>;
  surfaceRef: React.Ref<HTMLDivElement>;
  isVisible: boolean;
  isPresetsOpen: boolean;
  surfaceStyle: React.CSSProperties;
  shouldRenderInteractive: boolean;
  backdropPanHandlers: StagePanHandlers;
  interactionHandlers: StageInteractionHandlers;
  onStageMouseDown?: React.MouseEventHandler<HTMLDivElement>;
  onStageAuxClick?: React.MouseEventHandler<HTMLDivElement>;
  onStageContextMenu?: React.MouseEventHandler<HTMLDivElement>;
  onStageClick?: React.MouseEventHandler<HTMLDivElement>;
  onStageDoubleClick?: React.MouseEventHandler<HTMLDivElement>;
  onStageWheel?: React.WheelEventHandler<HTMLDivElement>;
  sceneContent: React.ReactNode;
  transformOverlay: React.ReactNode;
};

/**
 * Renders the canonical inline stage shell for Expert Edit.
 */
export function ExpertEditInlineStageSurface({
  stageRef,
  isEmpty,
  isBusy,
  overlayActions = null,
  onPointerDownCapture,
  onPointerMoveCapture,
  onPointerUpCapture,
  onPointerCancelCapture,
  viewportStyle,
  frameStackRef,
  isPopulated,
  isDragActive,
  frameStyle,
  onDrop,
  onDragEnter,
  onDragOver,
  onDragLeave,
  surfaceRef,
  isVisible,
  isPresetsOpen,
  surfaceStyle,
  shouldRenderInteractive,
  backdropPanHandlers,
  interactionHandlers,
  onStageMouseDown,
  onStageAuxClick,
  onStageContextMenu,
  onStageClick,
  onStageDoubleClick,
  onStageWheel,
  sceneContent,
  transformOverlay,
}: ExpertEditInlineStageSurfaceProps) {
  return (
    <PrimaryStageShell
      stageRef={stageRef}
      isEmpty={isEmpty}
      isBusy={isBusy}
      overlayActions={overlayActions}
      onPointerDownCapture={onPointerDownCapture}
      onPointerMoveCapture={onPointerMoveCapture}
      onPointerUpCapture={onPointerUpCapture}
      onPointerCancelCapture={onPointerCancelCapture}
      onPointerDown={backdropPanHandlers.onPointerDown}
      onPointerMove={backdropPanHandlers.onPointerMove}
      onPointerUp={backdropPanHandlers.onPointerUp}
      onPointerCancel={backdropPanHandlers.onPointerCancel}
      onPointerLeave={backdropPanHandlers.onPointerLeave}
      onWheel={onStageWheel}
    >
      <PrimaryStageViewportLayer style={viewportStyle}>
        <PrimaryCanvasFrameStack
          frameStackRef={frameStackRef}
          isPopulated={isPopulated}
          isDragActive={isDragActive}
          style={frameStyle}
          onWheel={shouldRenderInteractive ? onStageWheel : undefined}
          onDrop={onDrop}
          onDragEnter={onDragEnter}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
        >
          <PrimaryCompositionSurface
            surfaceRef={surfaceRef}
            isVisible={isVisible}
            isBusy={isBusy}
            isDragActive={isDragActive}
            isPresetsOpen={isPresetsOpen}
            style={surfaceStyle}
            onPointerDown={shouldRenderInteractive ? interactionHandlers.onPointerDown : undefined}
            onPointerMove={shouldRenderInteractive ? interactionHandlers.onPointerMove : undefined}
            onPointerUp={shouldRenderInteractive ? interactionHandlers.onPointerUp : undefined}
            onPointerCancel={
              shouldRenderInteractive ? interactionHandlers.onPointerCancel : undefined
            }
            onPointerLeave={
              shouldRenderInteractive ? interactionHandlers.onPointerLeave : undefined
            }
            onMouseDown={shouldRenderInteractive ? onStageMouseDown : undefined}
            onAuxClick={shouldRenderInteractive ? onStageAuxClick : undefined}
            onContextMenu={shouldRenderInteractive ? onStageContextMenu : undefined}
            onClick={shouldRenderInteractive ? onStageClick : undefined}
            onDoubleClick={shouldRenderInteractive ? onStageDoubleClick : undefined}
          >
            {shouldRenderInteractive ? sceneContent : null}
          </PrimaryCompositionSurface>
          {shouldRenderInteractive ? transformOverlay : null}
        </PrimaryCanvasFrameStack>
      </PrimaryStageViewportLayer>
    </PrimaryStageShell>
  );
}

type ExpertEditModalStageSurfaceProps = {
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
  onDragShield: React.DragEventHandler<HTMLElement>;
  onStageMouseDown: React.MouseEventHandler<HTMLDivElement>;
  onStageAuxClick: React.MouseEventHandler<HTMLDivElement>;
  interactionHandlers: StageInteractionHandlers;
  onStageWheel: React.WheelEventHandler<HTMLDivElement>;
};

/**
 * Renders the expanded modal shell around the canonical stage content.
 */
export function ExpertEditModalStageSurface({
  isOpen,
  modalRef,
  controlsColumnRef,
  stageRef,
  stageStyle,
  generalPanel,
  movePanel,
  inpaintPanel,
  markupPanel,
  viewportStyle,
  sceneContent,
  transformOverlay,
  layersPanel,
  onClose,
  onDragShield,
  onStageMouseDown,
  onStageAuxClick,
  interactionHandlers,
  onStageWheel,
}: ExpertEditModalStageSurfaceProps) {
  return (
    <ExpertEditMarkupModalShell
      isOpen={isOpen}
      modalRef={modalRef}
      controlsColumnRef={controlsColumnRef}
      stageRef={stageRef}
      stageStyle={stageStyle}
      generalPanel={generalPanel}
      movePanel={movePanel}
      inpaintPanel={inpaintPanel}
      markupPanel={markupPanel}
      stageContent={
        <>
          <PrimaryStageViewportLayer style={viewportStyle}>
            {sceneContent}
          </PrimaryStageViewportLayer>
          {transformOverlay}
        </>
      }
      layersPanel={layersPanel}
      onClose={onClose}
      onDragShield={onDragShield}
      onStageMouseDown={onStageMouseDown}
      onStageAuxClick={onStageAuxClick}
      onStagePointerDown={interactionHandlers.onPointerDown}
      onStagePointerMove={interactionHandlers.onPointerMove}
      onStagePointerUp={interactionHandlers.onPointerUp}
      onStagePointerCancel={interactionHandlers.onPointerCancel}
      onStagePointerLeave={interactionHandlers.onPointerLeave}
      onStageWheel={onStageWheel}
    />
  );
}
