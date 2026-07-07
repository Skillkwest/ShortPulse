/**
 * Pulse-specific read-only profile modal for built-in guided workflows.
 * Presents workflow metadata as product-facing guidance instead of internal contract fields.
 */
import React from "react";
import { useGuardedBackdropDismiss } from "../../../components/useGuardedBackdropDismiss";
import {
  type CreatePulseArtifactTarget,
  type CreatePulseResolvedPreset,
} from "./create/createPulsePresets";
import { AiStudioModalLayer, useAiStudioModalActivity } from "./modal-layer/AiStudioModalLayer";

type PulsePresetProfileModalProps = {
  preset: CreatePulseResolvedPreset;
  onClose: () => void;
};

const formatArtifactTarget = (artifactTarget: CreatePulseArtifactTarget | undefined): string => {
  switch (artifactTarget) {
    case "image_prompt":
      return "Image prompt";
    case "video_prompt":
      return "Video prompt";
    case "storyboard":
      return "Storyboard";
    case "text_artifact":
    default:
      return "Chat reply";
  }
};

export function PulsePresetProfileModal({ preset, onClose }: PulsePresetProfileModalProps) {
  const backdropDismiss = useGuardedBackdropDismiss<HTMLDivElement>(onClose);
  useAiStudioModalActivity("pulse-preset-profile-modal", true);

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
          <header className="pulse-presets-library-profile-header">
            <p className="eyebrow pulse-presets-library-profile-eyebrow">
              Built-in guided workflow
            </p>
            <h3 className="pulse-presets-library-edit-title">{preset.label}</h3>
            {preset.description ? (
              <p className="pulse-presets-library-profile-copy">{preset.description}</p>
            ) : null}
            <p className="pulse-presets-library-profile-note">
              Inspecting here does not activate this Pulse.
            </p>
          </header>

          <div className="pulse-presets-library-profile-sections">
            <section className="pulse-presets-library-profile-section">
              <h4>Starts with</h4>
              <p>
                {preset.starterAssistantMessage ||
                  "A guided first step that asks for the context this workflow needs."}
              </p>
            </section>
            {preset.workflowStageHints?.length ? (
              <section className="pulse-presets-library-profile-section">
                <h4>Workflow</h4>
                <ol className="pulse-presets-library-profile-stage-list">
                  {preset.workflowStageHints.map((stage) => (
                    <li key={stage}>{stage}</li>
                  ))}
                </ol>
              </section>
            ) : null}
            <section className="pulse-presets-library-profile-section">
              <h4>Produces</h4>
              <p>{formatArtifactTarget(preset.artifactTarget)}</p>
            </section>
          </div>

          <div className="pulse-presets-library-edit-actions">
            <button
              type="button"
              className="ghost-btn pulse-presets-library-edit-action-btn"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </AiStudioModalLayer>
  );
}
