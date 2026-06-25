/**
 * Primary Pulse Presets library panel for AI Studio.
 * Renders the per-user merged Pulse catalog, including custom presets and user-hidden built-ins.
 */
import React from "react";
import Image from "next/image";
import { TrashSimple } from "phosphor-react";
import {
  createCreatePulseCustomPresetId,
  createCreatePulseCustomSavedPreset,
  isCreatePulseBuiltInPresetId,
  resolveCreatePulsePresetCatalog,
  type CreatePulseBuiltInPresetDefinition,
  upsertCreatePulseSavedPreset,
  type CreatePulsePresetId,
  type CreatePulseSavedPreset,
} from "./create/createPulsePresets";
import { AppMessage } from "../../../components/AppMessage";
import { ConfirmationModal } from "../../../components/ConfirmationModal";
import { useGuardedBackdropDismiss } from "../../../components/useGuardedBackdropDismiss";
import { AiStudioModalLayer, useAiStudioModalActivity } from "./modal-layer/AiStudioModalLayer";

type PulsePresetsLibraryPanelProps = {
  builtInDefinitions?: readonly CreatePulseBuiltInPresetDefinition[];
  savedPresets?: readonly CreatePulseSavedPreset[];
  searchQuery?: string;
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
  isBuiltIn: boolean;
  description: string | null;
  systemInstructions: string;
  schemaVersion: number;
};

export function PulsePresetsLibraryPanel({
  builtInDefinitions,
  savedPresets = [],
  searchQuery = "",
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
    () => resolveCreatePulsePresetCatalog(savedPresets, builtInDefinitions),
    [builtInDefinitions, savedPresets]
  );
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const visibleResolvedPresets = React.useMemo(() => {
    if (!normalizedSearchQuery) return resolvedPresets;
    return resolvedPresets.filter((preset) =>
      [preset.label, preset.description ?? "", preset.systemInstructions].some((value) =>
        value.toLowerCase().includes(normalizedSearchQuery)
      )
    );
  }, [normalizedSearchQuery, resolvedPresets]);
  const nextPresetNumber = React.useMemo(
    () =>
      savedPresets.filter(
        (preset) => !isCreatePulseBuiltInPresetId(preset.presetId, builtInDefinitions)
      ).length + 1,
    [builtInDefinitions, savedPresets]
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
          createCreatePulseCustomSavedPreset({
            presetId: pendingPresetEdit.presetId,
            label: nextLabel,
            systemInstructions: nextSystemInstructions,
            createdAt: new Date().toISOString(),
          }),
        ]);
      } else {
        const existingPreset = savedPresets.find(
          (preset) => preset.presetId === pendingPresetEdit.presetId
        );
        saved = await onSavedPresetsChange(
          upsertCreatePulseSavedPreset(
            savedPresets,
            createCreatePulseCustomSavedPreset({
              presetId: pendingPresetEdit.presetId,
              label: nextLabel,
              systemInstructions: nextSystemInstructions,
              createdAt: existingPreset ? existingPreset.createdAt : new Date().toISOString(),
            }),
            builtInDefinitions
          )
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
  }, [builtInDefinitions, editSubmitting, onSavedPresetsChange, pendingPresetEdit, savedPresets]);

  const handleDeletePreset = React.useCallback(async () => {
    if (!pendingPresetDelete || deleteSubmitting || !onSavedPresetsChange) return;
    setDeleteSubmitting(true);
    setLocalSaveError(null);
    try {
      const deleted = await onSavedPresetsChange(
        pendingPresetDelete.isBuiltIn
          ? upsertCreatePulseSavedPreset(
              savedPresets,
              {
                presetId: pendingPresetDelete.presetId,
                label: pendingPresetDelete.presetLabel,
                description: pendingPresetDelete.description,
                systemInstructions: pendingPresetDelete.systemInstructions,
                createdAt: null,
                schemaVersion: pendingPresetDelete.schemaVersion,
                isHidden: true,
              },
              builtInDefinitions
            )
          : savedPresets.filter((preset) => preset.presetId !== pendingPresetDelete.presetId)
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
  }, [
    builtInDefinitions,
    deleteSubmitting,
    onSavedPresetsChange,
    pendingPresetDelete,
    savedPresets,
    selectedPresetId,
  ]);

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
  const editBackdropDismiss = useGuardedBackdropDismiss<HTMLDivElement>(closeEditModal);

  return (
    <section className="pulse-presets-library-panel" aria-label="Pulse Library">
      <header className="pulse-presets-library-header">
        <p className="eyebrow">Pulse Library</p>
        <p className="tiny subdued helper-text">
          Manage your Pulse catalog here. Custom and built-in Pulses share the same grid. Deleting a
          built-in removes it from your personal Pulse surfaces only.
        </p>
      </header>
      <div className="pulse-presets-library-scroll">
        <section aria-label="Pulse presets">
          <div
            className="pulse-presets-library-grid"
            role="list"
            aria-label="Pulse presets library tiles"
          >
            {visibleResolvedPresets.map((preset) => {
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
                      if (!preset.isEditable) {
                        setPendingPresetEdit(null);
                        return;
                      }
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
                      {preset.isBuiltIn ? (
                        <span
                          className="pulse-presets-library-custom-pill is-built-in"
                          title="Built-in Pulse. It can't be edited, but you can still delete it from your library."
                          role="img"
                          aria-label="Built-in Pulse"
                        >
                          <Image
                            className="pulse-presets-library-built-in-favicon"
                            src="/Fav.png"
                            alt=""
                            width={16}
                            height={16}
                            aria-hidden="true"
                          />
                        </span>
                      ) : preset.isCustom ? (
                        <span className="pulse-presets-library-custom-pill is-custom">Custom</span>
                      ) : null}
                    </span>
                    <span className="pulse-presets-library-tile-prompt">
                      {preset.description?.trim() || ""}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="pulse-presets-library-tile-delete"
                    aria-label={`Delete pulse preset: ${preset.label}`}
                    onClick={() => {
                      setLocalSaveError(null);
                      setPendingPresetDelete({
                        presetId: preset.presetId,
                        presetLabel: preset.label,
                        isBuiltIn: preset.isBuiltIn,
                        description: preset.description ?? null,
                        systemInstructions: preset.systemInstructions,
                        schemaVersion: preset.schemaVersion,
                      });
                    }}
                  >
                    <TrashSimple size={11} weight="bold" aria-hidden="true" />
                  </button>
                </article>
              );
            })}
            {visibleResolvedPresets.length === 0 && normalizedSearchQuery ? (
              <p className="pulse-presets-library-empty-state">No Pulses match this search.</p>
            ) : null}
            {!normalizedSearchQuery ? (
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
                  Add a saved-instructions Pulse that will be available from the Create Pulse rail
                  and Pulse Catalog.
                </span>
              </button>
            ) : null}
          </div>
        </section>
      </div>
      {pendingPresetEdit ? (
        <AiStudioModalLayer>
          <div className="pulse-presets-library-edit-modal-backdrop" {...editBackdropDismiss}>
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
              <p className="tiny subdued helper-text">
                A custom Pulse is just saved system instructions. If you want it to produce a
                reusable prompt or artifact, say that directly in the instructions.
              </p>
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
                <AppMessage
                  className="tiny pulse-presets-library-edit-error"
                  tone="error"
                  mode="inline"
                  message={localSaveError}
                />
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
                  <strong>{pendingPresetDelete.presetLabel}</strong>{" "}
                  {pendingPresetDelete.isBuiltIn
                    ? "will be removed from your personal Pulse library."
                    : "will be removed permanently."}
                </p>
                {pendingPresetDelete.isBuiltIn ? (
                  <p>This does not delete the shared built-in for other users.</p>
                ) : null}
                {localSaveError ? (
                  <AppMessage
                    className="tiny pulse-presets-library-edit-error"
                    tone="error"
                    mode="inline"
                    message={localSaveError}
                  />
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
