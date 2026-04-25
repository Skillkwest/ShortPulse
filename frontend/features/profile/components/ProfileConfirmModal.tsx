/**
 * Shared confirmation modal for profile account actions.
 * Keeps destructive and session-level confirms visually consistent across the route.
 */
import type { ReactNode } from "react";

type ProfileConfirmModalProps = {
  title: string;
  children: ReactNode;
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
};

/**
 * Renders a simple blocking confirmation dialog for profile actions.
 */
export function ProfileConfirmModal({
  title,
  children,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
}: ProfileConfirmModalProps) {
  return (
    <div className="modal-overlay">
      <div className="modal-card profile-modal-card">
        <h3>{title}</h3>
        {children}
        <div className="modal-actions">
          <button type="button" className="ghost-btn" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="primary-btn" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
