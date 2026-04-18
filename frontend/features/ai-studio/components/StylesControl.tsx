/**
 * Shared Styles control used by Expert Edit and Expert Create composer surfaces.
 * Renders a single labeled button and mirrors selected-style preview state.
 */
import React from "react";
import { Palette } from "phosphor-react";
import {
  type ExpertEditStyleTile,
  resolveExpertEditStyleById,
  resolveStylePreviewBackgroundImage,
} from "./edit/expertEditStyles";

export type StylesControlProps = {
  isOpen?: boolean;
  selectedStyleId?: string | null;
  styles?: readonly ExpertEditStyleTile[];
  onToggle?: () => void;
  controlsId?: string;
  className?: string;
};

export function StylesControl({
  isOpen = false,
  selectedStyleId = null,
  styles,
  onToggle,
  controlsId = "reference-rail-styles-section",
  className = "",
}: StylesControlProps) {
  const selectedStyleTile = React.useMemo(
    () =>
      styles?.find((style) => !style.placeholder && style.id === (selectedStyleId ?? null)) ??
      resolveExpertEditStyleById(selectedStyleId ?? null),
    [selectedStyleId, styles]
  );

  return (
    <div className={`edit-expert-styles-control ${isOpen ? "is-open" : ""} ${className}`.trim()}>
      <div className="edit-expert-styles-btn-shell">
        <button
          type="button"
          className={`edit-expert-styles-btn ${selectedStyleTile ? "has-selected-style" : ""} ${
            isOpen ? "is-open" : ""
          }`.trim()}
          aria-label="Styles"
          aria-haspopup="true"
          aria-expanded={isOpen}
          aria-controls={controlsId}
          onClick={onToggle}
        >
          <span className="edit-expert-styles-btn-visual" aria-hidden="true">
            {selectedStyleTile?.previewUrl ? (
              <span
                className="edit-expert-styles-btn-preview"
                style={{
                  backgroundImage: resolveStylePreviewBackgroundImage(selectedStyleTile.previewUrl),
                }}
                aria-hidden="true"
              />
            ) : (
              <Palette size={22} weight="regular" />
            )}
          </span>
          <span className="edit-expert-styles-btn-label">Styles</span>
        </button>
      </div>
    </div>
  );
}
