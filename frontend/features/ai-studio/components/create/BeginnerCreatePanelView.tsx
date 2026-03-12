import Image from "next/image";
import React from "react";
import { CaretDown } from "phosphor-react";
import { AspectDropdown } from "../AspectDropdown";
import { PromptStep } from "../PromptStep";
import type { AspectOption } from "../../types";

type BeginnerCreatePanelViewProps = {
  beginnerMode: boolean;
  promptStepProps: React.ComponentProps<typeof PromptStep>;
  characterStepSubtitle: string;
  characterModeEnabled: boolean;
  onCharacterModeEnabledToggle: () => void;
  onCharacterPickerOpen: () => void;
  characterSelectDisabled: boolean;
  isCharacterSelectionEmpty: boolean;
  selectedCharacterName: string;
  selectedCharacterProfileImageUrl: string | null;
  selectedCharacterInitials: string | null;
  onSelectedCharacterAvatarError?: () => void;
  onSelectedCharacterAvatarLoad?: () => void;
  isCharacterPickerOpen: boolean;
  collapsedModel: boolean;
  onToggleModel: () => void;
  onExpandModel: () => void;
  isCreateModelPickerOpen: boolean;
  isModelSelectionEmpty: boolean;
  onCreateModelOpen: (event: React.MouseEvent<HTMLButtonElement>) => void;
  effectiveModelLogoSrc?: string;
  useUnoptimizedModelLogo: boolean;
  effectiveModelLabel: string;
  aspect: string;
  aspectOptionsForModel: AspectOption[];
  onAspectChange: (value: string) => void;
  shouldShowImageResolutionCard: boolean;
  imageResolutionValue: string;
  imageResolutionOptions: Array<{ value: string; label: string }>;
  onImageResolutionChange?: (value: string) => void;
};

const StepHeaderActionButton = ({
  label,
  isCollapsed = false,
  onClick,
}: {
  label: string;
  isCollapsed?: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    className="ghost-btn mini step-utility-btn"
    aria-label={label}
    onClick={(event) => {
      event.stopPropagation();
      onClick();
    }}
    aria-expanded={!isCollapsed}
  >
    <CaretDown size={16} weight="bold" aria-hidden />
  </button>
);

export function BeginnerCreatePanelView({
  beginnerMode,
  promptStepProps,
  characterStepSubtitle,
  characterModeEnabled,
  onCharacterModeEnabledToggle,
  onCharacterPickerOpen,
  characterSelectDisabled,
  isCharacterSelectionEmpty,
  selectedCharacterName,
  selectedCharacterProfileImageUrl,
  selectedCharacterInitials,
  onSelectedCharacterAvatarError,
  onSelectedCharacterAvatarLoad,
  isCharacterPickerOpen,
  collapsedModel,
  onToggleModel,
  onExpandModel,
  isCreateModelPickerOpen,
  isModelSelectionEmpty,
  onCreateModelOpen,
  effectiveModelLogoSrc,
  useUnoptimizedModelLogo,
  effectiveModelLabel,
  aspect,
  aspectOptionsForModel,
  onAspectChange,
  shouldShowImageResolutionCard,
  imageResolutionValue,
  imageResolutionOptions,
  onImageResolutionChange,
}: BeginnerCreatePanelViewProps) {
  return (
    <div className="tool-properties text-properties-panel beginner-create-panel">
      <div className="tool-header">
        <p className="eyebrow">Create</p>
      </div>
      <div
        className={`step-card ai-character-step-card ${beginnerMode ? "ai-character-step-card--beginner" : ""}`}
        role="group"
        aria-label="Character mode section"
      >
        <div className="step-card-header">
          {beginnerMode ? <span className="step-badge">1</span> : null}
          <div className="step-header-copy">
            <p className="step-title">
              Character Mode
              {!characterModeEnabled ? (
                <span className="step-title-optional">(Optional)</span>
              ) : null}
            </p>
            <span className="step-subtitle tiny helper-text">{characterStepSubtitle}</span>
          </div>
          <div
            className={`step-header-actions ai-character-header-actions ${
              !characterModeEnabled ? "ai-character-header-actions--mode-off" : ""
            }`}
          >
            <div className="ai-character-mode-row">
              <button
                type="button"
                className={`audio-toggle ai-character-mode-toggle ${characterModeEnabled ? "is-active" : ""}`}
                aria-pressed={characterModeEnabled}
                aria-label={
                  characterModeEnabled ? "Disable character mode" : "Enable character mode"
                }
                onClick={onCharacterModeEnabledToggle}
              >
                <span className="audio-toggle-track" aria-hidden="true">
                  <span className="audio-toggle-dot" />
                </span>
              </button>
            </div>
            <div
              className={`ai-character-picker-row ${characterModeEnabled ? "is-visible" : "is-hidden"}`}
              aria-hidden={!characterModeEnabled}
            >
              <button
                type="button"
                className={`model-picker-btn ai-character-picker-trigger ${
                  isCharacterSelectionEmpty ? "is-empty" : ""
                } ${isCharacterPickerOpen ? "is-open" : ""}`}
                aria-haspopup="dialog"
                aria-expanded={isCharacterPickerOpen}
                aria-label="Open character picker"
                disabled={characterSelectDisabled}
                onClick={onCharacterPickerOpen}
              >
                <div className="model-picker-row">
                  <span className="ai-character-picker-trigger-value">
                    {selectedCharacterProfileImageUrl ? (
                      <Image
                        src={selectedCharacterProfileImageUrl}
                        alt={`${selectedCharacterName} profile`}
                        className="ai-character-picker-trigger-avatar"
                        width={24}
                        height={24}
                        unoptimized
                        onError={onSelectedCharacterAvatarError}
                        onLoad={onSelectedCharacterAvatarLoad}
                      />
                    ) : selectedCharacterInitials ? (
                      <span className="ai-character-picker-trigger-avatar ai-character-picker-trigger-avatar--fallback">
                        {selectedCharacterInitials}
                      </span>
                    ) : null}
                    <span className="model-picker-name">{selectedCharacterName}</span>
                  </span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
      <PromptStep {...promptStepProps} />
      <div
        className={`step-card ${collapsedModel ? "is-collapsed" : ""}`}
        onClick={() => onExpandModel()}
        role="group"
        aria-label="Choose frame and model section"
      >
        <div className="step-card-header">
          {beginnerMode && <span className="step-badge">3</span>}
          <div className="step-header-copy">
            <p className="step-title">Choose Frame & Model</p>
            <span className="step-subtitle tiny helper-text">
              Select the model, then choose the aspect ratio.
            </span>
          </div>
          {!beginnerMode ? (
            <div className="step-header-actions">
              <StepHeaderActionButton
                label="Open aspect ratio and model options"
                isCollapsed={collapsedModel}
                onClick={onToggleModel}
              />
            </div>
          ) : null}
        </div>
        {!collapsedModel ? (
          <div className="create-controls frame-model-controls">
            <div className="control-row compact">
              <label className="input-label">Model</label>
              <button
                type="button"
                className={`model-picker-btn ${isModelSelectionEmpty ? "is-empty" : ""} ${
                  isCreateModelPickerOpen ? "is-open" : ""
                }`}
                data-model-anchor="create-model"
                aria-label="Open model picker"
                onClick={onCreateModelOpen}
              >
                <div className="model-picker-row">
                  <span className="model-picker-value">
                    {effectiveModelLogoSrc ? (
                      <Image
                        className="model-chip-logo-img"
                        src={effectiveModelLogoSrc}
                        alt=""
                        aria-hidden
                        width={80}
                        height={20}
                        unoptimized={useUnoptimizedModelLogo}
                      />
                    ) : null}
                    <span className="model-picker-name">{effectiveModelLabel}</span>
                  </span>
                </div>
              </button>
            </div>
            <div className="control-row compact">
              <label className="input-label">Aspect ratio</label>
              <AspectDropdown
                aspect={aspect}
                onSelect={onAspectChange}
                options={aspectOptionsForModel}
              />
            </div>
          </div>
        ) : null}
      </div>
      {!beginnerMode && shouldShowImageResolutionCard ? (
        <div
          className="step-card image-settings-card image-settings-card--inline"
          role="group"
          aria-label="Choose image resolution section"
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
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
