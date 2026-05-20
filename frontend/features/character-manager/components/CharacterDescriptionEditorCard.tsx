/**
 * Character description editor card.
 * Renders the look-scoped description input, helper tip, and character counter.
 */
import React from "react";

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
    <div className="character-sheet-description-card character-profile-fields character-profile-fields--label-serif">
      <div className="character-description-label-row">
        <label className="input-label" htmlFor="character-manager-description">
          Description:
        </label>
      </div>
      <div className="character-description-text-container">
        <textarea
          id="character-manager-description"
          className="character-description-input"
          rows={rows}
          value={description}
          maxLength={maxLength}
          onChange={(event) => onChangeDescription(event.target.value)}
          placeholder="A sleek midnight-blue sports car with a low profile, sculpted bodywork, glowing headlights, and polished alloy rims."
          disabled={disabled}
        />
        <p className="character-description-count tiny subdued">
          {description.length}/{maxLength}
        </p>
      </div>
      <div className="character-description-footer-row">
        {helperText ? (
          <p className="character-description-helper tiny subdued">{helperText}</p>
        ) : null}
      </div>
    </div>
  );
}
