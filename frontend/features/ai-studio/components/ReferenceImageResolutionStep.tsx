/**
 * Image resolution settings step for reference image workflows.
 */
import React from "react";

type ReferenceImageResolutionStepProps = {
  imageSettingsOrder: number;
  imageResolutionValue: string;
  imageResolutionOptions: { value: string; label: string }[];
  onImageResolutionChange?: (value: string) => void;
};

/**
 * Renders image model resolution selector in a fixed single-row card.
 */
export const ReferenceImageResolutionStep: React.FC<ReferenceImageResolutionStepProps> = ({
  imageSettingsOrder,
  imageResolutionValue,
  imageResolutionOptions,
  onImageResolutionChange,
}) => {
  return (
    <div
      className="step-card image-settings-card image-settings-card--inline"
      style={{ order: imageSettingsOrder }}
    >
      <div className="step-card-header">
        <div className="step-header-copy">
          <p className="step-title">Choose Image Resolution</p>
        </div>
        <div className="step-header-actions">
          <div className="fixed-select image-settings-header-select">
            <select
              className="model-select"
              aria-label="Image resolution"
              value={imageResolutionValue}
              onChange={(event) => onImageResolutionChange?.(event.target.value)}
            >
              {imageResolutionOptions.map((option) => (
                <option value={option.value} key={`image-resolution-${option.value}`}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
