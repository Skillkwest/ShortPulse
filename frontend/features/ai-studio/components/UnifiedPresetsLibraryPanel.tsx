/**
 * Unified Presets library shell for AI Studio.
 * Combines Pulse and Prompt Preset libraries behind one left-rail surface while keeping their editors separate.
 */
import React from "react";
import { Selection, Sparkle } from "phosphor-react";
import { PresetsLibraryPanel as PromptPresetsLibraryPanel } from "./PresetsLibraryPanel";
import { PulsePresetsLibraryPanel } from "./PulsePresetsLibraryPanel";
import {
  CreatePulsePreferenceProvider,
  useCreatePulsePreferenceRuntime,
} from "./create/CreatePulsePreferenceProvider";
import type {
  ExpertEditPresetId,
  ExpertEditPresetOverride,
  ExpertEditResolvedPreset,
} from "./edit/expertEditPresets";

type PresetsLibraryViewFilter = "all" | "pulses" | "prompt-presets";

export type UnifiedPresetsLibraryPanelProps = {
  promptPresets: readonly ExpertEditResolvedPreset[];
  selectedPromptPresetId: ExpertEditPresetId | null;
  onOpenCreateWorkflow?: () => void;
  onOpenEditWorkflow?: () => void;
  onSelectPromptPreset?: (presetId: ExpertEditPresetId | null) => void;
  onSavePromptPresetOverride?: (
    presetId: ExpertEditPresetId,
    override: ExpertEditPresetOverride
  ) => Promise<boolean> | boolean;
  promptSaveError?: string | null;
};

const FILTER_OPTIONS: ReadonlyArray<{
  id: PresetsLibraryViewFilter;
  label: string;
}> = [
  { id: "all", label: "All" },
  { id: "pulses", label: "Pulses" },
  { id: "prompt-presets", label: "Prompt Presets" },
];

/**
 * Renders the combined Presets library with internal sections for Pulses and Prompt Presets.
 */
export function UnifiedPresetsLibraryPanel({
  promptPresets,
  selectedPromptPresetId,
  onOpenCreateWorkflow,
  onOpenEditWorkflow,
  onSelectPromptPreset,
  onSavePromptPresetOverride,
  promptSaveError = null,
}: UnifiedPresetsLibraryPanelProps) {
  const [viewFilter, setViewFilter] = React.useState<PresetsLibraryViewFilter>("all");
  const showPulses = viewFilter === "all" || viewFilter === "pulses";
  const showPromptPresets = viewFilter === "all" || viewFilter === "prompt-presets";

  return (
    <section className="merged-presets-library-panel" aria-label="Presets library">
      <header className="merged-presets-library-header">
        <p className="eyebrow">Presets Library</p>
      </header>
      <div className="merged-presets-library-filter-row" role="group" aria-label="Presets views">
        {FILTER_OPTIONS.map((option) => {
          const isActive = viewFilter === option.id;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={isActive}
              className={`merged-presets-library-filter-chip ${isActive ? "is-active" : ""}`.trim()}
              onClick={() => setViewFilter(option.id)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <div className="merged-presets-library-body">
        {showPulses ? (
          <section
            className="merged-presets-library-section merged-presets-library-section--pulses"
            aria-labelledby="presets-pulses-title"
          >
            <div className="merged-presets-library-section-header">
              <div>
                <button
                  type="button"
                  className="toolbar-item merged-presets-library-section-action"
                  data-tool-id="create"
                  onClick={onOpenCreateWorkflow}
                >
                  <Sparkle size={18} weight="regular" aria-hidden="true" />
                  <span className="toolbar-copy">
                    <span className="toolbar-label">Create</span>
                  </span>
                </button>
                <h3 id="presets-pulses-title" className="merged-presets-library-section-title">
                  Pulses
                </h3>
              </div>
            </div>
            <div className="merged-presets-library-section-body">
              <CreatePulsePreferenceProvider>
                <UnifiedPulsePresetsLibraryPanel />
              </CreatePulsePreferenceProvider>
            </div>
          </section>
        ) : null}
        {showPromptPresets ? (
          <section
            className="merged-presets-library-section merged-presets-library-section--prompt-presets"
            aria-labelledby="presets-prompt-presets-title"
          >
            <div className="merged-presets-library-section-header">
              <div>
                <button
                  type="button"
                  className="toolbar-item merged-presets-library-section-action"
                  data-tool-id="edit"
                  onClick={onOpenEditWorkflow}
                >
                  <Selection size={18} weight="regular" aria-hidden="true" />
                  <span className="toolbar-copy">
                    <span className="toolbar-label">Edit</span>
                  </span>
                </button>
                <h3
                  id="presets-prompt-presets-title"
                  className="merged-presets-library-section-title"
                >
                  Edit Mode Presets
                </h3>
              </div>
            </div>
            <div className="merged-presets-library-section-body">
              <PromptPresetsLibraryPanel
                presets={promptPresets}
                selectedPresetId={selectedPromptPresetId}
                onSelectPreset={onSelectPromptPreset}
                onSavePresetOverride={onSavePromptPresetOverride}
                saveError={promptSaveError}
              />
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );
}

const UnifiedPulsePresetsLibraryPanel = () => {
  const { savedPresets, setSavedPresets } = useCreatePulsePreferenceRuntime();
  return (
    <PulsePresetsLibraryPanel savedPresets={savedPresets} onSavedPresetsChange={setSavedPresets} />
  );
};
