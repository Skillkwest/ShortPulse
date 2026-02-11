/**
 * Image resolution settings step for reference image workflows.
 */
import React from "react";
import { ReferenceStepHeaderActionButton } from "./ReferenceStepHeaderActionButton";

type ReferenceImageResolutionStepProps = {
  imageSettingsOrder: number;
  collapsedImageSettings: boolean;
  imageResolutionValue: string;
  imageResolutionOptions: { value: string; label: string }[];
  onExpandImageSettings: () => void;
  onToggleImageSettings: () => void;
  onImageResolutionChange?: (value: string) => void;
};

/**
 * Renders image model resolution selector with collapsible step framing.
 */
export const ReferenceImageResolutionStep: React.FC<ReferenceImageResolutionStepProps> = ({
  imageSettingsOrder,
  collapsedImageSettings,
  imageResolutionValue,
  imageResolutionOptions,
  onExpandImageSettings,
  onToggleImageSettings,
  onImageResolutionChange,
}) => {
  return (
    <div
      className={`step-card image-settings-card ${collapsedImageSettings ? "is-collapsed" : ""}`}
      onClick={onExpandImageSettings}
      style={{ order: imageSettingsOrder }}
    >
      <div className="step-card-header">
        <div className="step-header-copy">
          <p className="step-title">Choose Image Resolution</p>
          <span className="step-subtitle tiny helper-text">
            Select the model-specific image resolution setting.
          </span>
        </div>
        <div className="step-header-actions">
          <ReferenceStepHeaderActionButton
            label="Open image resolution settings"
            isCollapsed={collapsedImageSettings}
            onClick={onToggleImageSettings}
          />
        </div>
      </div>
      {!collapsedImageSettings ? (
        <div className="create-controls image-settings-controls">
          <div className="control-row compact fixed-select">
            <label className="input-label">Resolution</label>
            <select
              className="model-select"
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
      ) : null}
    </div>
  );
};
