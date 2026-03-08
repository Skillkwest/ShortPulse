/**
 * Primary Presets library panel for AI Studio.
 * Renders the full preset catalog in the left properties rail with browse-only selection.
 */
import React from "react";
import type { ExpertEditPresetId, ExpertEditResolvedPreset } from "./edit/expertEditPresets";

export type PresetsLibraryPanelProps = {
  presets: readonly ExpertEditResolvedPreset[];
  selectedPresetId: ExpertEditPresetId | null;
  onSelectPreset?: (presetId: ExpertEditPresetId | null) => void;
};

export function PresetsLibraryPanel({
  presets,
  selectedPresetId,
  onSelectPreset,
}: PresetsLibraryPanelProps) {
  return (
    <section className="presets-library-panel" aria-label="Presets library">
      <header className="presets-library-header">
        <p className="eyebrow">Presets Library</p>
        <p className="tiny subdued helper-text">
          Browse all loaded presets. Customization tools are coming in a later phase.
        </p>
      </header>
      <div className="presets-library-scroll">
        <div className="presets-library-grid" role="list" aria-label="Presets library tiles">
          {presets.map((preset) => {
            const isSelected = selectedPresetId === preset.presetId;
            return (
              <button
                key={preset.presetId}
                type="button"
                className={`presets-library-tile ${isSelected ? "is-selected" : ""} ${
                  preset.isCustom ? "is-custom" : ""
                }`.trim()}
                aria-pressed={isSelected}
                aria-label={`Preset tile: ${preset.label}`}
                onClick={() => onSelectPreset?.(isSelected ? null : preset.presetId)}
              >
                <span className="presets-library-tile-head">
                  <span className="presets-library-tile-title">{preset.label}</span>
                  {preset.isCustom ? (
                    <span className="presets-library-custom-pill" aria-hidden="true">
                      Custom
                    </span>
                  ) : null}
                </span>
                <span className="presets-library-tile-prompt">{preset.prompt}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
