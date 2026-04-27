/**
 * Shared confirmation modal primitive.
 * Standardizes the shell, typography, and action variants for app-wide confirm flows.
 */
import type { ReactNode } from "react";
import { useId } from "react";

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
  titleId,
  ariaLabel,
}: ConfirmationModalProps) {
  const fallbackTitleId = useId();
  const resolvedTitleId = titleId ?? fallbackTitleId;
  const confirmText = confirmDisabled && confirmBusyLabel ? confirmBusyLabel : confirmLabel;

  return (
    <div
      className="confirm-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabel ? undefined : resolvedTitleId}
      aria-label={ariaLabel}
      onClick={() => {
        if (!cancelDisabled) {
          onCancel();
        }
      }}
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
