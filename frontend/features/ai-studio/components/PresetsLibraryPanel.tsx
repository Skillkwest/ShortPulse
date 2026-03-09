/**
 * Primary Presets library panel for AI Studio.
 * Renders the full preset catalog and supports inline modal editing for preset name + prompt.
 */
import React from "react";
import {
  EDIT_PRESET_CUSTOM_PRESET_IDS,
  resolveExpertEditPresetLabelById,
  resolveExpertEditPresetPromptById,
  type ExpertEditCustomPresetId,
  type ExpertEditCustomPresetOverrides,
  type ExpertEditPresetId,
  type ExpertEditPresetOverride,
  type ExpertEditResolvedPreset,
} from "./edit/expertEditPresets";

export type PresetsLibraryPanelProps = {
  presets: readonly ExpertEditResolvedPreset[];
  selectedPresetId: ExpertEditPresetId | null;
  onSelectPreset?: (presetId: ExpertEditPresetId | null) => void;
  onSavePresetOverride?: (
    presetId: ExpertEditPresetId,
    override: ExpertEditPresetOverride
  ) => Promise<boolean> | boolean;
  saveError?: string | null;
};

type PendingPresetEditState = {
  presetId: ExpertEditPresetId;
  presetLabel: string;
  label: string;
  prompt: string;
  mode: "create" | "edit";
};

export function PresetsLibraryPanel({
  presets,
  selectedPresetId,
  onSelectPreset,
  onSavePresetOverride,
  saveError = null,
}: PresetsLibraryPanelProps) {
  const customPresetOverrides = React.useMemo(
    () =>
      presets.reduce<ExpertEditCustomPresetOverrides>((accumulator, preset) => {
        if (!preset.hasOverride) return accumulator;
        accumulator[preset.presetId] = {
          label: preset.label,
          prompt: preset.prompt,
        };
        return accumulator;
      }, {}),
    [presets]
  );
  const nextCreatableCustomPresetId = React.useMemo((): ExpertEditCustomPresetId | null => {
    const visiblePresetIdSet = new Set(presets.map((preset) => preset.presetId));
    return (
      EDIT_PRESET_CUSTOM_PRESET_IDS.find((presetId) => !visiblePresetIdSet.has(presetId)) ?? null
    );
  }, [presets]);
  const [pendingPresetEdit, setPendingPresetEdit] = React.useState<PendingPresetEditState | null>(
    null
  );
  const [editSubmitting, setEditSubmitting] = React.useState(false);
  const [localSaveError, setLocalSaveError] = React.useState<string | null>(null);

  const closeEditModal = React.useCallback(() => {
    if (editSubmitting) return;
    setPendingPresetEdit(null);
    setLocalSaveError(null);
  }, [editSubmitting]);

  const handleSavePreset = React.useCallback(async () => {
    if (!pendingPresetEdit || editSubmitting) return;
    const nextLabel = pendingPresetEdit.label.trim();
    const nextPrompt = pendingPresetEdit.prompt.trim();
    if (!nextLabel || !nextPrompt) {
      setLocalSaveError("Preset name and prompt are required.");
      return;
    }
    setEditSubmitting(true);
    setLocalSaveError(null);
    try {
      if (!onSavePresetOverride) {
        setLocalSaveError("Preset editing is unavailable right now.");
        return;
      }
      const saved = await onSavePresetOverride(pendingPresetEdit.presetId, {
        label: nextLabel,
        prompt: nextPrompt,
      });
      if (!saved) {
        setLocalSaveError("Unable to save this preset right now.");
        return;
      }
      setPendingPresetEdit(null);
    } catch {
      setLocalSaveError("Unable to save this preset right now.");
    } finally {
      setEditSubmitting(false);
    }
  }, [editSubmitting, onSavePresetOverride, pendingPresetEdit]);

  React.useEffect(() => {
    if (!pendingPresetEdit) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeEditModal();
    };
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [closeEditModal, pendingPresetEdit]);

  return (
    <section className="presets-library-panel" aria-label="Presets library">
      <header className="presets-library-header">
        <p className="eyebrow">Presets Library</p>
        <p className="tiny subdued helper-text">
          Click a preset card to rename it or edit the prompt text.
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
                aria-label={`Edit preset tile: ${preset.label}`}
                onClick={() => {
                  onSelectPreset?.(preset.presetId);
                  setLocalSaveError(null);
                  setPendingPresetEdit({
                    presetId: preset.presetId,
                    presetLabel: preset.label,
                    label: preset.label,
                    prompt: preset.prompt,
                    mode: "edit",
                  });
                }}
              >
                <span className="presets-library-tile-head">
                  <span className="presets-library-tile-title">{preset.label}</span>
                  {preset.isCustom && !preset.hasOverride ? (
                    <span className="presets-library-custom-pill" aria-hidden="true">
                      Custom
                    </span>
                  ) : null}
                </span>
                <span className="presets-library-tile-prompt">{preset.prompt}</span>
              </button>
            );
          })}
          {nextCreatableCustomPresetId ? (
            <button
              type="button"
              className="presets-library-tile presets-library-create-tile"
              aria-label="Create new preset"
              onClick={() => {
                onSelectPreset?.(nextCreatableCustomPresetId);
                setLocalSaveError(null);
                const defaultLabel = resolveExpertEditPresetLabelById(nextCreatableCustomPresetId);
                setPendingPresetEdit({
                  presetId: nextCreatableCustomPresetId,
                  presetLabel: defaultLabel,
                  label: defaultLabel,
                  prompt:
                    resolveExpertEditPresetPromptById(
                      nextCreatableCustomPresetId,
                      customPresetOverrides
                    ) ?? "",
                  mode: "create",
                });
              }}
            >
              <span className="presets-library-create-plus" aria-hidden="true">
                +
              </span>
              <span className="presets-library-tile-head">
                <span className="presets-library-tile-title">Create New Preset</span>
              </span>
              <span className="presets-library-tile-prompt">
                Add another custom preset to your library.
              </span>
            </button>
          ) : null}
        </div>
      </div>
      {pendingPresetEdit ? (
        <div className="presets-library-edit-modal-backdrop" onClick={closeEditModal}>
          <div
            className="presets-library-edit-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`${
              pendingPresetEdit.mode === "create" ? "Create" : "Edit"
            } ${pendingPresetEdit.presetLabel} preset`}
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="presets-library-edit-title">
              {pendingPresetEdit.mode === "create" ? "Create New Preset" : "Edit Preset"}
            </h3>
            <p className="tiny subdued presets-library-edit-copy">
              {pendingPresetEdit.mode === "create"
                ? "Set the preset name and prompt text."
                : "Update preset name and prompt text."}
            </p>
            <label className="presets-library-edit-label" htmlFor="preset-library-name-input">
              Preset Name
            </label>
            <input
              id="preset-library-name-input"
              className="presets-library-edit-input"
              type="text"
              value={pendingPresetEdit.label}
              maxLength={60}
              onChange={(event) => {
                setPendingPresetEdit((previous) =>
                  previous
                    ? {
                        ...previous,
                        label: event.target.value,
                      }
                    : previous
                );
                if (localSaveError) setLocalSaveError(null);
              }}
            />
            <label className="presets-library-edit-label" htmlFor="preset-library-prompt-input">
              Preset Prompt
            </label>
            <textarea
              id="preset-library-prompt-input"
              className="presets-library-edit-textarea"
              value={pendingPresetEdit.prompt}
              rows={7}
              onChange={(event) => {
                setPendingPresetEdit((previous) =>
                  previous
                    ? {
                        ...previous,
                        prompt: event.target.value,
                      }
                    : previous
                );
                if (localSaveError) setLocalSaveError(null);
              }}
            />
            {localSaveError || saveError ? (
              <p className="tiny presets-library-edit-error">{localSaveError || saveError}</p>
            ) : null}
            <div className="presets-library-edit-actions">
              <button
                type="button"
                className="ghost-btn presets-library-edit-action-btn"
                onClick={closeEditModal}
                disabled={editSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="presets-library-edit-action-btn is-primary"
                onClick={() => void handleSavePreset()}
                disabled={editSubmitting}
              >
                {editSubmitting
                  ? "Saving..."
                  : pendingPresetEdit.mode === "create"
                    ? "Create"
                    : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
