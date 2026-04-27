/**
 * Generic delete-confirm modal for Media Library flows.
 * Renders destructive confirmation copy and delegates cancel/confirm actions to injected handlers.
 */
import type { ReactNode } from "react";
import { ConfirmationModal } from "../../../components/ConfirmationModal";

type MediaDeleteConfirmModalProps = {
  body: ReactNode;
  cancelDisabled: boolean;
  confirmDisabled: boolean;
  confirmBusyLabel?: string;
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
  confirmBusyLabel,
  confirmTitleId,
  onCancel,
  onConfirm,
  title,
}: MediaDeleteConfirmModalProps) {
  return (
    <ConfirmationModal
      title={title}
      titleId={confirmTitleId}
      body={body}
      confirmLabel="Delete"
      confirmBusyLabel={confirmBusyLabel}
      confirmDisabled={confirmDisabled}
      cancelDisabled={cancelDisabled}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
