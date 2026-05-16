import React from "react";

const focusKeyboardPanOwner = (element: HTMLDivElement | null) => {
  element?.focus({ preventScroll: true });
};

type PrimaryStageShellProps = {
  children: React.ReactNode;
  overlayActions?: React.ReactNode;
  isEmpty: boolean;
  isBusy: boolean;
  stageRef: React.Ref<HTMLDivElement>;
  onPointerDownCapture: React.PointerEventHandler<HTMLDivElement>;
  onPointerMoveCapture: React.PointerEventHandler<HTMLDivElement>;
  onPointerUpCapture: React.PointerEventHandler<HTMLDivElement>;
  onPointerCancelCapture: React.PointerEventHandler<HTMLDivElement>;
  onPointerDown?: React.PointerEventHandler<HTMLDivElement>;
  onPointerMove?: React.PointerEventHandler<HTMLDivElement>;
  onPointerUp?: React.PointerEventHandler<HTMLDivElement>;
  onPointerCancel?: React.PointerEventHandler<HTMLDivElement>;
  onPointerLeave?: React.PointerEventHandler<HTMLDivElement>;
  onWheel?: React.WheelEventHandler<HTMLDivElement>;
};

export function PrimaryStageShell({
  children,
  overlayActions = null,
  isEmpty,
  isBusy,
  stageRef,
  onPointerDownCapture,
  onPointerMoveCapture,
  onPointerUpCapture,
  onPointerCancelCapture,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onPointerLeave,
  onWheel,
}: PrimaryStageShellProps) {
  const handleBackdropPointerDown = React.useCallback<React.PointerEventHandler<HTMLDivElement>>(
    (event) => {
      if (event.target !== event.currentTarget) return;
      focusKeyboardPanOwner(event.currentTarget);
      onPointerDown?.(event);
    },
    [onPointerDown]
  );

  const handleBackdropPointerMove = React.useCallback<React.PointerEventHandler<HTMLDivElement>>(
    (event) => {
      if (event.target !== event.currentTarget) return;
      onPointerMove?.(event);
    },
    [onPointerMove]
  );

  const handleBackdropPointerUp = React.useCallback<React.PointerEventHandler<HTMLDivElement>>(
    (event) => {
      if (event.target !== event.currentTarget) return;
      onPointerUp?.(event);
    },
    [onPointerUp]
  );

  const handleBackdropPointerCancel = React.useCallback<React.PointerEventHandler<HTMLDivElement>>(
    (event) => {
      if (event.target !== event.currentTarget) return;
      onPointerCancel?.(event);
    },
    [onPointerCancel]
  );

  const handleBackdropPointerLeave = React.useCallback<React.PointerEventHandler<HTMLDivElement>>(
    (event) => {
      if (event.target !== event.currentTarget) return;
      onPointerLeave?.(event);
    },
    [onPointerLeave]
  );

  const handleBackdropWheel = React.useCallback<React.WheelEventHandler<HTMLDivElement>>(
    (event) => {
      if (event.target !== event.currentTarget) return;
      onWheel?.(event);
    },
    [onWheel]
  );

  return (
    <div
      ref={stageRef}
      className={`edit-expert-column-wrapper edit-expert-column-wrapper--center edit-expert-primary-stage-shell ${
        isEmpty ? "is-empty-stage" : ""
      }`}
      style={{ minHeight: "calc(var(--edit-expert-primary-size) + 72px)" }}
      aria-label={isEmpty ? "Primary edit stage" : undefined}
      aria-busy={isEmpty && isBusy ? true : undefined}
      data-keyboard-pan-owner="true"
      tabIndex={isEmpty ? 0 : -1}
      onPointerDownCapture={onPointerDownCapture}
      onPointerMoveCapture={onPointerMoveCapture}
      onPointerUpCapture={onPointerUpCapture}
      onPointerCancelCapture={onPointerCancelCapture}
      onPointerDown={onPointerDown ? handleBackdropPointerDown : undefined}
      onPointerMove={onPointerMove ? handleBackdropPointerMove : undefined}
      onPointerUp={onPointerUp ? handleBackdropPointerUp : undefined}
      onPointerCancel={onPointerCancel ? handleBackdropPointerCancel : undefined}
      onPointerLeave={onPointerLeave ? handleBackdropPointerLeave : undefined}
      onWheel={onWheel ? handleBackdropWheel : undefined}
    >
      {children}
      {overlayActions}
    </div>
  );
}

type PrimaryCompositionSurfaceProps = {
  children: React.ReactNode;
  isVisible: boolean;
  isBusy: boolean;
  isDragActive: boolean;
  isPresetsOpen: boolean;
  surfaceRef: React.Ref<HTMLDivElement>;
  style: React.CSSProperties;
  onDrop?: React.DragEventHandler<HTMLDivElement>;
  onDragEnter?: React.DragEventHandler<HTMLDivElement>;
  onDragOver?: React.DragEventHandler<HTMLDivElement>;
  onDragLeave?: React.DragEventHandler<HTMLDivElement>;
  onPointerDown?: React.PointerEventHandler<HTMLDivElement>;
  onPointerMove?: React.PointerEventHandler<HTMLDivElement>;
  onPointerUp?: React.PointerEventHandler<HTMLDivElement>;
  onPointerCancel?: React.PointerEventHandler<HTMLDivElement>;
  onPointerLeave?: React.PointerEventHandler<HTMLDivElement>;
  onMouseDown?: React.MouseEventHandler<HTMLDivElement>;
  onAuxClick?: React.MouseEventHandler<HTMLDivElement>;
  onContextMenu?: React.MouseEventHandler<HTMLDivElement>;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  onDoubleClick?: React.MouseEventHandler<HTMLDivElement>;
};

export function PrimaryCompositionSurface({
  children,
  isVisible,
  isBusy,
  isDragActive,
  isPresetsOpen,
  surfaceRef,
  style,
  onDrop,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onPointerLeave,
  onMouseDown,
  onAuxClick,
  onContextMenu,
  onClick,
  onDoubleClick,
}: PrimaryCompositionSurfaceProps) {
  const handlePointerDown = React.useCallback<React.PointerEventHandler<HTMLDivElement>>(
    (event) => {
      focusKeyboardPanOwner(event.currentTarget);
      onPointerDown?.(event);
    },
    [onPointerDown]
  );

  return (
    <div
      ref={surfaceRef}
      className={`edit-expert-primary-composition-surface ${
        isVisible ? "has-preview" : "is-hidden-stage-surface"
      } ${isPresetsOpen ? "is-presets-open" : ""} ${isDragActive ? "is-dragging" : ""}`}
      style={style}
      onDrop={onDrop}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onPointerDown={onPointerDown ? handlePointerDown : undefined}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerLeave={onPointerLeave}
      onMouseDown={onMouseDown}
      onAuxClick={onAuxClick}
      onContextMenu={onContextMenu}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      aria-label={isVisible ? "Primary composition surface" : undefined}
      aria-busy={isVisible && isBusy ? true : undefined}
      aria-hidden={!isVisible}
      data-keyboard-pan-owner={isVisible ? "true" : undefined}
      tabIndex={isVisible ? 0 : -1}
    >
      {children}
    </div>
  );
}

type PrimaryStageViewportLayerProps = {
  children: React.ReactNode;
  style: React.CSSProperties;
};

export function PrimaryStageViewportLayer({ children, style }: PrimaryStageViewportLayerProps) {
  return (
    <div className="edit-expert-markup-viewport" style={style}>
      {children}
    </div>
  );
}

type PrimaryCanvasFrameStackProps = {
  children: React.ReactNode;
  isPopulated: boolean;
  isDragActive: boolean;
  frameStackRef?: React.Ref<HTMLDivElement>;
  style: React.CSSProperties;
  onWheel?: React.WheelEventHandler<HTMLDivElement>;
  onDrop?: React.DragEventHandler<HTMLDivElement>;
  onDragEnter?: React.DragEventHandler<HTMLDivElement>;
  onDragOver?: React.DragEventHandler<HTMLDivElement>;
  onDragLeave?: React.DragEventHandler<HTMLDivElement>;
};

export function PrimaryCanvasFrameStack({
  children,
  isPopulated,
  isDragActive,
  frameStackRef,
  style,
  onWheel,
  onDrop,
  onDragEnter,
  onDragOver,
  onDragLeave,
}: PrimaryCanvasFrameStackProps) {
  return (
    <div
      ref={frameStackRef}
      className={`edit-expert-primary-canvas-frame-stack ${isPopulated ? "has-preview" : "is-empty"} ${
        isDragActive ? "is-dragging" : ""
      }`}
      style={style}
      data-testid="edit-expert-primary-canvas-frame-stack"
      onWheel={onWheel}
      onDrop={onDrop}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
    >
      <div className="edit-expert-primary-canvas-frame" aria-hidden="true" />
      {!isPopulated ? (
        <p className="edit-expert-primary-empty-helper" aria-hidden="true">
          Drag &amp; drop an image from the Reference Grid
        </p>
      ) : null}
      {children}
    </div>
  );
}

type ExpertEditStageContextMenuProps = {
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

export function ExpertEditStageContextMenu({
  menuRef,
  x,
  y,
  isMarkupExpandSelected,
  hasSelectedLayerImage,
  onResetView,
  onExpand,
  onAddImage,
  onReset,
  onRemoveImage,
}: ExpertEditStageContextMenuProps) {
  return (
    <div
      ref={menuRef}
      className="edit-expert-stage-context-menu"
      role="menu"
      aria-label="Stage actions"
      style={{
        left: `${x}px`,
        top: `${y}px`,
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <button type="button" role="menuitem" onClick={onResetView}>
        Center
      </button>
      <button type="button" role="menuitem" onClick={onExpand} disabled={isMarkupExpandSelected}>
        Expand
      </button>
      <button type="button" role="menuitem" onClick={onAddImage}>
        Add Image
      </button>
      <button type="button" role="menuitem" className="is-danger" onClick={onReset}>
        Reset All
      </button>
      <button
        type="button"
        role="menuitem"
        className="is-danger"
        onClick={onRemoveImage}
        disabled={!hasSelectedLayerImage}
      >
        Remove Image
      </button>
    </div>
  );
}
