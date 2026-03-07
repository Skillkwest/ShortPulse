/**
 * Inline presets surface rendered inside the Expert Edit primary dropzone.
 * Keeps the presets UI decoupled from global modal primitives.
 */
import React from "react";

export type ExpertEditPresetsSurfaceProps = {
  id: string;
  isOpen: boolean;
  labels: readonly string[];
  onClose: () => void;
  onPresetSelect?: (label: string) => void;
};

/**
 * Renders the contained presets surface for Expert Edit.
 */
export const ExpertEditPresetsSurface = ({
  id,
  isOpen,
  labels,
  onClose,
  onPresetSelect,
}: ExpertEditPresetsSurfaceProps) => {
  const surfaceRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    surfaceRef.current?.focus();
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const targetNode = event.target as Node | null;
      if (!targetNode) return;
      if (surfaceRef.current?.contains(targetNode)) return;
      onClose();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <section
      id={id}
      ref={surfaceRef}
      className="edit-expert-presets-surface"
      role="region"
      aria-label="More presets"
      tabIndex={-1}
      onClick={(event) => event.stopPropagation()}
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
            Available preset chips for this Expert Edit pass.
          </p>
        </div>
        <button
          type="button"
          className="ghost-btn mini edit-expert-presets-surface-close"
          aria-label="Close presets"
          onClick={onClose}
        >
          x
        </button>
      </div>
      <div className="edit-expert-presets-surface-scroll">
        <div className="edit-expert-presets-chip-grid" role="list" aria-label="Available presets">
          {labels.map((label) => (
            <button
              key={label}
              type="button"
              role="listitem"
              className={`edit-expert-presets-chip ${
                /^custom\s+\d+$/i.test(label) ? "is-custom-label" : ""
              }`.trim()}
              onClick={() => onPresetSelect?.(label)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};
