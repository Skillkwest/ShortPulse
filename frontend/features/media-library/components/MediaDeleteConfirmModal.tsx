/**
 * Generic delete-confirm modal for Media Library flows.
 * Renders destructive confirmation copy and delegates cancel/confirm actions to injected handlers.
 */
import type { ReactNode } from "react";

type MediaDeleteConfirmModalProps = {
  body: ReactNode;
  cancelDisabled: boolean;
  confirmDisabled: boolean;
  confirmLabel: string;
  confirmTitleId: string;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
};

/**
 * Renders a destructive confirmation modal with configurable copy/actions.
 * Inputs: title/body copy plus cancel/confirm handlers and disabled state.
 * Output: confirmation modal markup.
 * Side effects: none.
 */
export function MediaDeleteConfirmModal({
  body,
  cancelDisabled,
  confirmDisabled,
  confirmLabel,
  confirmTitleId,
  onCancel,
  onConfirm,
  title,
}: MediaDeleteConfirmModalProps) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby={confirmTitleId}>
      <div className="modal-card media-delete-confirm-card">
        <h3 id={confirmTitleId}>{title}</h3>
        <p className="subdued tiny media-delete-confirm-copy">{body}</p>
        <div className="modal-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={onCancel}
            disabled={cancelDisabled}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-danger"
            onClick={onConfirm}
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
