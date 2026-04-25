/**
 * Compact More Presets popup surface for the Create Pulse left rail.
 * Keeps preset editing and drag/drop contained within the Create Pulse preset domain.
 */
import React from "react";
import { PencilSimpleLine } from "phosphor-react";
import type {
  CreatePulseActivationMode,
  CreatePulsePresetId,
  CreatePulseResolvedPreset,
  CreatePulseRuntimeMode,
  CreatePulseWorkflowBuilderDraft,
} from "./createPulsePresets";
import {
  CREATE_PULSE_AUTHORING_TEMPLATE_DEFINITIONS,
  CREATE_PULSE_CUSTOM_AUTHORING_ACTIVATION_MODE,
  CREATE_PULSE_CUSTOM_AUTHORING_RUNTIME_MODE,
  composeCreatePulseWorkflowInstructions,
  createCreatePulseWorkflowBuilderDraft,
} from "./createPulsePresets";

export type CreatePulsePresetsSurfaceProps = {
  id: string;
  isOpen: boolean;
  presets: readonly CreatePulseResolvedPreset[];
  activePresetId?: CreatePulsePresetId | null;
  selectedPresetIds?: readonly CreatePulsePresetId[];
  onClose: () => void;
  onOpenPresetsLibrary?: () => void;
  onPresetSelect?: (presetId: CreatePulsePresetId) => void;
  onPresetDragStart?: (
    event: React.DragEvent<HTMLButtonElement>,
    presetId: CreatePulsePresetId
  ) => void;
  onPresetDragEnd?: () => void;
  onSurfaceDragOver?: (event: React.DragEvent<HTMLElement>) => void;
  onSurfaceDrop?: (event: React.DragEvent<HTMLElement>) => void;
  onSurfaceDragLeave?: (event: React.DragEvent<HTMLElement>) => void;
  onCustomPresetSave?: (
    presetId: CreatePulsePresetId,
    draft: {
      label: string;
      description: string;
      systemInstructions: string;
      runtimeMode: CreatePulseRuntimeMode;
      starterAssistantMessage: string;
      workflowStageHintsText: string;
    }
  ) => void;
  isDropActive?: boolean;
  isActivationBusy?: boolean;
};

type EditorDraft = {
  label: string;
  description: string;
  systemInstructions: string;
  runtimeMode: CreatePulseRuntimeMode;
  activationMode: CreatePulseActivationMode;
  starterAssistantMessage: string;
  workflowStageHintsText: string;
  workflowBuilderDraft: CreatePulseWorkflowBuilderDraft;
};

const EMPTY_EDITOR_DRAFT: EditorDraft = {
  label: "",
  description: "",
  systemInstructions: "",
  runtimeMode: CREATE_PULSE_CUSTOM_AUTHORING_RUNTIME_MODE,
  activationMode: CREATE_PULSE_CUSTOM_AUTHORING_ACTIVATION_MODE,
  starterAssistantMessage: "",
  workflowStageHintsText: "",
  workflowBuilderDraft: createCreatePulseWorkflowBuilderDraft(),
};

/**
 * Renders the contained More Presets surface used by the Create pulse rail.
 */
export const CreatePulsePresetsSurface = ({
  id,
  isOpen,
  presets,
  activePresetId = null,
  selectedPresetIds = [],
  onClose,
  onOpenPresetsLibrary,
  onPresetSelect,
  onPresetDragStart,
  onPresetDragEnd,
  onSurfaceDragOver,
  onSurfaceDrop,
  onSurfaceDragLeave,
  onCustomPresetSave,
  isDropActive = false,
  isActivationBusy = false,
}: CreatePulsePresetsSurfaceProps) => {
  const surfaceRef = React.useRef<HTMLElement | null>(null);
  const editorDialogRef = React.useRef<HTMLDivElement | null>(null);
  const editorNameInputRef = React.useRef<HTMLInputElement | null>(null);
  const [editingPresetId, setEditingPresetId] = React.useState<CreatePulsePresetId | null>(null);
  const [editorDraft, setEditorDraft] = React.useState<EditorDraft>(EMPTY_EDITOR_DRAFT);
  const [editorError, setEditorError] = React.useState<string | null>(null);
  const [showAdvancedSettings, setShowAdvancedSettings] = React.useState(false);
  const isWorkflowDraft = editorDraft.runtimeMode === "workflow_gpt";

  React.useEffect(() => {
    if (!isOpen) {
      setEditingPresetId(null);
      setEditorDraft(EMPTY_EDITOR_DRAFT);
      setEditorError(null);
      setShowAdvancedSettings(false);
      return;
    }
    surfaceRef.current?.focus();
  }, [isOpen]);

  React.useEffect(() => {
    if (!editingPresetId) return;
    editorNameInputRef.current?.focus();
  }, [editingPresetId]);

  const closeEditor = React.useCallback(() => {
    setEditingPresetId(null);
    setEditorDraft(EMPTY_EDITOR_DRAFT);
    setEditorError(null);
    setShowAdvancedSettings(false);
  }, []);

  const openEditor = React.useCallback((preset: CreatePulseResolvedPreset) => {
    if (!preset.isEditable) return;
    setEditingPresetId(preset.presetId);
    setEditorDraft({
      label: preset.label,
      description: preset.description ?? "",
      systemInstructions: preset.systemInstructions,
      runtimeMode: preset.runtimeMode,
      activationMode: preset.activationMode,
      starterAssistantMessage: preset.starterAssistantMessage ?? "",
      workflowStageHintsText: (preset.workflowStageHints ?? []).join("\n"),
      workflowBuilderDraft: createCreatePulseWorkflowBuilderDraft(
        preset.description ?? preset.label
      ),
    });
    setEditorError(null);
    setShowAdvancedSettings(false);
  }, []);

  const saveEditor = React.useCallback(() => {
    if (!editingPresetId) return;
    const nextLabel = editorDraft.label.trim();
    const nextSystemInstructions = editorDraft.systemInstructions.trim();
    if (!nextLabel || !nextSystemInstructions) {
      setEditorError("Name and system instructions are required.");
      return;
    }
    onCustomPresetSave?.(editingPresetId, {
      label: nextLabel,
      description: editorDraft.description.trim(),
      systemInstructions: nextSystemInstructions,
      runtimeMode: editorDraft.runtimeMode,
      starterAssistantMessage: editorDraft.starterAssistantMessage.trim(),
      workflowStageHintsText: editorDraft.workflowStageHintsText,
    });
    closeEditor();
  }, [closeEditor, editingPresetId, editorDraft, onCustomPresetSave]);

  const applyWorkflowTemplate = React.useCallback((templateId: string) => {
    const template = CREATE_PULSE_AUTHORING_TEMPLATE_DEFINITIONS.find(
      (entry) => entry.templateId === templateId
    );
    if (!template) return;
    setEditorDraft((previous) => ({
      ...previous,
      runtimeMode: template.runtimeMode,
      activationMode: template.activationMode,
      description:
        previous.description.trim().length > 0 ? previous.description : template.description,
      systemInstructions: template.systemInstructions,
      starterAssistantMessage: template.starterAssistantMessage,
      workflowStageHintsText:
        previous.workflowStageHintsText.trim().length > 0
          ? previous.workflowStageHintsText
          : (template.workflowStageHints ?? []).join("\n"),
      workflowBuilderDraft:
        previous.workflowBuilderDraft.roleGoal.trim().length > 0
          ? previous.workflowBuilderDraft
          : createCreatePulseWorkflowBuilderDraft(template.description),
    }));
    setEditorError(null);
  }, []);

  const shouldUseMutedCustomLabel = React.useCallback((preset: CreatePulseResolvedPreset) => {
    if (!preset.isCustom) return false;
    return /^custom\s+\d+$/i.test(preset.label.trim());
  }, []);

  const handleOpenPresetsLibrary = React.useCallback(() => {
    closeEditor();
    onClose();
    onOpenPresetsLibrary?.();
  }, [closeEditor, onClose, onOpenPresetsLibrary]);

  React.useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const targetNode = event.target as Node | null;
      if (!targetNode) return;
      if (surfaceRef.current?.contains(targetNode)) return;
      const targetElement = targetNode instanceof Element ? targetNode : null;
      const triggerElement = targetElement?.closest("[aria-controls]");
      if (triggerElement && triggerElement.getAttribute("aria-controls") === id) {
        return;
      }
      if (targetElement && targetElement.closest(".create-expert-presets-btn--selected")) {
        return;
      }
      onClose();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [id, isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <section
      id={id}
      ref={surfaceRef}
      className={`create-expert-presets-surface ${isDropActive ? "is-drop-active" : ""}`.trim()}
      role="region"
      aria-label="Pulses"
      tabIndex={-1}
      onClick={(event) => event.stopPropagation()}
      onPointerDownCapture={(event) => {
        if (!editingPresetId) return;
        const targetNode = event.target as Node | null;
        if (!targetNode) return;
        if (editorDialogRef.current?.contains(targetNode)) return;
        closeEditor();
      }}
      onDragOver={onSurfaceDragOver}
      onDrop={onSurfaceDrop}
      onDragLeave={onSurfaceDragLeave}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        if (editingPresetId) {
          closeEditor();
          return;
        }
        onClose();
      }}
    >
      <div className="create-expert-presets-surface-header">
        <div className="create-expert-presets-surface-title-group">
          <h3 className="create-expert-presets-surface-title">Pulses</h3>
          <p className="create-expert-presets-surface-subtitle">
            Click to activate and pin a Pulse. Drag to pin without switching. Switching or
            deactivating starts a fresh guided session.
          </p>
        </div>
        <div className="create-expert-presets-surface-actions">
          <button
            type="button"
            className="ghost-btn create-expert-presets-surface-library-btn"
            onClick={handleOpenPresetsLibrary}
          >
            Pulse Library
          </button>
          <button
            type="button"
            className="ghost-btn mini create-expert-presets-surface-close"
            aria-label="Close presets"
            onClick={onClose}
          >
            x
          </button>
        </div>
      </div>
      <div className="create-expert-presets-surface-scroll">
        <div
          className="create-expert-presets-chip-grid"
          role="list"
          aria-label="Available pulse presets"
        >
          {presets.map((preset) => (
            <div
              key={preset.presetId}
              role="listitem"
              className={`create-expert-presets-chip-item ${
                preset.isCustom ? "is-custom" : ""
              } ${activePresetId === preset.presetId ? "is-active" : ""} ${
                selectedPresetIds.includes(preset.presetId) ? "is-pinned" : ""
              }`.trim()}
            >
              <button
                type="button"
                draggable
                className={`create-expert-presets-chip ${
                  shouldUseMutedCustomLabel(preset) ? "is-custom-label" : ""
                }`.trim()}
                aria-pressed={activePresetId === preset.presetId}
                aria-disabled={isActivationBusy}
                onClick={() => {
                  if (isActivationBusy) return;
                  onPresetSelect?.(preset.presetId);
                }}
                onDragStart={(event) => onPresetDragStart?.(event, preset.presetId)}
                onDragEnd={onPresetDragEnd}
              >
                <span className="create-expert-presets-chip-label">{preset.label}</span>
                <span className="create-expert-presets-chip-meta" aria-hidden="true">
                  {!preset.isBuiltIn ? (
                    <span className="create-expert-presets-chip-badge create-expert-presets-chip-badge--ownership is-custom">
                      Custom
                    </span>
                  ) : null}
                  {activePresetId === preset.presetId ? (
                    <span className="create-expert-presets-chip-badge is-active">Active</span>
                  ) : null}
                  {selectedPresetIds.includes(preset.presetId) ? (
                    <span className="create-expert-presets-chip-badge">Pinned</span>
                  ) : null}
                </span>
              </button>
              {preset.isEditable ? (
                <button
                  type="button"
                  className="create-expert-presets-chip-edit"
                  aria-label={`Edit ${preset.label} preset`}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    openEditor(preset);
                  }}
                >
                  <PencilSimpleLine size={14} weight="regular" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>
      {editingPresetId ? (
        <div className="create-expert-presets-custom-editor-overlay" onClick={closeEditor}>
          <div
            ref={editorDialogRef}
            role="dialog"
            aria-modal="false"
            aria-label="Edit pulse preset"
            className="create-expert-presets-custom-editor"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="create-expert-presets-custom-editor-fields">
              <label
                className="create-expert-presets-custom-editor-label"
                htmlFor="create-pulse-preset-name-input"
              >
                Preset name
              </label>
              <input
                id="create-pulse-preset-name-input"
                ref={editorNameInputRef}
                type="text"
                className="create-expert-presets-custom-editor-input"
                value={editorDraft.label}
                maxLength={40}
                onChange={(event) => {
                  setEditorDraft((previous) => ({
                    ...previous,
                    label: event.target.value,
                  }));
                  if (editorError) {
                    setEditorError(null);
                  }
                }}
              />
              <label
                className="create-expert-presets-custom-editor-label"
                htmlFor="create-pulse-preset-prompt-input"
              >
                System instructions
              </label>
              <textarea
                id="create-pulse-preset-prompt-input"
                className="create-expert-presets-custom-editor-textarea"
                value={editorDraft.systemInstructions}
                rows={7}
                placeholder="Describe how this Pulse should behave, what it should ask for, and what kind of output it should produce."
                onChange={(event) => {
                  setEditorDraft((previous) => ({
                    ...previous,
                    systemInstructions: event.target.value,
                  }));
                  if (editorError) {
                    setEditorError(null);
                  }
                }}
              />
              <button
                type="button"
                className="create-expert-presets-custom-editor-btn"
                aria-expanded={showAdvancedSettings}
                onClick={() => setShowAdvancedSettings((previous) => !previous)}
              >
                {showAdvancedSettings ? "Hide advanced settings" : "Show advanced settings"}
              </button>
              {showAdvancedSettings ? (
                <div className="create-expert-presets-workflow-builder">
                  <label
                    className="create-expert-presets-custom-editor-label"
                    htmlFor="create-pulse-preset-description-input"
                  >
                    Description
                  </label>
                  <input
                    id="create-pulse-preset-description-input"
                    type="text"
                    className="create-expert-presets-custom-editor-input"
                    value={editorDraft.description}
                    maxLength={140}
                    onChange={(event) => {
                      setEditorDraft((previous) => ({
                        ...previous,
                        description: event.target.value,
                      }));
                      if (editorError) {
                        setEditorError(null);
                      }
                    }}
                  />
                  <p className="tiny subdued helper-text">
                    Pulses run as guided GPT-style chat profiles. Use the fields below to shape the
                    first reply, step flow, and final artifact.
                  </p>
                  <div className="create-expert-presets-custom-editor-actions">
                    {CREATE_PULSE_AUTHORING_TEMPLATE_DEFINITIONS.map((template) => (
                      <button
                        key={template.templateId}
                        type="button"
                        className="create-expert-presets-custom-editor-btn"
                        onClick={() => applyWorkflowTemplate(template.templateId)}
                      >
                        {template.label}
                      </button>
                    ))}
                  </div>
                  <p className="tiny subdued helper-text">
                    Templates preload a starter contract. Every Pulse still starts immediately when
                    clicked in Create.
                  </p>
                  {isWorkflowDraft ? (
                    <div
                      className="create-expert-presets-workflow-checklist"
                      aria-label="Workflow authoring checklist"
                    >
                      <p className="tiny subdued helper-text">
                        Workflow checklist: define the exact first assistant message, keep the step
                        flow one question at a time, and describe the final output shape explicitly.
                      </p>
                    </div>
                  ) : null}
                  {isWorkflowDraft ? (
                    <>
                      <label
                        className="create-expert-presets-custom-editor-label"
                        htmlFor="create-pulse-preset-workflow-role-goal-input"
                      >
                        Role & Goal
                      </label>
                      <textarea
                        id="create-pulse-preset-workflow-role-goal-input"
                        className="create-expert-presets-custom-editor-textarea create-expert-presets-custom-editor-textarea--compact"
                        value={editorDraft.workflowBuilderDraft.roleGoal}
                        rows={3}
                        placeholder="What is this workflow Pulse responsible for producing?"
                        onChange={(event) => {
                          setEditorDraft((previous) => ({
                            ...previous,
                            workflowBuilderDraft: {
                              ...previous.workflowBuilderDraft,
                              roleGoal: event.target.value,
                            },
                          }));
                          if (editorError) {
                            setEditorError(null);
                          }
                        }}
                      />
                      <label
                        className="create-expert-presets-custom-editor-label"
                        htmlFor="create-pulse-preset-workflow-step-flow-input"
                      >
                        Step Flow
                      </label>
                      <textarea
                        id="create-pulse-preset-workflow-step-flow-input"
                        className="create-expert-presets-custom-editor-textarea create-expert-presets-custom-editor-textarea--compact"
                        value={editorDraft.workflowBuilderDraft.stepFlow}
                        rows={4}
                        placeholder="List the exact step-by-step questions or phases the workflow should follow."
                        onChange={(event) => {
                          setEditorDraft((previous) => ({
                            ...previous,
                            workflowBuilderDraft: {
                              ...previous.workflowBuilderDraft,
                              stepFlow: event.target.value,
                            },
                          }));
                          if (editorError) {
                            setEditorError(null);
                          }
                        }}
                      />
                      <label
                        className="create-expert-presets-custom-editor-label"
                        htmlFor="create-pulse-preset-workflow-output-shape-input"
                      >
                        Final Output Shape
                      </label>
                      <textarea
                        id="create-pulse-preset-workflow-output-shape-input"
                        className="create-expert-presets-custom-editor-textarea create-expert-presets-custom-editor-textarea--compact"
                        value={editorDraft.workflowBuilderDraft.outputShape}
                        rows={3}
                        placeholder="Describe the exact final artifact format the Pulse should return."
                        onChange={(event) => {
                          setEditorDraft((previous) => ({
                            ...previous,
                            workflowBuilderDraft: {
                              ...previous.workflowBuilderDraft,
                              outputShape: event.target.value,
                            },
                          }));
                          if (editorError) {
                            setEditorError(null);
                          }
                        }}
                      />
                      <label
                        className="create-expert-presets-custom-editor-label"
                        htmlFor="create-pulse-preset-workflow-guardrails-input"
                      >
                        Additional Rules
                      </label>
                      <textarea
                        id="create-pulse-preset-workflow-guardrails-input"
                        className="create-expert-presets-custom-editor-textarea create-expert-presets-custom-editor-textarea--compact"
                        value={editorDraft.workflowBuilderDraft.guardrails}
                        rows={4}
                        placeholder="Add any continuity, safety, or formatting rules that should always apply."
                        onChange={(event) => {
                          setEditorDraft((previous) => ({
                            ...previous,
                            workflowBuilderDraft: {
                              ...previous.workflowBuilderDraft,
                              guardrails: event.target.value,
                            },
                          }));
                          if (editorError) {
                            setEditorError(null);
                          }
                        }}
                      />
                      <div className="create-expert-presets-custom-editor-actions">
                        <button
                          type="button"
                          className="create-expert-presets-custom-editor-btn"
                          onClick={() => {
                            setEditorDraft((previous) => ({
                              ...previous,
                              systemInstructions: composeCreatePulseWorkflowInstructions(
                                previous.workflowBuilderDraft
                              ),
                            }));
                            if (editorError) {
                              setEditorError(null);
                            }
                          }}
                        >
                          Compose Workflow Instructions
                        </button>
                      </div>
                    </>
                  ) : null}
                  <label
                    className="create-expert-presets-custom-editor-label"
                    htmlFor="create-pulse-preset-starter-message-input"
                  >
                    Starter assistant message
                  </label>
                  <textarea
                    id="create-pulse-preset-starter-message-input"
                    className="create-expert-presets-custom-editor-textarea"
                    value={editorDraft.starterAssistantMessage}
                    rows={3}
                    placeholder="Optional. Use this when the first assistant reply should start with a specific message."
                    onChange={(event) => {
                      setEditorDraft((previous) => ({
                        ...previous,
                        starterAssistantMessage: event.target.value,
                      }));
                      if (editorError) {
                        setEditorError(null);
                      }
                    }}
                  />
                  <p className="tiny subdued helper-text">
                    Optional. Pulse clicks always start immediately. Use this only when the first
                    assistant reply should begin with a specific message.
                  </p>
                  {isWorkflowDraft ? (
                    <>
                      <label
                        className="create-expert-presets-custom-editor-label"
                        htmlFor="create-pulse-preset-stage-hints-input"
                      >
                        Workflow Stage Labels
                      </label>
                      <textarea
                        id="create-pulse-preset-stage-hints-input"
                        className="create-expert-presets-custom-editor-textarea create-expert-presets-custom-editor-textarea--compact"
                        value={editorDraft.workflowStageHintsText}
                        rows={4}
                        placeholder={
                          "Image Gate\nCamera Motion\nAction Selection\nDialogue\nFinal Output"
                        }
                        onChange={(event) => {
                          setEditorDraft((previous) => ({
                            ...previous,
                            workflowStageHintsText: event.target.value,
                          }));
                          if (editorError) {
                            setEditorError(null);
                          }
                        }}
                      />
                      <p className="tiny subdued helper-text">
                        Optional. One stage label per line. Used by the Create chat banner when
                        workflow replies do not include explicit Step N formatting.
                      </p>
                    </>
                  ) : null}
                </div>
              ) : null}
              {editorError ? (
                <p className="create-expert-presets-custom-editor-error">{editorError}</p>
              ) : null}
            </div>
            <div className="create-expert-presets-custom-editor-actions">
              <button
                type="button"
                className="create-expert-presets-custom-editor-btn"
                onClick={closeEditor}
              >
                Cancel
              </button>
              <button
                type="button"
                className="create-expert-presets-custom-editor-btn is-primary"
                onClick={saveEditor}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};
