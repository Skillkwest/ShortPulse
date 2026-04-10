/**
 * Elements description editor card.
 * Preserves the current helper and counter behavior with Elements-owned styling hooks.
 */
import React from "react";

type ElementsDescriptionEditorCardProps = {
  description: string;
  helperText?: string;
  maxLength: number;
  rows: number;
  disabled: boolean;
  onChangeDescription: (value: string) => void;
};

/**
 * Renders the Elements description editor with unchanged label, helper, and counter behavior.
 */
export function ElementsDescriptionEditorCard({
  description,
  helperText,
  maxLength,
  rows,
  disabled,
  onChangeDescription,
}: ElementsDescriptionEditorCardProps) {
  return (
    <div className="elements-description-card elements-profile-fields">
      <div className="elements-description-label-row">
        <label className="input-label" htmlFor="element-manager-description">
          Description:
        </label>
      </div>
      <div className="elements-description-text-container">
        <textarea
          id="element-manager-description"
          className="elements-description-input"
          rows={rows}
          value={description}
          maxLength={maxLength}
          onChange={(event) => onChangeDescription(event.target.value)}
          placeholder="A sleek midnight-blue sports car with a low profile, sculpted bodywork, glowing headlights, and polished alloy rims."
          disabled={disabled}
        />
      </div>
      <div className="elements-description-footer-row">
        {helperText ? (
          <p className="elements-description-helper tiny subdued">{helperText}</p>
        ) : null}
        <p className="elements-description-count tiny subdued">
          {description.length}/{maxLength}
        </p>
      </div>
    </div>
  );
}
