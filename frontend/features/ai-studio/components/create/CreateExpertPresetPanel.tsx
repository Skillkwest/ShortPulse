import React from "react";
import { GearSix, Sliders } from "phosphor-react";

const CREATE_EXPERT_DEFAULT_PRESET_LABELS = [
  "Image",
  "Single-shot",
  "Multi-shot",
  "Story Builder",
] as const;

export function CreateExpertPresetPanel() {
  return (
    <section className="create-expert-presets-panel" aria-label="Create prompt presets">
      <div className="create-expert-presets-card">
        <div className="create-expert-presets-title-card">
          <p className="create-expert-presets-title">Pulse Presets</p>
          <span className="create-expert-presets-title-icon" aria-hidden="true">
            <Sliders size={14} weight="regular" />
          </span>
        </div>
        <div className="create-expert-presets-list" aria-label="Selected prompt presets">
          <div className="create-expert-presets-dropzone">
            {CREATE_EXPERT_DEFAULT_PRESET_LABELS.map((presetLabel) => (
              <button
                key={presetLabel}
                type="button"
                className="create-expert-presets-btn create-expert-presets-btn--selected"
                aria-label={`${presetLabel} preset`}
              >
                {presetLabel}
              </button>
            ))}
          </div>
          <div className="create-expert-presets-divider" aria-hidden="true" />
          <button
            type="button"
            className="create-expert-presets-btn create-expert-presets-btn--more"
            aria-label="More presets"
          >
            <span className="create-expert-presets-btn-icon" aria-hidden="true">
              <GearSix size={12} weight="regular" />
            </span>
            More presets
          </button>
        </div>
      </div>
    </section>
  );
}
