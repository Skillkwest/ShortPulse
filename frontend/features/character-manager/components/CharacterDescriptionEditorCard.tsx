/**
 * Character description editor card.
 * Renders the preset-scoped description input, helper tip, and character counter.
 */
import React from "react";

type CharacterDescriptionEditorCardProps = {
  description: string;
  helperText: string;
  maxLength: number;
  rows: number;
  disabled: boolean;
  showInlineHelper: boolean;
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
  showInlineHelper,
  onChangeDescription,
}: CharacterDescriptionEditorCardProps) {
  return (
    <div className="character-sheet-description-card character-profile-fields character-profile-fields--label-serif">
      <label className="control-row character-simple-field" htmlFor="character-manager-description">
        <div className="character-description-label-row">
          <span className="input-label">Description:</span>
          {showInlineHelper ? (
            <p className="character-description-helper character-description-helper--inline tiny subdued">
              {helperText}
            </p>
          ) : null}
        </div>
        <textarea
          id="character-manager-description"
          className="character-description-input"
          rows={rows}
          value={description}
          maxLength={maxLength}
          onChange={(event) => onChangeDescription(event.target.value)}
          placeholder="A gorgeous woman in her early 30s with brown hair and dark amber eyes, she has a slim, toned waist, a curvy lower body, and thick thighs."
          disabled={disabled}
        />
        <div className="character-description-footer-row">
          {!showInlineHelper ? (
            <p className="character-description-helper tiny subdued">{helperText}</p>
          ) : null}
          <p className="character-description-count tiny subdued">
            {description.length}/{maxLength}
          </p>
        </div>
      </label>
    </div>
  );
}
