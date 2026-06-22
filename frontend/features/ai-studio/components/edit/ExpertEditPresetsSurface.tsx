/**
 * Compact More Presets popup surface anchored to the Expert Edit preset toolbar.
 * Keeps the presets UI decoupled from global modal primitives.
 */
import React from "react";
import { PencilSimpleLine, Sliders } from "phosphor-react";
import type { ExpertEditPresetId, ExpertEditResolvedPreset } from "./expertEditPresets";

export type ExpertEditPresetsSurfaceProps = {
  id: string;
  isOpen: boolean;
  presets: readonly ExpertEditResolvedPreset[];
  onClose: () => void;
  onOpenPresetsLibrary?: () => void;
  onPresetSelect?: (presetId: ExpertEditPresetId) => void;
  onPresetDragStart?: (
    event: React.DragEvent<HTMLButtonElement>,
    presetId: ExpertEditPresetId
  ) => void;
  onPresetDragEnd?: () => void;
  onSurfaceDragOver?: (event: React.DragEvent<HTMLElement>) => void;
  onSurfaceDrop?: (event: React.DragEvent<HTMLElement>) => void;
  onSurfaceDragLeave?: (event: React.DragEvent<HTMLElement>) => void;
  isDropActive?: boolean;
};

/**
 * Renders the contained presets surface for Expert Edit.
 */
export const ExpertEditPresetsSurface = ({
  id,
  isOpen,
  presets,
  onClose,
  onOpenPresetsLibrary,
  onPresetSelect,
  onPresetDragStart,
  onPresetDragEnd,
  onSurfaceDragOver,
  onSurfaceDrop,
  onSurfaceDragLeave,
  isDropActive = false,
}: ExpertEditPresetsSurfaceProps) => {
  const surfaceRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    surfaceRef.current?.focus();
  }, [isOpen]);

  const shouldUseMutedCustomLabel = React.useCallback((preset: ExpertEditResolvedPreset) => {
    if (!preset.isCustom) return false;
    return /^custom\s+\d+$/i.test(preset.label.trim());
  }, []);

  const handleOpenPresetsLibrary = React.useCallback(() => {
    onClose();
    onOpenPresetsLibrary?.();
  }, [onClose, onOpenPresetsLibrary]);

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
      if (targetElement && targetElement.closest(".edit-expert-preset-btn--selected")) {
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
      className={`edit-expert-presets-surface ${isDropActive ? "is-drop-active" : ""}`.trim()}
      role="region"
      aria-label="More presets"
      tabIndex={-1}
      onClick={(event) => event.stopPropagation()}
      onDragOver={onSurfaceDragOver}
      onDrop={onSurfaceDrop}
      onDragLeave={onSurfaceDragLeave}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
    >
      <div className="edit-expert-presets-surface-header">
        <div className="edit-expert-presets-surface-title-group">
          <h3 className="edit-expert-presets-surface-title">More Presets</h3>
          <p className="edit-expert-presets-surface-subtitle">
            {"\u2190 Drag & drop presets into the preset panel to customize your workflow."}
          </p>
        </div>
        <div className="edit-expert-presets-surface-actions">
          <button
            type="button"
            className="ghost-btn edit-expert-presets-surface-library-btn"
            onClick={handleOpenPresetsLibrary}
          >
            <span className="edit-expert-preset-btn-icon" aria-hidden="true">
              <Sliders size={12} weight="regular" />
            </span>
            Presets library
          </button>
          <button
            type="button"
            className="ghost-btn mini edit-expert-presets-surface-close"
            aria-label="Close presets"
            onClick={onClose}
          >
            x
          </button>
        </div>
      </div>
      <div className="edit-expert-presets-surface-scroll">
        <div className="edit-expert-presets-chip-grid" role="list" aria-label="Available presets">
          {presets.map((preset) => (
            <div
              key={preset.presetId}
              role="listitem"
              className={`edit-expert-presets-chip-item ${
                preset.isCustom ? "is-custom" : ""
              }`.trim()}
            >
              <button
                type="button"
                draggable
                className={`edit-expert-presets-chip ${
                  shouldUseMutedCustomLabel(preset) ? "is-custom-label" : ""
                }`.trim()}
                onClick={() => onPresetSelect?.(preset.presetId)}
                onDragStart={(event) => onPresetDragStart?.(event, preset.presetId)}
                onDragEnd={onPresetDragEnd}
              >
                {preset.label}
              </button>
              {preset.isCustom ? (
                <button
                  type="button"
                  className="edit-expert-presets-chip-edit"
                  aria-label={`Edit ${preset.label} preset in Presets library`}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleOpenPresetsLibrary();
                  }}
                >
                  <PencilSimpleLine size={14} weight="regular" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
