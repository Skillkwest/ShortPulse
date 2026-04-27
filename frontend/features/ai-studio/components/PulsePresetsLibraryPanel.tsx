/**
 * Primary Pulse Presets library panel for AI Studio.
 * Edits the same persisted Pulse catalog and built-in overrides consumed by the Create Pulse rail.
 */
import React from "react";
import { TrashSimple } from "phosphor-react";
import {
  CREATE_PULSE_AUTHORING_TEMPLATE_DEFINITIONS,
  CREATE_PULSE_CUSTOM_AUTHORING_ACTIVATION_MODE,
  CREATE_PULSE_CUSTOM_AUTHORING_OUTPUT_MODE,
  CREATE_PULSE_CUSTOM_AUTHORING_RUNTIME_MODE,
  composeCreatePulseWorkflowInstructions,
  createCreatePulseWorkflowBuilderDraft,
  createCreatePulseCustomPresetId,
  isCreatePulseBuiltInPresetId,
  resolveCreatePulsePresetCatalog,
  upsertCreatePulseSavedPreset,
  type CreatePulsePresetId,
  type CreatePulseRuntimeMode,
  type CreatePulseSavedPreset,
  type CreatePulseWorkflowBuilderDraft,
} from "./create/createPulsePresets";
import { ConfirmationModal } from "../../../components/ConfirmationModal";
import { AiStudioModalLayer, useAiStudioModalActivity } from "./modal-layer/AiStudioModalLayer";

type PulsePresetsLibraryPanelProps = {
  savedPresets?: readonly CreatePulseSavedPreset[];
  onSavedPresetsChange?: (presets: CreatePulseSavedPreset[]) => void;
};

type PendingPulsePresetEditState = {
  presetId: CreatePulsePresetId;
  presetLabel: string;
  label: string;
  description: string;
  systemInstructions: string;
  runtimeMode: CreatePulseRuntimeMode;
  starterAssistantMessage: string;
  workflowStageHintsText: string;
  workflowBuilderDraft: CreatePulseWorkflowBuilderDraft;
  showAdvancedSettings: boolean;
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

  const applyWorkflowTemplate = React.useCallback((templateId: string) => {
    const template = CREATE_PULSE_AUTHORING_TEMPLATE_DEFINITIONS.find(
      (entry) => entry.templateId === templateId
    );
    if (!template) return;
    setPendingPresetEdit((previous) =>
      previous
        ? {
            ...previous,
            runtimeMode: template.runtimeMode,
            systemInstructions: template.systemInstructions,
            starterAssistantMessage: template.starterAssistantMessage,
            workflowStageHintsText:
              previous.workflowStageHintsText.trim().length > 0
                ? previous.workflowStageHintsText
                : (template.workflowStageHints ?? []).join("\n"),
            description:
              previous.description.trim().length > 0 ? previous.description : template.description,
            workflowBuilderDraft:
              previous.workflowBuilderDraft.roleGoal.trim().length > 0
                ? previous.workflowBuilderDraft
                : createCreatePulseWorkflowBuilderDraft(template.description),
            showAdvancedSettings: true,
          }
        : previous
    );
    setLocalSaveError(null);
  }, []);

  const isWorkflowPreset = pendingPresetEdit?.runtimeMode === "workflow_gpt";

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
    const nextWorkflowStageHints = pendingPresetEdit.workflowStageHintsText
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    if (!nextLabel || !nextSystemInstructions) {
      setLocalSaveError("Preset name and system instructions are required.");
      return;
    }
    setEditSubmitting(true);
    setLocalSaveError(null);
    try {
      if (pendingPresetEdit.mode === "create") {
        onSavedPresetsChange([
          ...savedPresets,
          {
            presetId: pendingPresetEdit.presetId,
            label: nextLabel,
            description: pendingPresetEdit.description.trim() || null,
            systemInstructions: nextSystemInstructions,
            runtimeMode: CREATE_PULSE_CUSTOM_AUTHORING_RUNTIME_MODE,
            activationMode: CREATE_PULSE_CUSTOM_AUTHORING_ACTIVATION_MODE,
            starterAssistantMessage: pendingPresetEdit.starterAssistantMessage.trim() || null,
            workflowStageHints: nextWorkflowStageHints.length > 0 ? nextWorkflowStageHints : null,
            outputMode: CREATE_PULSE_CUSTOM_AUTHORING_OUTPUT_MODE,
            memoryPolicy: "session",
            createdAt: new Date().toISOString(),
          },
        ]);
      } else {
        const existingPreset = savedPresets.find(
          (preset) => preset.presetId === pendingPresetEdit.presetId
        );
        onSavedPresetsChange(
          upsertCreatePulseSavedPreset(savedPresets, {
            presetId: pendingPresetEdit.presetId,
            label: nextLabel,
            description: pendingPresetEdit.description.trim() || null,
            systemInstructions: nextSystemInstructions,
            runtimeMode: CREATE_PULSE_CUSTOM_AUTHORING_RUNTIME_MODE,
            activationMode: CREATE_PULSE_CUSTOM_AUTHORING_ACTIVATION_MODE,
            starterAssistantMessage: pendingPresetEdit.starterAssistantMessage.trim() || null,
            workflowStageHints: nextWorkflowStageHints.length > 0 ? nextWorkflowStageHints : null,
            outputMode: CREATE_PULSE_CUSTOM_AUTHORING_OUTPUT_MODE,
            memoryPolicy: "session",
            createdAt: existingPreset ? existingPreset.createdAt : new Date().toISOString(),
          })
        );
      }
      setSelectedPresetId(pendingPresetEdit.presetId);
      setPendingPresetEdit(null);
    } finally {
      setEditSubmitting(false);
    }
  }, [editSubmitting, onSavedPresetsChange, pendingPresetEdit, savedPresets]);

  const handleDeletePreset = React.useCallback(async () => {
    if (!pendingPresetDelete || deleteSubmitting || !onSavedPresetsChange) return;
    setDeleteSubmitting(true);
    setLocalSaveError(null);
    try {
      onSavedPresetsChange(
        savedPresets.filter((preset) => preset.presetId !== pendingPresetDelete.presetId)
      );
      if (selectedPresetId === pendingPresetDelete.presetId) {
        setSelectedPresetId(null);
      }
      setPendingPresetDelete(null);
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
                      description: preset.description ?? "",
                      systemInstructions: preset.systemInstructions,
                      runtimeMode: preset.runtimeMode,
                      starterAssistantMessage: preset.starterAssistantMessage ?? "",
                      workflowStageHintsText: (preset.workflowStageHints ?? []).join("\n"),
                      workflowBuilderDraft: createCreatePulseWorkflowBuilderDraft(
                        preset.description ?? preset.label
                      ),
                      showAdvancedSettings: false,
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
            aria-label="Create new pulse preset"
            onClick={() => {
              const nextPresetId = createCreatePulseCustomPresetId();
              const defaultLabel = `Pulse ${nextPresetNumber}`;
              setSelectedPresetId(nextPresetId);
              setLocalSaveError(null);
              setPendingPresetEdit({
                presetId: nextPresetId,
                presetLabel: defaultLabel,
                label: defaultLabel,
                description: "",
                systemInstructions: "",
                runtimeMode: CREATE_PULSE_CUSTOM_AUTHORING_RUNTIME_MODE,
                starterAssistantMessage: "",
                workflowStageHintsText: "",
                workflowBuilderDraft: createCreatePulseWorkflowBuilderDraft(
                  `Workflow Pulse ${nextPresetNumber}`
                ),
                showAdvancedSettings: false,
                mode: "create",
              });
            }}
          >
            <span className="pulse-presets-library-create-plus" aria-hidden="true">
              +
            </span>
            <span className="pulse-presets-library-tile-head">
              <span className="pulse-presets-library-tile-title">Create New Preset</span>
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
                {pendingPresetEdit.mode === "create" ? "Create New Preset" : "Edit Preset"}
              </h3>
              <p className="tiny subdued pulse-presets-library-edit-copy">
                {pendingPresetEdit.mode === "create"
                  ? "Name the Pulse and write the hidden system instructions that should drive it. Activate it later from the Create Pulse rail or More Pulses."
                  : "Update the Pulse catalog entry here. Activation still happens from the Create Pulse rail or More Pulses, and switching starts a fresh guided session."}
              </p>
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
              <button
                type="button"
                className="ghost-btn pulse-presets-library-edit-action-btn"
                aria-expanded={pendingPresetEdit.showAdvancedSettings}
                onClick={() => {
                  setPendingPresetEdit((previous) =>
                    previous
                      ? {
                          ...previous,
                          showAdvancedSettings: !previous.showAdvancedSettings,
                        }
                      : previous
                  );
                }}
              >
                {pendingPresetEdit.showAdvancedSettings
                  ? "Hide advanced settings"
                  : "Show advanced settings"}
              </button>
              {pendingPresetEdit.showAdvancedSettings ? (
                <div className="pulse-presets-library-workflow-builder">
                  <label
                    className="pulse-presets-library-edit-label"
                    htmlFor="pulse-preset-library-description-input"
                  >
                    Description
                  </label>
                  <input
                    id="pulse-preset-library-description-input"
                    className="pulse-presets-library-edit-input"
                    type="text"
                    value={pendingPresetEdit.description}
                    maxLength={140}
                    onChange={(event) => {
                      setPendingPresetEdit((previous) =>
                        previous
                          ? {
                              ...previous,
                              description: event.target.value,
                            }
                          : previous
                      );
                      if (localSaveError) setLocalSaveError(null);
                    }}
                  />
                  <p className="tiny subdued helper-text pulse-presets-library-edit-copy">
                    Pulses run as guided GPT-style chat profiles. Use the fields below to shape the
                    first reply, step flow, and final artifact.
                  </p>
                  <div
                    className="pulse-presets-library-template-actions"
                    aria-label="Workflow templates"
                  >
                    {CREATE_PULSE_AUTHORING_TEMPLATE_DEFINITIONS.map((template) => (
                      <button
                        key={template.templateId}
                        type="button"
                        className="ghost-btn pulse-presets-library-edit-action-btn"
                        onClick={() => applyWorkflowTemplate(template.templateId)}
                      >
                        {template.label}
                      </button>
                    ))}
                  </div>
                  <p className="tiny subdued helper-text pulse-presets-library-edit-copy">
                    Templates preload a starter contract. Every Pulse still starts immediately when
                    clicked in Create.
                  </p>
                  {isWorkflowPreset ? (
                    <div
                      className="pulse-presets-library-workflow-checklist"
                      aria-label="Workflow authoring checklist"
                    >
                      <p className="tiny subdued pulse-presets-library-edit-copy">
                        Workflow checklist: define the exact first assistant message, ask one step
                        at a time, and describe the final output shape explicitly.
                      </p>
                    </div>
                  ) : null}
                  {isWorkflowPreset && pendingPresetEdit ? (
                    <>
                      <label
                        className="pulse-presets-library-edit-label"
                        htmlFor="pulse-preset-library-workflow-role-goal-input"
                      >
                        Role & Goal
                      </label>
                      <textarea
                        id="pulse-preset-library-workflow-role-goal-input"
                        className="pulse-presets-library-edit-textarea pulse-presets-library-edit-textarea--compact"
                        value={pendingPresetEdit.workflowBuilderDraft.roleGoal}
                        rows={3}
                        placeholder="What is this workflow Pulse responsible for producing?"
                        onChange={(event) => {
                          setPendingPresetEdit((previous) =>
                            previous
                              ? {
                                  ...previous,
                                  workflowBuilderDraft: {
                                    ...previous.workflowBuilderDraft,
                                    roleGoal: event.target.value,
                                  },
                                }
                              : previous
                          );
                          if (localSaveError) setLocalSaveError(null);
                        }}
                      />
                      <label
                        className="pulse-presets-library-edit-label"
                        htmlFor="pulse-preset-library-workflow-step-flow-input"
                      >
                        Step Flow
                      </label>
                      <textarea
                        id="pulse-preset-library-workflow-step-flow-input"
                        className="pulse-presets-library-edit-textarea pulse-presets-library-edit-textarea--compact"
                        value={pendingPresetEdit.workflowBuilderDraft.stepFlow}
                        rows={4}
                        placeholder="List the exact step-by-step questions or phases the workflow should follow."
                        onChange={(event) => {
                          setPendingPresetEdit((previous) =>
                            previous
                              ? {
                                  ...previous,
                                  workflowBuilderDraft: {
                                    ...previous.workflowBuilderDraft,
                                    stepFlow: event.target.value,
                                  },
                                }
                              : previous
                          );
                          if (localSaveError) setLocalSaveError(null);
                        }}
                      />
                      <label
                        className="pulse-presets-library-edit-label"
                        htmlFor="pulse-preset-library-workflow-output-shape-input"
                      >
                        Final Output Shape
                      </label>
                      <textarea
                        id="pulse-preset-library-workflow-output-shape-input"
                        className="pulse-presets-library-edit-textarea pulse-presets-library-edit-textarea--compact"
                        value={pendingPresetEdit.workflowBuilderDraft.outputShape}
                        rows={3}
                        placeholder="Describe the exact final artifact format the Pulse should return."
                        onChange={(event) => {
                          setPendingPresetEdit((previous) =>
                            previous
                              ? {
                                  ...previous,
                                  workflowBuilderDraft: {
                                    ...previous.workflowBuilderDraft,
                                    outputShape: event.target.value,
                                  },
                                }
                              : previous
                          );
                          if (localSaveError) setLocalSaveError(null);
                        }}
                      />
                      <label
                        className="pulse-presets-library-edit-label"
                        htmlFor="pulse-preset-library-workflow-guardrails-input"
                      >
                        Additional Rules
                      </label>
                      <textarea
                        id="pulse-preset-library-workflow-guardrails-input"
                        className="pulse-presets-library-edit-textarea pulse-presets-library-edit-textarea--compact"
                        value={pendingPresetEdit.workflowBuilderDraft.guardrails}
                        rows={4}
                        placeholder="Add any continuity, safety, or formatting rules that should always apply."
                        onChange={(event) => {
                          setPendingPresetEdit((previous) =>
                            previous
                              ? {
                                  ...previous,
                                  workflowBuilderDraft: {
                                    ...previous.workflowBuilderDraft,
                                    guardrails: event.target.value,
                                  },
                                }
                              : previous
                          );
                          if (localSaveError) setLocalSaveError(null);
                        }}
                      />
                      <div className="pulse-presets-library-edit-actions">
                        <button
                          type="button"
                          className="ghost-btn pulse-presets-library-edit-action-btn"
                          onClick={() => {
                            setPendingPresetEdit((previous) =>
                              previous
                                ? {
                                    ...previous,
                                    systemInstructions: composeCreatePulseWorkflowInstructions(
                                      previous.workflowBuilderDraft
                                    ),
                                  }
                                : previous
                            );
                            if (localSaveError) setLocalSaveError(null);
                          }}
                        >
                          Compose Workflow Instructions
                        </button>
                      </div>
                    </>
                  ) : null}
                  <label
                    className="pulse-presets-library-edit-label"
                    htmlFor="pulse-preset-library-starter-message-input"
                  >
                    Starter Assistant Message
                  </label>
                  <textarea
                    id="pulse-preset-library-starter-message-input"
                    className="pulse-presets-library-edit-textarea"
                    value={pendingPresetEdit.starterAssistantMessage}
                    rows={3}
                    placeholder="Optional. Use this when the first assistant reply should start with a specific message."
                    onChange={(event) => {
                      setPendingPresetEdit((previous) =>
                        previous
                          ? {
                              ...previous,
                              starterAssistantMessage: event.target.value,
                            }
                          : previous
                      );
                      if (localSaveError) setLocalSaveError(null);
                    }}
                  />
                  <p className="tiny subdued helper-text pulse-presets-library-edit-copy">
                    Optional. Pulse clicks always start immediately. Use this only when the first
                    assistant reply should begin with a specific message.
                  </p>
                  {isWorkflowPreset ? (
                    <>
                      <label
                        className="pulse-presets-library-edit-label"
                        htmlFor="pulse-preset-library-stage-hints-input"
                      >
                        Workflow Stage Labels
                      </label>
                      <textarea
                        id="pulse-preset-library-stage-hints-input"
                        className="pulse-presets-library-edit-textarea pulse-presets-library-edit-textarea--compact"
                        value={pendingPresetEdit.workflowStageHintsText}
                        rows={4}
                        placeholder={
                          "Image Gate\nCamera Motion\nAction Selection\nDialogue\nFinal Output"
                        }
                        onChange={(event) => {
                          setPendingPresetEdit((previous) =>
                            previous
                              ? {
                                  ...previous,
                                  workflowStageHintsText: event.target.value,
                                }
                              : previous
                          );
                          if (localSaveError) setLocalSaveError(null);
                        }}
                      />
                      <p className="tiny subdued helper-text pulse-presets-library-edit-copy">
                        Optional. One stage label per line. Used by the Create chat banner when
                        workflow replies do not include explicit Step N formatting.
                      </p>
                    </>
                  ) : null}
                </div>
              ) : null}
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
              <p>
                <strong>{pendingPresetDelete.presetLabel}</strong> will be removed permanently.
              </p>
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
