/**
 * Primary Pulse Presets library panel for AI Studio.
 * Edits the same persisted Pulse catalog and built-in overrides consumed by the Create Pulse rail.
 */
import React from "react";
import { TrashSimple } from "phosphor-react";
import {
  CREATE_PULSE_CUSTOM_AUTHORING_ACTIVATION_MODE,
  CREATE_PULSE_CUSTOM_AUTHORING_OUTPUT_MODE,
  CREATE_PULSE_CUSTOM_AUTHORING_RUNTIME_MODE,
  createCreatePulseCustomPresetId,
  isCreatePulseBuiltInPresetId,
  resolveCreatePulsePresetCatalog,
  upsertCreatePulseSavedPreset,
  type CreatePulsePresetId,
  type CreatePulseSavedPreset,
} from "./create/createPulsePresets";
import { ConfirmationModal } from "../../../components/ConfirmationModal";
import { AiStudioModalLayer, useAiStudioModalActivity } from "./modal-layer/AiStudioModalLayer";

type PulsePresetsLibraryPanelProps = {
  savedPresets?: readonly CreatePulseSavedPreset[];
  onSavedPresetsChange?: (presets: CreatePulseSavedPreset[]) => Promise<boolean> | boolean | void;
};

type PendingPulsePresetEditState = {
  presetId: CreatePulsePresetId;
  presetLabel: string;
  label: string;
  systemInstructions: string;
  mode: "create" | "edit";
};

type PendingPulsePresetDeleteState = {
  presetId: CreatePulsePresetId;
  presetLabel: string;
};

export function PulsePresetsLibraryPanel({
  savedPresets = [],
  onSavedPresetsChange,
}: PulsePresetsLibraryPanelProps) {
  const [selectedPresetId, setSelectedPresetId] = React.useState<string | null>(null);
  const [pendingPresetEdit, setPendingPresetEdit] =
    React.useState<PendingPulsePresetEditState | null>(null);
  const [pendingPresetDelete, setPendingPresetDelete] =
    React.useState<PendingPulsePresetDeleteState | null>(null);
  const [editSubmitting, setEditSubmitting] = React.useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = React.useState(false);
  const [localSaveError, setLocalSaveError] = React.useState<string | null>(null);

  const resolvedPresets = React.useMemo(
    () => resolveCreatePulsePresetCatalog(savedPresets),
    [savedPresets]
  );
  const nextPresetNumber = React.useMemo(
    () =>
      savedPresets.filter((preset) => !isCreatePulseBuiltInPresetId(preset.presetId)).length + 1,
    [savedPresets]
  );

  const closeEditModal = React.useCallback(() => {
    if (editSubmitting) return;
    setPendingPresetEdit(null);
    setLocalSaveError(null);
  }, [editSubmitting]);

  const closeDeleteModal = React.useCallback(() => {
    if (deleteSubmitting) return;
    setPendingPresetDelete(null);
    setLocalSaveError(null);
  }, [deleteSubmitting]);

  const handleSavePreset = React.useCallback(async () => {
    if (!pendingPresetEdit || editSubmitting || !onSavedPresetsChange) return;
    const nextLabel = pendingPresetEdit.label.trim();
    const nextSystemInstructions = pendingPresetEdit.systemInstructions.trim();
    if (!nextLabel || !nextSystemInstructions) {
      setLocalSaveError("Preset name and system instructions are required.");
      return;
    }
    setEditSubmitting(true);
    setLocalSaveError(null);
    try {
      let saved: boolean | void;
      if (pendingPresetEdit.mode === "create") {
        saved = await onSavedPresetsChange([
          ...savedPresets,
          {
            presetId: pendingPresetEdit.presetId,
            label: nextLabel,
            description: null,
            systemInstructions: nextSystemInstructions,
            runtimeMode: CREATE_PULSE_CUSTOM_AUTHORING_RUNTIME_MODE,
            activationMode: CREATE_PULSE_CUSTOM_AUTHORING_ACTIVATION_MODE,
            starterAssistantMessage: null,
            workflowStageHints: null,
            outputMode: CREATE_PULSE_CUSTOM_AUTHORING_OUTPUT_MODE,
            memoryPolicy: "session",
            createdAt: new Date().toISOString(),
          },
        ]);
      } else {
        const existingPreset = savedPresets.find(
          (preset) => preset.presetId === pendingPresetEdit.presetId
        );
        saved = await onSavedPresetsChange(
          upsertCreatePulseSavedPreset(savedPresets, {
            presetId: pendingPresetEdit.presetId,
            label: nextLabel,
            description: null,
            systemInstructions: nextSystemInstructions,
            runtimeMode: CREATE_PULSE_CUSTOM_AUTHORING_RUNTIME_MODE,
            activationMode: CREATE_PULSE_CUSTOM_AUTHORING_ACTIVATION_MODE,
            starterAssistantMessage: null,
            workflowStageHints: null,
            outputMode: CREATE_PULSE_CUSTOM_AUTHORING_OUTPUT_MODE,
            memoryPolicy: "session",
            createdAt: existingPreset ? existingPreset.createdAt : new Date().toISOString(),
          })
        );
      }
      if (saved === false) {
        setLocalSaveError("Unable to save this Pulse right now.");
        return;
      }
      setSelectedPresetId(pendingPresetEdit.presetId);
      setPendingPresetEdit(null);
    } catch {
      setLocalSaveError("Unable to save this Pulse right now.");
    } finally {
      setEditSubmitting(false);
    }
  }, [editSubmitting, onSavedPresetsChange, pendingPresetEdit, savedPresets]);

  const handleDeletePreset = React.useCallback(async () => {
    if (!pendingPresetDelete || deleteSubmitting || !onSavedPresetsChange) return;
    setDeleteSubmitting(true);
    setLocalSaveError(null);
    try {
      const deleted = await onSavedPresetsChange(
        savedPresets.filter((preset) => preset.presetId !== pendingPresetDelete.presetId)
      );
      if (deleted === false) {
        setLocalSaveError("Unable to delete this Pulse right now.");
        return;
      }
      if (selectedPresetId === pendingPresetDelete.presetId) {
        setSelectedPresetId(null);
      }
      setPendingPresetDelete(null);
    } catch {
      setLocalSaveError("Unable to delete this Pulse right now.");
    } finally {
      setDeleteSubmitting(false);
    }
  }, [deleteSubmitting, onSavedPresetsChange, pendingPresetDelete, savedPresets, selectedPresetId]);

  React.useEffect(() => {
    const hasModalOpen = Boolean(pendingPresetEdit || pendingPresetDelete);
    if (!hasModalOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (pendingPresetEdit) {
        closeEditModal();
        return;
      }
      closeDeleteModal();
    };
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [closeDeleteModal, closeEditModal, pendingPresetDelete, pendingPresetEdit]);

  useAiStudioModalActivity(
    "pulse-presets-library-modal",
    Boolean(pendingPresetEdit || pendingPresetDelete)
  );

  return (
    <section className="pulse-presets-library-panel" aria-label="Pulse presets library">
      <header className="pulse-presets-library-header">
        <p className="eyebrow">Pulses</p>
        <p className="tiny subdued helper-text">
          Manage the shared Pulse catalog here. Activate Pulses from the Create Pulse rail or More
          Pulses. Switching or deactivating a Pulse starts a fresh guided session.
        </p>
      </header>
      <div className="pulse-presets-library-scroll">
        <div
          className="pulse-presets-library-grid"
          role="list"
          aria-label="Pulse presets library tiles"
        >
          {resolvedPresets.map((preset) => {
            const isSelected = selectedPresetId === preset.presetId;
            return (
              <article
                key={preset.presetId}
                className={`pulse-presets-library-tile ${isSelected ? "is-selected" : ""}`.trim()}
                role="listitem"
              >
                <button
                  type="button"
                  className="pulse-presets-library-tile-select"
                  aria-pressed={isSelected}
                  aria-label={`Inspect pulse preset tile: ${preset.label}`}
                  onClick={() => {
                    setSelectedPresetId(preset.presetId);
                    setLocalSaveError(null);
                    setPendingPresetEdit({
                      presetId: preset.presetId,
                      presetLabel: preset.label,
                      label: preset.label,
                      systemInstructions: preset.systemInstructions,
                      mode: "edit",
                    });
                  }}
                >
                  <span className="pulse-presets-library-tile-head">
                    <span className="pulse-presets-library-tile-title">{preset.label}</span>
                    {preset.isCustom ? (
                      <span className="pulse-presets-library-custom-pill is-custom">Custom</span>
                    ) : null}
                  </span>
                  <span className="pulse-presets-library-tile-prompt">
                    {preset.description?.trim() || preset.systemInstructions}
                  </span>
                </button>
                {preset.isCustom ? (
                  <button
                    type="button"
                    className="pulse-presets-library-tile-delete"
                    aria-label={`Delete pulse preset: ${preset.label}`}
                    onClick={() => {
                      setLocalSaveError(null);
                      setPendingPresetDelete({
                        presetId: preset.presetId,
                        presetLabel: preset.label,
                      });
                    }}
                  >
                    <TrashSimple size={11} weight="bold" aria-hidden="true" />
                  </button>
                ) : null}
              </article>
            );
          })}
          <button
            type="button"
            className="pulse-presets-library-tile pulse-presets-library-create-tile"
            aria-label="Create new pulse"
            onClick={() => {
              const nextPresetId = createCreatePulseCustomPresetId();
              const defaultLabel = `Pulse ${nextPresetNumber}`;
              setSelectedPresetId(nextPresetId);
              setLocalSaveError(null);
              setPendingPresetEdit({
                presetId: nextPresetId,
                presetLabel: defaultLabel,
                label: defaultLabel,
                systemInstructions: "",
                mode: "create",
              });
            }}
          >
            <span className="pulse-presets-library-create-plus" aria-hidden="true">
              +
            </span>
            <span className="pulse-presets-library-tile-head">
              <span className="pulse-presets-library-tile-title">Create New Pulse</span>
            </span>
            <span className="pulse-presets-library-tile-prompt">
              Add a custom Pulse that will be available from the Create Pulse rail and More Pulses.
            </span>
          </button>
        </div>
      </div>
      {pendingPresetEdit ? (
        <AiStudioModalLayer>
          <div className="pulse-presets-library-edit-modal-backdrop" onClick={closeEditModal}>
            <div
              className="pulse-presets-library-edit-modal"
              role="dialog"
              aria-modal="true"
              aria-label={`${
                pendingPresetEdit.mode === "create" ? "Create" : "Edit"
              } ${pendingPresetEdit.presetLabel} pulse preset`}
              onClick={(event) => event.stopPropagation()}
            >
              <h3 className="pulse-presets-library-edit-title">
                {pendingPresetEdit.mode === "create" ? "Create New Pulse" : "Edit Preset"}
              </h3>
              <label
                className="pulse-presets-library-edit-label"
                htmlFor="pulse-preset-library-name-input"
              >
                Preset Name
              </label>
              <input
                id="pulse-preset-library-name-input"
                className="pulse-presets-library-edit-input"
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
              <label
                className="pulse-presets-library-edit-label"
                htmlFor="pulse-preset-library-prompt-input"
              >
                System Instructions
              </label>
              <textarea
                id="pulse-preset-library-prompt-input"
                className="pulse-presets-library-edit-textarea"
                value={pendingPresetEdit.systemInstructions}
                rows={10}
                placeholder="Describe how this Pulse should behave, what it should ask for, and what kind of output it should produce."
                onChange={(event) => {
                  setPendingPresetEdit((previous) =>
                    previous
                      ? {
                          ...previous,
                          systemInstructions: event.target.value,
                        }
                      : previous
                  );
                  if (localSaveError) setLocalSaveError(null);
                }}
              />
              {localSaveError ? (
                <p className="tiny pulse-presets-library-edit-error">{localSaveError}</p>
              ) : null}
              <div className="pulse-presets-library-edit-actions">
                <button
                  type="button"
                  className="ghost-btn pulse-presets-library-edit-action-btn"
                  onClick={closeEditModal}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="primary-btn pulse-presets-library-edit-action-btn"
                  onClick={() => {
                    void handleSavePreset();
                  }}
                  disabled={editSubmitting}
                >
                  {pendingPresetEdit.mode === "create" ? "Create" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </AiStudioModalLayer>
      ) : null}
      {pendingPresetDelete ? (
        <AiStudioModalLayer>
          <ConfirmationModal
            title="Delete this preset?"
            body={
              <>
                <p>
                  <strong>{pendingPresetDelete.presetLabel}</strong> will be removed permanently.
                </p>
                {localSaveError ? (
                  <p className="tiny pulse-presets-library-edit-error">{localSaveError}</p>
                ) : null}
              </>
            }
            confirmLabel="Delete"
            confirmBusyLabel={deleteSubmitting ? "Deleting..." : undefined}
            confirmDisabled={deleteSubmitting}
            cancelDisabled={deleteSubmitting}
            onCancel={closeDeleteModal}
            onConfirm={() => {
              void handleDeletePreset();
            }}
          />
        </AiStudioModalLayer>
      ) : null}
    </section>
  );
}
