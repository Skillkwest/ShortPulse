/**
 * Voices picker modal for the AI Studio voices workflow.
 * Hosts the selectable voice chip grid outside the main panel while preserving existing voice selection behavior.
 */
import React from "react";
import { X } from "phosphor-react";
import { useGuardedBackdropDismiss } from "../../../components/useGuardedBackdropDismiss";
import { AiStudioModalLayer, useAiStudioModalActivity } from "./modal-layer/AiStudioModalLayer";

type VoicesLibraryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

/**
 * Renders the modal shell for browsing and selecting available voices.
 */
export function VoicesLibraryModal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
}: VoicesLibraryModalProps) {
  useAiStudioModalActivity("voices-library-modal", isOpen);
  const backdropDismiss = useGuardedBackdropDismiss<HTMLDivElement>(onClose, {
    disabled: !isOpen,
  });

  if (!isOpen) {
    return null;
  }

  return (
    <AiStudioModalLayer>
      <div className="voices-library-modal-backdrop" {...backdropDismiss}>
        <div
          className="voices-library-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="voices-library-modal-title"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="voices-library-modal-header">
            <div className="voices-library-modal-title-group">
              <h2 id="voices-library-modal-title" className="voices-library-modal-title">
                {title}
              </h2>
              <p className="voices-library-modal-subtitle">{subtitle}</p>
            </div>
            <button
              type="button"
              className="voices-properties-create-panel-close"
              aria-label="Close voices modal"
              onClick={onClose}
            >
              <X size={15} weight="bold" aria-hidden="true" />
            </button>
          </div>
          <div className="voices-library-modal-scroll">
            <div className="voices-library-modal-body">{children}</div>
          </div>
        </div>
      </div>
    </AiStudioModalLayer>
  );
}
