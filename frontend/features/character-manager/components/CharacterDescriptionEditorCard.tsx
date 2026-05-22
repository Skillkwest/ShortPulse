/**
 * Character description editor card.
 * Renders the look-scoped description input, helper tip, and character counter.
 */
import React from "react";

const CHARACTER_DESCRIPTION_TEXT_CONTAINER_STYLE: React.CSSProperties = {
  padding: "14px 16px 30px",
  position: "relative",
  border: "1px solid rgba(34, 40, 49, 0.96)",
  borderRadius: "16px",
  background: "rgba(12, 14, 19, 0.96)",
  minHeight: "142px",
  boxSizing: "border-box",
};

const CHARACTER_DESCRIPTION_INPUT_STYLE: React.CSSProperties = {
  padding: "6px 4px",
  width: "100%",
  minHeight: "110px",
  border: "none",
  outline: "none",
  resize: "none",
  background: "transparent",
  color: "rgba(232, 236, 244, 0.96)",
  fontSize: "0.92rem",
  lineHeight: 1.45,
  boxSizing: "border-box",
};

const CHARACTER_DESCRIPTION_CARD_STYLE: React.CSSProperties = {
  display: "grid",
  gap: "8px",
  minWidth: 0,
};

const CHARACTER_DESCRIPTION_LABEL_ROW_STYLE: React.CSSProperties = {
  marginBottom: "2px",
};

const CHARACTER_DESCRIPTION_COUNT_STYLE: React.CSSProperties = {
  position: "absolute",
  right: "12px",
  bottom: "10px",
  margin: 0,
  color: "rgba(183, 190, 204, 0.78)",
  fontSize: "0.8rem",
};

const CHARACTER_DESCRIPTION_HELPER_ROW_STYLE: React.CSSProperties = {
  minHeight: "14px",
};

type CharacterDescriptionEditorCardProps = {
  description: string;
  helperText?: string;
  maxLength: number;
  rows: number;
  disabled: boolean;
  onChangeDescription: (value: string) => void;
};

/**
 * Renders the character description editor with unchanged helper/counter behavior.
 */
export function CharacterDescriptionEditorCard({
  description,
  helperText,
  maxLength,
  rows,
  disabled,
  onChangeDescription,
}: CharacterDescriptionEditorCardProps) {
  return (
    <div
      className="character-sheet-description-card character-profile-fields character-profile-fields--label-serif"
      style={CHARACTER_DESCRIPTION_CARD_STYLE}
    >
      <div
        className="character-description-label-row"
        style={CHARACTER_DESCRIPTION_LABEL_ROW_STYLE}
      >
        <label className="input-label" htmlFor="character-manager-description">
          Description:
        </label>
      </div>
      <div
        className="character-description-text-container"
        style={CHARACTER_DESCRIPTION_TEXT_CONTAINER_STYLE}
      >
        <textarea
          id="character-manager-description"
          className="character-description-input"
          style={CHARACTER_DESCRIPTION_INPUT_STYLE}
          rows={rows}
          value={description}
          maxLength={maxLength}
          onChange={(event) => onChangeDescription(event.target.value)}
          placeholder="A gorgeous woman in her early 30s with brown hair and dark amber eyes, she has a slim, toned waist, a curvy lower body, and thick thighs."
          disabled={disabled}
        />
        <p
          className="character-description-count tiny subdued"
          style={CHARACTER_DESCRIPTION_COUNT_STYLE}
        >
          {description.length}/{maxLength}
        </p>
      </div>
      <div
        className="character-description-footer-row"
        style={CHARACTER_DESCRIPTION_HELPER_ROW_STYLE}
      >
        {helperText ? (
          <p className="character-description-helper tiny subdued">{helperText}</p>
        ) : null}
      </div>
    </div>
  );
}
