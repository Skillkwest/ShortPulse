/**
 * Presentational shell for the expanded Expert Edit markup modal.
 * Keeps modal layout composition separate from ExpertEditPanelView orchestration logic.
 */
import React from "react";

type ExpertEditMarkupModalShellProps = {
  isOpen: boolean;
  modalRef: React.Ref<HTMLDivElement>;
  controlsColumnRef: React.Ref<HTMLDivElement>;
  stageRef?: React.Ref<HTMLDivElement>;
  stageStyle: React.CSSProperties;
  generalPanel: React.ReactNode;
  movePanel: React.ReactNode;
  inpaintPanel: React.ReactNode;
  markupPanel: React.ReactNode;
  stageContent: React.ReactNode;
  layersPanel: React.ReactNode;
  onClose: () => void;
  onDragShield: (event: React.DragEvent<HTMLElement>) => void;
  onStageMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void;
  onStageAuxClick: (event: React.MouseEvent<HTMLDivElement>) => void;
  onStagePointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onStagePointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  onStagePointerUp: (event: React.PointerEvent<HTMLDivElement>) => void;
  onStagePointerCancel: (event: React.PointerEvent<HTMLDivElement>) => void;
  onStagePointerLeave: (event: React.PointerEvent<HTMLDivElement>) => void;
  onStageWheel: (event: React.WheelEvent<HTMLDivElement>) => void;
};

export const ExpertEditMarkupModalShell = ({
  isOpen,
  modalRef,
  controlsColumnRef,
  stageRef,
  stageStyle,
  generalPanel,
  movePanel,
  inpaintPanel,
  markupPanel,
  stageContent,
  layersPanel,
  onClose,
  onDragShield,
  onStageMouseDown,
  onStageAuxClick,
  onStagePointerDown,
  onStagePointerMove,
  onStagePointerUp,
  onStagePointerCancel,
  onStagePointerLeave,
  onStageWheel,
}: ExpertEditMarkupModalShellProps) => {
  if (!isOpen) return null;

  return (
    <div
      className="edit-expert-markup-modal-backdrop"
      role="presentation"
      onClick={onClose}
      onDragEnter={onDragShield}
      onDragOver={onDragShield}
      onDrop={onDragShield}
    >
      <div
        className="edit-expert-markup-modal"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Expanded markup canvas"
        onClick={(event) => event.stopPropagation()}
        onDragEnter={onDragShield}
        onDragOver={onDragShield}
        onDrop={onDragShield}
      >
        <div ref={controlsColumnRef} className="edit-expert-markup-modal-controls-column">
          <div
            className="edit-expert-markup-modal-controls-compact edit-expert-markup-modal-controls-compact--general"
            role="group"
            aria-label="General tools"
          >
            {generalPanel}
          </div>
          <div
            className="edit-expert-markup-modal-controls-compact edit-expert-markup-modal-controls-compact--move"
            role="group"
            aria-label="Move tools"
          >
            {movePanel}
          </div>
          <div
            className="edit-expert-markup-modal-controls-compact edit-expert-markup-modal-controls-compact--inpaint"
            role="group"
            aria-label="In-paint tools"
          >
            {inpaintPanel}
          </div>
          <div
            className="edit-expert-markup-modal-controls-compact"
            role="group"
            aria-label="Markup tools"
          >
            {markupPanel}
          </div>
        </div>
        <div
          className="edit-expert-markup-modal-stage"
          ref={stageRef}
          style={stageStyle}
          onMouseDown={onStageMouseDown}
          onAuxClick={onStageAuxClick}
          onPointerDown={onStagePointerDown}
          onPointerMove={onStagePointerMove}
          onPointerUp={onStagePointerUp}
          onPointerCancel={onStagePointerCancel}
          onPointerLeave={onStagePointerLeave}
          onWheel={onStageWheel}
        >
          {stageContent}
        </div>
        {layersPanel}
      </div>
    </div>
  );
};
