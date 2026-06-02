import React from "react";

type SharedMediaDetailContentLayoutProps = {
  topBar?: React.ReactNode;
  mainContentClassName?: string;
  stageClassName: string;
  stageRef?: React.Ref<HTMLDivElement>;
  onStageWheel?: React.WheelEventHandler<HTMLDivElement>;
  onStageDoubleClick?: React.MouseEventHandler<HTMLDivElement>;
  onStagePointerDown?: React.PointerEventHandler<HTMLDivElement>;
  onStagePointerMove?: React.PointerEventHandler<HTMLDivElement>;
  onStagePointerUp?: React.PointerEventHandler<HTMLDivElement>;
  onStagePointerCancel?: React.PointerEventHandler<HTMLDivElement>;
  stage: React.ReactNode;
  sidePanel?: React.ReactNode;
};

/**
 * Shared structural layout for AI Studio media detail dialogs.
 * Keeps top controls, stage, and optional side rail aligned across surfaces.
 */
export function SharedMediaDetailContentLayout({
  topBar = null,
  mainContentClassName,
  stageClassName,
  stageRef,
  onStageWheel,
  onStageDoubleClick,
  onStagePointerDown,
  onStagePointerMove,
  onStagePointerUp,
  onStagePointerCancel,
  stage,
  sidePanel = null,
}: SharedMediaDetailContentLayoutProps) {
  const resolvedMainContentClassName = ["art-modal-main-content", mainContentClassName]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      {topBar}
      <div className={resolvedMainContentClassName}>
        <div
          ref={stageRef}
          className={stageClassName}
          onWheel={onStageWheel}
          onDoubleClick={onStageDoubleClick}
          onPointerDown={onStagePointerDown}
          onPointerMove={onStagePointerMove}
          onPointerUp={onStagePointerUp}
          onPointerCancel={onStagePointerCancel}
        >
          {stage}
        </div>
        {sidePanel}
      </div>
    </>
  );
}
