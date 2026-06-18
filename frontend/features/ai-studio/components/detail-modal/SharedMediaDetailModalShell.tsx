import React from "react";
import { useGuardedBackdropDismiss } from "../../../../components/useGuardedBackdropDismiss";
import { AiStudioModalLayer, useAiStudioModalActivity } from "../modal-layer/AiStudioModalLayer";

type SharedMediaDetailModalShellProps = {
  isOpen: boolean;
  modalActivityId: string;
  onClose: () => void;
  ariaLabel: string;
  backdropClassName: string;
  dialogClassName: string;
  dialogStyle?: React.CSSProperties;
  backdropDataTestId?: string;
  closeOnEscape?: boolean;
  ariaModal?: boolean;
  dialogAriaHidden?: boolean;
  backdropDecoration?: React.ReactNode;
  children: React.ReactNode;
};

/**
 * Shared shell for AI Studio media detail dialogs.
 * Centralizes modal layer activity, backdrop dismissal, and dialog semantics.
 */
export function SharedMediaDetailModalShell({
  isOpen,
  modalActivityId,
  onClose,
  ariaLabel,
  backdropClassName,
  dialogClassName,
  dialogStyle,
  backdropDataTestId,
  closeOnEscape = false,
  ariaModal = true,
  dialogAriaHidden = false,
  backdropDecoration = null,
  children,
}: SharedMediaDetailModalShellProps) {
  useAiStudioModalActivity(modalActivityId, isOpen);
  const backdropDismiss = useGuardedBackdropDismiss<HTMLDivElement>(onClose, {
    disabled: !isOpen,
  });

  React.useEffect(() => {
    if (!isOpen || !closeOnEscape || typeof document === "undefined") return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeOnEscape, isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <AiStudioModalLayer>
      <div
        {...backdropDismiss}
        className={backdropClassName}
        role="presentation"
        data-testid={backdropDataTestId}
      >
        {backdropDecoration}
        <div
          className={dialogClassName}
          role="dialog"
          aria-modal={ariaModal ? "true" : undefined}
          aria-hidden={dialogAriaHidden ? "true" : undefined}
          aria-label={ariaLabel}
          style={dialogStyle}
          onClick={(event) => event.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </AiStudioModalLayer>
  );
}
