import Image from "next/image";
import React from "react";
import { AgentGenerateButton } from "../../../../prefabs/agent";
import { AspectDropdown } from "../AspectDropdown";
import { ResolutionDropdown } from "../ResolutionDropdown";
import { PromptStep } from "../PromptStep";
import type { AspectOption } from "../../types";

type ExpertCreatePanelViewProps = {
  promptStepProps: React.ComponentProps<typeof PromptStep>;
  onGenerate: () => void;
  costCredits?: number | null;
  isPromptGenerating: boolean;
  isGenerateDisabled: boolean;
  characterModeEnabled: boolean;
  onCharacterModeEnabledToggle: () => void;
  onCharacterPickerOpen: () => void;
  characterSelectDisabled: boolean;
  selectedCharacterName: string;
  selectedCharacterProfileImageUrl: string | null;
  selectedCharacterInitials: string | null;
  isCharacterPickerOpen: boolean;
  modelId: string | null;
  isModelModalOpen: boolean;
  modelModalAnchor: string | null;
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

export function ExpertCreatePanelView({
  promptStepProps,
  onGenerate,
  costCredits,
  isPromptGenerating,
  isGenerateDisabled,
  characterModeEnabled,
  onCharacterModeEnabledToggle,
  onCharacterPickerOpen,
  characterSelectDisabled,
  selectedCharacterName,
  selectedCharacterProfileImageUrl,
  selectedCharacterInitials,
  isCharacterPickerOpen,
  modelId,
  isModelModalOpen,
  modelModalAnchor,
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
}: ExpertCreatePanelViewProps) {
  const costValue = costCredits != null ? costCredits : "—";
  const modelLogoWidth = useUnoptimizedModelLogo ? 50 : 74;
  const modelLogoHeight = useUnoptimizedModelLogo ? 12 : 18;
  const hasChatHistory = (promptStepProps.agentMessages?.length ?? 0) > 0;
  const promptStepLayoutProps: React.ComponentProps<typeof PromptStep> = {
    ...promptStepProps,
    hideEmptyAgentChatState: true,
    emptyAgentChatSpacerClassName: hasChatHistory ? "" : "create-expert-chat-spacer",
  };

  return (
    <div
      className={`tool-properties text-properties-panel create-expert-panel ${!hasChatHistory ? "create-expert-panel--no-history" : ""}`.trim()}
      role="group"
      aria-label="Expert create composer"
    >
      <div className="tool-header">
        <p className="eyebrow">Create</p>
      </div>
      {!hasChatHistory ? (
        <div className="create-expert-empty-top-spacer" aria-hidden="true" />
      ) : null}
      {!hasChatHistory ? (
        <p className="create-expert-ready-text">What do you want to make?</p>
      ) : null}
      <PromptStep {...promptStepLayoutProps} />
      <div className="create-expert-secondary-row create-expert-controls-row">
        <div className="create-expert-controls">
          <div
            className={`create-expert-control create-expert-character-mode-control ${
              characterModeEnabled ? "is-character-mode-on" : "is-character-mode-off"
            }`}
          >
            <div className="create-expert-character-mode-meta">
              <p className="create-expert-character-mode-title">Character</p>
              <button
                type="button"
                className={`audio-toggle character-mode-toggle create-expert-toggle-control ${characterModeEnabled ? "is-active" : ""}`}
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
            {characterModeEnabled ? (
              <button
                type="button"
                className={`model-picker-btn create-expert-picker-control create-expert-character-picker-trigger ${
                  !selectedCharacterInitials && !selectedCharacterProfileImageUrl ? "is-empty" : ""
                } ${isCharacterPickerOpen ? "is-open" : ""}`}
                aria-haspopup="dialog"
                aria-expanded={isCharacterPickerOpen}
                aria-label="Open character picker"
                disabled={characterSelectDisabled}
                onClick={onCharacterPickerOpen}
              >
                {selectedCharacterProfileImageUrl ? (
                  <Image
                    src={selectedCharacterProfileImageUrl}
                    alt={`${selectedCharacterName} profile`}
                    className="character-picker-trigger-avatar"
                    width={20}
                    height={20}
                    unoptimized
                  />
                ) : selectedCharacterInitials ? (
                  <span className="character-picker-trigger-avatar character-picker-trigger-avatar--fallback">
                    {selectedCharacterInitials}
                  </span>
                ) : null}
                <span className="model-picker-name">{selectedCharacterName}</span>
              </button>
            ) : null}
          </div>
          <div className="create-expert-control create-expert-model-control">
            <span className="create-expert-control-label">Model</span>
            <button
              type="button"
              className={`model-picker-btn create-expert-picker-control create-expert-model-picker-trigger ${!modelId ? "is-empty" : ""} ${
                isModelModalOpen && modelModalAnchor === "create-model" ? "is-open" : ""
              }`}
              data-model-anchor="create-model"
              aria-label="Open model picker"
              onClick={onCreateModelOpen}
            >
              {effectiveModelLogoSrc ? (
                <Image
                  className="model-chip-logo-img"
                  src={effectiveModelLogoSrc}
                  alt=""
                  aria-hidden
                  width={modelLogoWidth}
                  height={modelLogoHeight}
                  unoptimized={useUnoptimizedModelLogo}
                />
              ) : null}
              <span className="model-picker-name">{effectiveModelLabel}</span>
            </button>
          </div>
          <div className="create-expert-control create-expert-aspect-control">
            <span className="create-expert-control-label">Aspect</span>
            <AspectDropdown
              aspect={aspect}
              onSelect={onAspectChange}
              options={aspectOptionsForModel}
            />
          </div>
          {shouldShowImageResolutionCard ? (
            <div className="create-expert-control create-expert-resolution-control">
              <span className="create-expert-control-label">Resolution</span>
              <ResolutionDropdown
                value={imageResolutionValue}
                options={imageResolutionOptions}
                onSelect={onImageResolutionChange}
              />
            </div>
          ) : null}
        </div>
      </div>
      <div className="create-expert-secondary-row create-expert-generate-row">
        <div className="create-expert-inline-generate">
          <AgentGenerateButton
            onClick={onGenerate}
            disabled={isGenerateDisabled || isPromptGenerating}
            isBusy={isPromptGenerating}
            cost={costValue}
          />
        </div>
      </div>
    </div>
  );
}
