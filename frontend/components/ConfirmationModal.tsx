/**
 * Shared confirmation modal primitive.
 * Standardizes the shell, typography, and action variants for app-wide confirm flows.
 */
import type { ReactNode } from "react";
import { useEffect, useId } from "react";
import { useGuardedBackdropDismiss } from "./useGuardedBackdropDismiss";

type ConfirmationModalTone = "danger" | "primary";

type ConfirmationModalProps = {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  tone?: ConfirmationModalTone;
  confirmDisabled?: boolean;
  cancelDisabled?: boolean;
  confirmBusyLabel?: string;
  closeOnEscape?: boolean;
  titleId?: string;
  ariaLabel?: string;
};

/**
 * Renders the shared blocking confirmation dialog.
 * Inputs: title/body copy, tone, handlers, and optional busy/disabled state.
 * Output: confirmation modal markup with consistent shell and actions.
 * Side effects: invokes supplied handlers on cancel/confirm interactions.
 */
export function ConfirmationModal({
  title,
  body,
  confirmLabel,
  onCancel,
  onConfirm,
  tone = "danger",
  confirmDisabled = false,
  cancelDisabled = false,
  confirmBusyLabel,
  closeOnEscape = true,
  titleId,
  ariaLabel,
}: ConfirmationModalProps) {
  const fallbackTitleId = useId();
  const resolvedTitleId = titleId ?? fallbackTitleId;
  const confirmText = confirmDisabled && confirmBusyLabel ? confirmBusyLabel : confirmLabel;
  const backdropDismiss = useGuardedBackdropDismiss<HTMLDivElement>(
    () => {
      if (!cancelDisabled) {
        onCancel();
      }
    },
    { disabled: cancelDisabled }
  );

  useEffect(() => {
    if (!closeOnEscape || cancelDisabled || typeof document === "undefined") return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      onCancel();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [cancelDisabled, closeOnEscape, onCancel]);

  return (
    <div
      {...backdropDismiss}
      className="confirm-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabel ? undefined : resolvedTitleId}
      aria-label={ariaLabel}
    >
      <div
        className={`confirm-modal confirm-modal--${tone}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="confirm-modal__copy">
          <h3 id={resolvedTitleId} className="confirm-modal__title">
            {title}
          </h3>
          <div className="confirm-modal__body">{body}</div>
        </div>
        <div className="confirm-modal__actions">
          <button
            type="button"
            className="confirm-modal__button confirm-modal__button--cancel"
            onClick={onCancel}
            disabled={cancelDisabled}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`confirm-modal__button confirm-modal__button--${tone}`}
            onClick={onConfirm}
            disabled={confirmDisabled}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
