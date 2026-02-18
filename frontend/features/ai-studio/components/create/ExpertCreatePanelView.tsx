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
  isModelPickerLockedByCharacterMode: boolean;
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
  isModelPickerLockedByCharacterMode,
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
  type SelectorMotionState = "hidden" | "pre-enter" | "shown" | "exiting";
  const costValue = costCredits != null ? costCredits : "—";
  const modelLogoWidth = useUnoptimizedModelLogo ? 50 : 74;
  const modelLogoHeight = useUnoptimizedModelLogo ? 12 : 18;
  const [characterPickerMotionState, setCharacterPickerMotionState] =
    React.useState<SelectorMotionState>(characterModeEnabled ? "shown" : "hidden");
  const [modelControlMotionState, setModelControlMotionState] = React.useState<SelectorMotionState>(
    characterModeEnabled ? "hidden" : "shown"
  );
  const previousCharacterModeEnabledRef = React.useRef(characterModeEnabled);
  const enterFrameRef = React.useRef<number | null>(null);
  const hasChatHistory = (promptStepProps.agentMessages?.length ?? 0) > 0;
  const promptStepLayoutProps: React.ComponentProps<typeof PromptStep> = {
    ...promptStepProps,
    hideEmptyAgentChatState: true,
    emptyAgentChatSpacerClassName: hasChatHistory ? "" : "create-expert-chat-spacer",
  };
  const clearSelectorMotionTimers = React.useCallback(() => {
    if (enterFrameRef.current != null && typeof window !== "undefined") {
      window.cancelAnimationFrame(enterFrameRef.current);
      enterFrameRef.current = null;
    }
  }, []);

  React.useEffect(() => clearSelectorMotionTimers, [clearSelectorMotionTimers]);

  React.useEffect(() => {
    const wasCharacterModeEnabled = previousCharacterModeEnabledRef.current;
    previousCharacterModeEnabledRef.current = characterModeEnabled;
    if (wasCharacterModeEnabled === characterModeEnabled) return;

    clearSelectorMotionTimers();

    const beginModelEnter = () => {
      setModelControlMotionState("pre-enter");
      if (typeof window !== "undefined") {
        enterFrameRef.current = window.requestAnimationFrame(() => {
          setModelControlMotionState("shown");
          enterFrameRef.current = null;
        });
      } else {
        setModelControlMotionState("shown");
      }
    };

    const beginCharacterEnter = () => {
      setCharacterPickerMotionState("pre-enter");
      if (typeof window !== "undefined") {
        enterFrameRef.current = window.requestAnimationFrame(() => {
          setCharacterPickerMotionState("shown");
          enterFrameRef.current = null;
        });
      } else {
        setCharacterPickerMotionState("shown");
      }
    };

    if (!characterModeEnabled) {
      // Character mode OFF should hide character selector immediately (no exit transition).
      if (characterPickerMotionState !== "hidden") {
        setCharacterPickerMotionState("hidden");
      }
      beginModelEnter();
      return;
    }

    if (modelControlMotionState !== "hidden") {
      // Character mode ON should hide the model selector immediately (no exit transition).
      setModelControlMotionState("hidden");
    }
    beginCharacterEnter();
  }, [
    characterModeEnabled,
    characterPickerMotionState,
    clearSelectorMotionTimers,
    modelControlMotionState,
  ]);

  const showModelControl = modelControlMotionState !== "hidden";
  const isModelControlInteractable = modelControlMotionState === "shown";
  const isCharacterPickerInteractable = characterPickerMotionState === "shown";
  const isCharacterPickerLayoutOn = characterPickerMotionState !== "hidden";

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
              isCharacterPickerLayoutOn ? "is-character-mode-on" : "is-character-mode-off"
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
            <button
              type="button"
              className={`model-picker-btn create-expert-picker-control create-expert-character-picker-trigger ${
                !selectedCharacterInitials && !selectedCharacterProfileImageUrl ? "is-empty" : ""
              } ${isCharacterPickerOpen ? "is-open" : ""} create-expert-character-picker-trigger--${characterPickerMotionState}`}
              aria-haspopup="dialog"
              aria-expanded={isCharacterPickerOpen}
              aria-label="Open character picker"
              disabled={characterSelectDisabled || !isCharacterPickerInteractable}
              tabIndex={isCharacterPickerInteractable ? undefined : -1}
              aria-hidden={isCharacterPickerInteractable ? undefined : true}
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
          </div>
          {showModelControl ? (
            <div
              className={`create-expert-control create-expert-model-control create-expert-model-control--${modelControlMotionState}`}
            >
              <span className="create-expert-control-label">Model</span>
              <button
                type="button"
                className={`model-picker-btn create-expert-picker-control create-expert-model-picker-trigger ${!modelId ? "is-empty" : ""} ${
                  isModelModalOpen && modelModalAnchor === "create-model" ? "is-open" : ""
                } ${isModelPickerLockedByCharacterMode ? "is-locked" : ""}`}
                data-model-anchor="create-model"
                disabled={isModelPickerLockedByCharacterMode || !isModelControlInteractable}
                tabIndex={isModelControlInteractable ? undefined : -1}
                aria-hidden={isModelControlInteractable ? undefined : true}
                aria-label={
                  isModelPickerLockedByCharacterMode
                    ? "Model locked while character mode is enabled"
                    : "Open model picker"
                }
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
          ) : null}
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
