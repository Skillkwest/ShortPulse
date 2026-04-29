import Image from "next/image";
import React from "react";
import { Trash } from "phosphor-react";
import { AgentGenerateButton } from "../../../../prefabs/agent";
import { AspectDropdown } from "../AspectDropdown";
import { ResolutionDropdown } from "../ResolutionDropdown";
import { PromptStep } from "../PromptStep";
import type { AspectOption } from "../../types";

type StandardCreatePanelViewProps = {
  promptStepProps: React.ComponentProps<typeof PromptStep>;
  onGenerate: () => void;
  costCredits?: number | null;
  isPromptGenerating: boolean;
  isGenerateDisabled: boolean;
  guardrailReason?: string | null;
  characterModeEnabled: boolean;
  onCharacterModeEnabledToggle: () => void;
  onCharacterPickerOpen: () => void;
  characterSelectDisabled: boolean;
  isCharacterSelectionEmpty: boolean;
  selectedCharacterName: string;
  selectedCharacterDisplayName?: string;
  selectedCharacterProfileImageUrl: string | null;
  selectedCharacterInitials: string | null;
  onSelectedCharacterAvatarError?: () => void;
  onSelectedCharacterAvatarLoad?: () => void;
  isCharacterPickerOpen: boolean;
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
  createModeToggle?: React.ReactNode;
};

export function StandardCreatePanelView({
  promptStepProps,
  onGenerate,
  costCredits,
  isPromptGenerating,
  isGenerateDisabled,
  guardrailReason,
  characterModeEnabled,
  onCharacterModeEnabledToggle,
  onCharacterPickerOpen,
  characterSelectDisabled,
  isCharacterSelectionEmpty,
  selectedCharacterName,
  selectedCharacterDisplayName,
  selectedCharacterProfileImageUrl,
  selectedCharacterInitials,
  onSelectedCharacterAvatarError,
  onSelectedCharacterAvatarLoad,
  isCharacterPickerOpen,
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
  createModeToggle = null,
}: StandardCreatePanelViewProps) {
  const resolvedSelectedCharacterDisplayName =
    selectedCharacterDisplayName ?? selectedCharacterName;
  const [agentInputVisualRowCount, setAgentInputVisualRowCount] = React.useState(1);
  const hasVisibleAgentMessages = (promptStepProps.agentMessages?.length ?? 0) > 0;
  const shouldShowPersistentEmptyShell = !hasVisibleAgentMessages;
  const costValue = costCredits != null ? costCredits : "—";
  const modelLogoWidth = useUnoptimizedModelLogo ? 50 : 74;
  const modelLogoHeight = useUnoptimizedModelLogo ? 12 : 18;
  const handleClearAgentChat = promptStepProps.onClearAgentChat;
  const promptStepLayoutProps: React.ComponentProps<typeof PromptStep> = {
    ...promptStepProps,
    hideEmptyAgentChatState: true,
    forceRenderAgentChatPanel: !shouldShowPersistentEmptyShell,
    emptyAgentChatSpacerClassName: shouldShowPersistentEmptyShell
      ? "create-expert-chat-spacer"
      : "",
    onAgentInputVisualRowCountChange: setAgentInputVisualRowCount,
    onClearAgentChat: undefined,
    composerLeadingContent: promptStepProps.composerLeadingContent,
  };
  const shouldHideReadyTitle = agentInputVisualRowCount >= 8;

  const promptAndControls = (
    <>
      {shouldShowPersistentEmptyShell ? (
        <>
          <div className="create-expert-empty-preview-frame" aria-hidden="true" />
          <div className="create-expert-ready-row" aria-hidden={shouldHideReadyTitle}>
            <p
              className={`create-expert-ready-text ${shouldHideReadyTitle ? "is-hidden" : ""}`.trim()}
            >
              What do you want to make?
            </p>
          </div>
          <div className="create-expert-lower-preview-frame" aria-hidden="true" />
        </>
      ) : null}
      <div className="create-expert-bottom-block">
        <PromptStep {...promptStepLayoutProps} />
        <div className="create-expert-secondary-row create-expert-controls-row">
          <div className="create-expert-controls">
            <div
              className={`create-expert-control create-expert-character-mode-control ${
                characterModeEnabled ? "is-character-mode-on" : "is-character-mode-off"
              }`}
            >
              <div className="create-expert-character-mode-meta">
                <span className="create-expert-character-mode-title">Character</span>
                <button
                  type="button"
                  className={`audio-toggle ai-character-mode-toggle create-expert-toggle-control ${
                    characterModeEnabled ? "is-active" : ""
                  }`}
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
            </div>
            {characterModeEnabled ? (
              <div className="create-expert-control create-expert-character-picker-control">
                <button
                  type="button"
                  className={`model-picker-btn create-expert-picker-control create-expert-character-picker-trigger ${
                    isCharacterSelectionEmpty ? "is-empty" : ""
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
                      className="ai-character-picker-trigger-avatar"
                      width={20}
                      height={20}
                      unoptimized
                      onError={onSelectedCharacterAvatarError}
                      onLoad={onSelectedCharacterAvatarLoad}
                    />
                  ) : selectedCharacterInitials ? (
                    <span className="ai-character-picker-trigger-avatar ai-character-picker-trigger-avatar--fallback">
                      {selectedCharacterInitials}
                    </span>
                  ) : null}
                  <span className="model-picker-name">{resolvedSelectedCharacterDisplayName}</span>
                </button>
              </div>
            ) : null}
            <div className="create-expert-control create-expert-model-control">
              <span className="create-expert-control-label">Model</span>
              <button
                type="button"
                className={`model-picker-btn create-expert-picker-control create-expert-model-picker-trigger ${
                  isModelSelectionEmpty ? "is-empty" : ""
                } ${isCreateModelPickerOpen ? "is-open" : ""}`}
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
              disabled={isGenerateDisabled}
              isBusy={isPromptGenerating}
              cost={costValue}
            />
            {isGenerateDisabled && guardrailReason ? (
              <div className="inline-warning-hint">{guardrailReason}</div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div
      className={`tool-properties text-properties-panel create-expert-panel ${shouldShowPersistentEmptyShell ? "create-expert-panel--no-history" : ""}`.trim()}
      role="group"
      aria-label="Expert create composer"
    >
      <div className="tool-header">
        <p className="eyebrow">Create</p>
      </div>
      <div className="create-expert-panel-shell is-pulse-rail-inactive">
        <div className="create-expert-right-panel">
          <div className="create-expert-right-panel-inner">
            <div className="create-expert-right-panel-topbar">
              <div className="create-expert-right-panel-topbar-center">{createModeToggle}</div>
              {handleClearAgentChat ? (
                <button
                  type="button"
                  className="create-expert-topbar-clear-btn"
                  onClick={handleClearAgentChat}
                  aria-label="Clear chat"
                >
                  <Trash size={14} weight="bold" aria-hidden />
                  <span>Clear</span>
                </button>
              ) : null}
            </div>
            {shouldShowPersistentEmptyShell ? (
              <div className="create-expert-empty-state-shell">{promptAndControls}</div>
            ) : (
              <div className="create-expert-flow-shell">{promptAndControls}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
