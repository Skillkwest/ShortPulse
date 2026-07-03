/**
 * Shared read-only detail modal for AI Studio library presets.
 * Keeps inspect-only catalog views out of the activation and editing paths.
 */
import React from "react";
import { useGuardedBackdropDismiss } from "../../../components/useGuardedBackdropDismiss";
import { AiStudioModalLayer, useAiStudioModalActivity } from "./modal-layer/AiStudioModalLayer";

export type PresetLibraryDetailField = {
  label: string;
  value: React.ReactNode;
  preserveWhitespace?: boolean;
};

export type PresetLibraryDetailModalProps = {
  title: string;
  eyebrow?: string;
  description?: React.ReactNode;
  fields: readonly PresetLibraryDetailField[];
  actions?: React.ReactNode;
  onClose: () => void;
};

/**
 * Renders an inspect-only preset detail modal with optional non-activating actions.
 */
export function PresetLibraryDetailModal({
  title,
  eyebrow,
  description,
  fields,
  actions,
  onClose,
}: PresetLibraryDetailModalProps) {
  const backdropDismiss = useGuardedBackdropDismiss<HTMLDivElement>(onClose);
  useAiStudioModalActivity("preset-library-detail-modal", true);

  React.useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  return (
    <AiStudioModalLayer>
      <div className="preset-library-detail-modal-backdrop" {...backdropDismiss}>
        <div
          className="preset-library-detail-modal"
          role="dialog"
          aria-modal="true"
          aria-label={`${title} details`}
          onClick={(event) => event.stopPropagation()}
        >
          <header className="preset-library-detail-header">
            {eyebrow ? <p className="eyebrow preset-library-detail-eyebrow">{eyebrow}</p> : null}
            <h3 className="preset-library-detail-title">{title}</h3>
            {description ? (
              <p className="preset-library-detail-description">{description}</p>
            ) : null}
          </header>
          <dl className="preset-library-detail-list">
            {fields.map((field) => (
              <div className="preset-library-detail-row" key={field.label}>
                <dt>{field.label}</dt>
                <dd className={field.preserveWhitespace ? "preserve-whitespace" : undefined}>
                  {field.value}
                </dd>
              </div>
            ))}
          </dl>
          <div className="preset-library-detail-actions">
            <button
              type="button"
              className="ghost-btn preset-library-detail-action-btn"
              onClick={onClose}
            >
              Close
            </button>
            {actions}
          </div>
        </div>
      </div>
    </AiStudioModalLayer>
  );
}
