/**
 * Shared confirmation modal for profile account actions.
 * Keeps destructive and session-level confirms visually consistent across the route.
 */
import type { ReactNode } from "react";
import { ConfirmationModal } from "../../../components/ConfirmationModal";

type ProfileConfirmModalProps = {
  title: string;
  children: ReactNode;
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
  confirmLabel,
  onCancel,
  onConfirm,
}: ProfileConfirmModalProps) {
  return (
    <ConfirmationModal
      title={title}
      body={children}
      confirmLabel={confirmLabel}
      tone="primary"
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
