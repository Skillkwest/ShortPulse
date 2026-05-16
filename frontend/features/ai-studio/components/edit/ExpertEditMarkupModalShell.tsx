/**
 * Presentational shell for the expanded Expert Edit markup modal.
 * Keeps modal layout composition separate from ExpertEditPanelView orchestration logic.
 */
import React from "react";
import { useGuardedBackdropDismiss } from "../../../../components/useGuardedBackdropDismiss";
import { AiStudioModalLayer, useAiStudioModalActivity } from "../modal-layer/AiStudioModalLayer";

const assignRef = <T,>(ref: React.Ref<T | null> | undefined, value: T | null) => {
  if (!ref) return;
  if (typeof ref === "function") {
    ref(value);
    return;
  }
  (ref as React.MutableRefObject<T | null>).current = value;
};

const resolveFocusableElements = (root: HTMLElement): HTMLElement[] =>
  Array.from(
    root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter(
    (element) => !element.hasAttribute("hidden") && element.getAttribute("aria-hidden") !== "true"
  );

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
  useAiStudioModalActivity("expert-edit-markup-modal", isOpen);
  const backdropDismiss = useGuardedBackdropDismiss<HTMLDivElement>(onClose, {
    disabled: !isOpen,
  });
  const modalElementRef = React.useRef<HTMLDivElement | null>(null);
  const stageElementRef = React.useRef<HTMLDivElement | null>(null);
  const restoreFocusRef = React.useRef<HTMLElement | null>(null);
  const handleModalRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      modalElementRef.current = node;
      assignRef(modalRef, node);
    },
    [modalRef]
  );
  const handleStageRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      stageElementRef.current = node;
      assignRef(stageRef, node);
    },
    [stageRef]
  );

  React.useEffect(() => {
    if (isOpen) {
      restoreFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      queueMicrotask(() => {
        const focusTarget = stageElementRef.current ?? modalElementRef.current;
        focusTarget?.focus({ preventScroll: true });
      });
      return;
    }
    if (restoreFocusRef.current?.isConnected) {
      restoreFocusRef.current.focus({ preventScroll: true });
    }
    restoreFocusRef.current = null;
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AiStudioModalLayer>
      <div
        {...backdropDismiss}
        className="edit-expert-markup-modal-backdrop"
        role="presentation"
        onDragEnter={onDragShield}
        onDragOver={onDragShield}
        onDrop={onDragShield}
      >
        <div
          className="edit-expert-markup-modal"
          ref={handleModalRef}
          role="dialog"
          aria-modal="true"
          aria-label="Expanded markup canvas"
          tabIndex={-1}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key !== "Tab") return;
            const modalElement = modalElementRef.current;
            if (!modalElement) return;
            const focusableElements = resolveFocusableElements(modalElement);
            if (focusableElements.length <= 0) return;
            const activeElement =
              document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
            const currentIndex = activeElement ? focusableElements.indexOf(activeElement) : -1;
            const nextIndex = event.shiftKey
              ? currentIndex <= 0
                ? focusableElements.length - 1
                : currentIndex - 1
              : currentIndex < 0 || currentIndex >= focusableElements.length - 1
                ? 0
                : currentIndex + 1;
            event.preventDefault();
            focusableElements[nextIndex]?.focus({ preventScroll: true });
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerMove={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
          onPointerCancel={(event) => event.stopPropagation()}
          onPointerLeave={(event) => event.stopPropagation()}
          onWheel={(event) => event.stopPropagation()}
          onDragEnter={onDragShield}
          onDragOver={onDragShield}
          onDrop={onDragShield}
        >
          <div ref={controlsColumnRef} className="edit-expert-markup-modal-controls-column">
            <div className="edit-expert-markup-modal-panel-group">
              <p className="edit-expert-markup-modal-toolbar-title edit-expert-markup-modal-toolbar-title--general edit-expert-markup-modal-panel-title">
                General
              </p>
              <div
                className="edit-expert-markup-modal-controls-compact edit-expert-markup-modal-controls-compact--general"
                role="group"
                aria-label="General tools"
              >
                {generalPanel}
              </div>
            </div>
            <div className="edit-expert-markup-modal-panel-group">
              <p className="edit-expert-markup-modal-toolbar-title edit-expert-markup-modal-toolbar-title--move edit-expert-markup-modal-panel-title">
                Move
              </p>
              <div
                className="edit-expert-markup-modal-controls-compact edit-expert-markup-modal-controls-compact--move"
                role="group"
                aria-label="Move tools"
              >
                {movePanel}
              </div>
            </div>
            <div className="edit-expert-markup-modal-panel-group">
              <p className="edit-expert-markup-modal-toolbar-title edit-expert-markup-modal-toolbar-title--inpaint edit-expert-markup-modal-panel-title">
                In-paint
              </p>
              <div
                className="edit-expert-markup-modal-controls-compact edit-expert-markup-modal-controls-compact--inpaint"
                role="group"
                aria-label="In-paint tools"
              >
                {inpaintPanel}
              </div>
            </div>
            <div className="edit-expert-markup-modal-panel-group">
              <p className="edit-expert-markup-modal-toolbar-title edit-expert-markup-modal-toolbar-title--markup edit-expert-markup-modal-panel-title">
                Markup
              </p>
              <div
                className="edit-expert-markup-modal-controls-compact edit-expert-markup-modal-controls-compact--markup"
                role="group"
                aria-label="Markup tools"
              >
                {markupPanel}
              </div>
            </div>
          </div>
          <div
            className="edit-expert-markup-modal-stage"
            ref={handleStageRef}
            style={stageStyle}
            data-keyboard-pan-owner="true"
            tabIndex={0}
            onMouseDown={onStageMouseDown}
            onAuxClick={onStageAuxClick}
            onPointerDown={(event) => {
              event.currentTarget.focus({ preventScroll: true });
              onStagePointerDown(event);
            }}
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
    </AiStudioModalLayer>
  );
};
