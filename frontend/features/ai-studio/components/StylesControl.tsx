/**
 * Shared Styles control used by Expert Edit and Expert Create composer surfaces.
 * Renders the wrapper/title/button chrome and mirrors selected-style preview state.
 */
import React from "react";
import { Sticker } from "phosphor-react";
import {
  resolveExpertEditStyleById,
  resolveStylePreviewBackgroundImage,
} from "./edit/expertEditStyles";

export type StylesControlProps = {
  isOpen?: boolean;
  selectedStyleId?: string | null;
  onToggle?: () => void;
  controlsId?: string;
  className?: string;
};

export function StylesControl({
  isOpen = false,
  selectedStyleId = null,
  onToggle,
  controlsId = "reference-rail-styles-section",
  className = "",
}: StylesControlProps) {
  const selectedStyleTile = React.useMemo(
    () => resolveExpertEditStyleById(selectedStyleId ?? null),
    [selectedStyleId]
  );

  return (
    <div className={`edit-expert-styles-control ${className}`.trim()}>
      <div className={`edit-expert-styles-wrapper ${isOpen ? "is-open" : ""}`.trim()}>
        <p className="edit-expert-styles-title">Styles</p>
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
          {selectedStyleTile?.previewUrl ? (
            <span
              className="edit-expert-styles-btn-preview"
              style={{
                backgroundImage: resolveStylePreviewBackgroundImage(selectedStyleTile.previewUrl),
              }}
              aria-hidden="true"
            />
          ) : (
            <Sticker size={22} weight="regular" />
          )}
        </button>
      </div>
    </div>
  );
}
