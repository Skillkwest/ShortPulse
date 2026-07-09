/**
 * Shared read-only detail modal for AI Studio library presets.
 * Keeps inspect-only catalog views out of the activation and editing paths.
 */
import React from "react";
import { useGuardedBackdropDismiss } from "../../../components/useGuardedBackdropDismiss";
import { AiStudioModalLayer, useAiStudioModalActivity } from "./modal-layer/AiStudioModalLayer";

export type PresetLibraryDetailModalProps = {
  title: string;
  prompt: string;
  onClose: () => void;
};

/**
 * Renders an inspect-only prompt preset modal without activation or editing affordances.
 */
export function PresetLibraryDetailModal({
  title,
  prompt,
  onClose,
}: PresetLibraryDetailModalProps) {
  const backdropDismiss = useGuardedBackdropDismiss<HTMLDivElement>(onClose);
  useAiStudioModalActivity("preset-library-detail-modal", true);
  const promptText = prompt.trim();

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
            <h3 className="preset-library-detail-title">{title}</h3>
          </header>
          <textarea
            className="preset-library-detail-prompt-viewer"
            aria-label="Preset Prompt"
            readOnly
            value={promptText}
            placeholder="No prompt is available for this preset."
          />
        </div>
      </div>
    </AiStudioModalLayer>
  );
}
