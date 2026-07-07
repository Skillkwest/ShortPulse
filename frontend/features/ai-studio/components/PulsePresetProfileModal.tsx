/**
 * Pulse-specific read-only profile modal for built-in guided workflows.
 * Shows the resolved built-in prompt without allowing in-place edits.
 */
import React from "react";
import { useGuardedBackdropDismiss } from "../../../components/useGuardedBackdropDismiss";
import { type CreatePulseResolvedPreset } from "./create/createPulsePresets";
import { AiStudioModalLayer, useAiStudioModalActivity } from "./modal-layer/AiStudioModalLayer";

type PulsePresetProfileModalProps = {
  preset: CreatePulseResolvedPreset;
  onClose: () => void;
};

export function PulsePresetProfileModal({ preset, onClose }: PulsePresetProfileModalProps) {
  const backdropDismiss = useGuardedBackdropDismiss<HTMLDivElement>(onClose);
  useAiStudioModalActivity("pulse-preset-profile-modal", true);
  const promptText = preset.systemInstructions.trim();

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
      <div className="pulse-presets-library-edit-modal-backdrop" {...backdropDismiss}>
        <div
          className="pulse-presets-library-edit-modal pulse-presets-library-profile-modal"
          role="dialog"
          aria-modal="true"
          aria-label={`${preset.label} details`}
          onClick={(event) => event.stopPropagation()}
        >
          <header>
            <h3 className="pulse-presets-library-edit-title">{preset.label}</h3>
          </header>
          <textarea
            className="pulse-presets-library-prompt-viewer"
            aria-label="Prompt"
            readOnly
            value={promptText}
            placeholder="No prompt is available for this built-in Pulse."
          />
        </div>
      </div>
    </AiStudioModalLayer>
  );
}
