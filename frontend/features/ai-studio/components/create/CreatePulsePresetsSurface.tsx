/**
 * Compact More Presets popup surface for the Create Pulse left rail.
 * Keeps preset editing and drag/drop contained within the Create Pulse preset domain.
 */
import React from "react";
import { PencilSimpleLine } from "phosphor-react";
import { useGuardedBackdropDismiss } from "../../../../components/useGuardedBackdropDismiss";
import { type CreatePulsePresetId, type CreatePulseResolvedPreset } from "./createPulsePresets";

export type CreatePulsePresetsSurfaceProps = {
  id: string;
  isOpen: boolean;
  presets: readonly CreatePulseResolvedPreset[];
  activePresetId?: CreatePulsePresetId | null;
  selectedPresetIds?: readonly CreatePulsePresetId[];
  onClose: () => void;
  onOpenPresetsLibrary?: () => void;
  onPresetSelect?: (presetId: CreatePulsePresetId) => Promise<void> | void;
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
      systemInstructions: string;
    }
  ) => Promise<boolean> | boolean | void;
  isDropActive?: boolean;
  isActivationBusy?: boolean;
};

type EditorDraft = {
  label: string;
  systemInstructions: string;
};

const EMPTY_EDITOR_DRAFT: EditorDraft = {
  label: "",
  systemInstructions: "",
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
  const [editorSubmitting, setEditorSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!isOpen) {
      setEditingPresetId(null);
      setEditorDraft(EMPTY_EDITOR_DRAFT);
      setEditorError(null);
      setEditorSubmitting(false);
      return;
    }
    surfaceRef.current?.focus();
  }, [isOpen]);

  React.useEffect(() => {
    if (!editingPresetId) return;
    editorNameInputRef.current?.focus();
  }, [editingPresetId]);

  const closeEditor = React.useCallback(() => {
    if (editorSubmitting) return;
    setEditingPresetId(null);
    setEditorDraft(EMPTY_EDITOR_DRAFT);
    setEditorError(null);
  }, [editorSubmitting]);
  const editorBackdropDismiss = useGuardedBackdropDismiss<HTMLDivElement>(closeEditor);

  const openEditor = React.useCallback((preset: CreatePulseResolvedPreset) => {
    if (!preset.isEditable) return;
    setEditingPresetId(preset.presetId);
    setEditorDraft({
      label: preset.label,
      systemInstructions: preset.systemInstructions,
    });
    setEditorError(null);
  }, []);

  const saveEditor = React.useCallback(async () => {
    if (!editingPresetId || editorSubmitting) return;
    const nextLabel = editorDraft.label.trim();
    const nextSystemInstructions = editorDraft.systemInstructions.trim();
    if (!nextLabel || !nextSystemInstructions) {
      setEditorError("Name and system instructions are required.");
      return;
    }
    setEditorSubmitting(true);
    setEditorError(null);
    try {
      const saved = await onCustomPresetSave?.(editingPresetId, {
        label: nextLabel,
        systemInstructions: nextSystemInstructions,
      });
      if (saved === false) {
        setEditorError("Unable to save this Pulse right now.");
        return;
      }
      setEditingPresetId(null);
      setEditorDraft(EMPTY_EDITOR_DRAFT);
      setEditorError(null);
    } catch {
      setEditorError("Unable to save this Pulse right now.");
    } finally {
      setEditorSubmitting(false);
    }
  }, [editingPresetId, editorDraft, editorSubmitting, onCustomPresetSave]);

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
      if (targetElement && targetElement.closest(".create-composer-presets-btn--selected")) {
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
      className={`create-composer-presets-surface ${isDropActive ? "is-drop-active" : ""}`.trim()}
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
      <div className="create-composer-presets-surface-header">
        <div className="create-composer-presets-surface-title-group">
          <h3 className="create-composer-presets-surface-title">Pulses</h3>
          <p className="create-composer-presets-surface-subtitle">
            Custom and built-in Pulses share the same grid. Click to pin a Pulse to the rail. Drag
            to pin without closing this view. Activating or deactivating from the rail starts a
            fresh Pulse session.
          </p>
        </div>
        <div className="create-composer-presets-surface-actions">
          <button
            type="button"
            className="ghost-btn create-composer-presets-surface-library-btn"
            onClick={handleOpenPresetsLibrary}
          >
            Pulse Library
          </button>
          <button
            type="button"
            className="ghost-btn mini create-composer-presets-surface-close"
            aria-label="Close presets"
            onClick={onClose}
          >
            x
          </button>
        </div>
      </div>
      <div className="create-composer-presets-surface-scroll">
        <section aria-label="Pulses presets">
          <div
            className="create-composer-presets-chip-grid"
            role="list"
            aria-label="Pulse catalog presets"
          >
            {presets.map((preset) => (
              <div
                key={preset.presetId}
                role="listitem"
                className={`create-composer-presets-chip-item ${
                  selectedPresetIds.includes(preset.presetId) ? "is-pinned" : ""
                }`.trim()}
              >
                <button
                  type="button"
                  draggable
                  className={`create-composer-presets-chip ${
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
                  <span className="create-composer-presets-chip-label">{preset.label}</span>
                </button>
                {preset.isEditable ? (
                  <button
                    type="button"
                    className="create-composer-presets-chip-edit"
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
        </section>
      </div>
      {editingPresetId ? (
        <div className="create-composer-presets-custom-editor-overlay" {...editorBackdropDismiss}>
          <div
            ref={editorDialogRef}
            role="dialog"
            aria-modal="false"
            aria-label="Edit pulse preset"
            className="create-composer-presets-custom-editor"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="create-composer-presets-custom-editor-fields">
              <label
                className="create-composer-presets-custom-editor-label"
                htmlFor="create-pulse-preset-name-input"
              >
                Preset name
              </label>
              <input
                id="create-pulse-preset-name-input"
                ref={editorNameInputRef}
                type="text"
                className="create-composer-presets-custom-editor-input"
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
              <p className="tiny subdued helper-text">
                A custom Pulse is just saved system instructions. If you want reusable prompt or
                artifact behavior, describe that directly in the instructions.
              </p>
              <label
                className="create-composer-presets-custom-editor-label"
                htmlFor="create-pulse-preset-prompt-input"
              >
                System instructions
              </label>
              <textarea
                id="create-pulse-preset-prompt-input"
                className="create-composer-presets-custom-editor-textarea"
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
              {editorError ? (
                <p className="create-composer-presets-custom-editor-error">{editorError}</p>
              ) : null}
            </div>
            <div className="create-composer-presets-custom-editor-actions">
              <button
                type="button"
                className="create-composer-presets-custom-editor-btn"
                onClick={closeEditor}
                disabled={editorSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="create-composer-presets-custom-editor-btn is-primary"
                onClick={() => {
                  void saveEditor();
                }}
                disabled={editorSubmitting}
              >
                {editorSubmitting ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};
