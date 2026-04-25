import Image from "next/image";
import React from "react";
import { Power, Trash } from "phosphor-react";
import { AgentGenerateButton } from "../../../../prefabs/agent";
import { AspectDropdown } from "../AspectDropdown";
import { ResolutionDropdown } from "../ResolutionDropdown";
import { PromptStep } from "../PromptStep";
import { CreateExpertPresetPanel } from "./CreateExpertPresetPanel";
import type { ExpertCreateMode } from "../CreatePropertiesPanel";
import type { AspectOption } from "../../types";
import type {
  CreatePulsePresetId,
  CreatePulsePresetStartResult,
  CreatePulseResolvedPreset,
  CreatePulseSavedPreset,
} from "./createPulsePresets";

type ExpertCreatePanelViewProps = {
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
  expertCreateMode?: ExpertCreateMode;
  onExpertCreateModeChange?: (value: ExpertCreateMode) => void;
  activePulsePresetId?: CreatePulsePresetId | null;
  onActivePulsePresetIdChange?: (presetId: CreatePulsePresetId | null) => void;
  onPulsePresetStart?: (
    preset: CreatePulseResolvedPreset
  ) => Promise<CreatePulsePresetStartResult> | CreatePulsePresetStartResult;
  isPulseActivationBusy?: boolean;
  selectedPulsePresetIds?: readonly CreatePulsePresetId[];
  onSelectedPulsePresetIdsChange?: (presetIds: CreatePulsePresetId[]) => void;
  savedPulsePresets?: readonly CreatePulseSavedPreset[];
  onSavedPulsePresetsChange?: (presets: CreatePulseSavedPreset[]) => void;
  onOpenPresetsLibrary?: () => void;
};

export function ExpertCreatePanelView({
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
  expertCreateMode,
  onExpertCreateModeChange,
  activePulsePresetId,
  onActivePulsePresetIdChange,
  onPulsePresetStart,
  isPulseActivationBusy = false,
  selectedPulsePresetIds,
  onSelectedPulsePresetIdsChange,
  savedPulsePresets,
  onSavedPulsePresetsChange,
  onOpenPresetsLibrary,
}: ExpertCreatePanelViewProps) {
  const PULSE_RAIL_TRANSITION_MS = 220;
  const [agentInputVisualRowCount, setAgentInputVisualRowCount] = React.useState(1);
  const [uncontrolledCreateMode, setUncontrolledCreateMode] =
    React.useState<ExpertCreateMode>("standard");
  const [isPulseRailMounted, setIsPulseRailMounted] = React.useState(false);
  const [isPulseRailActive, setIsPulseRailActive] = React.useState(false);
  const createMode = expertCreateMode ?? uncontrolledCreateMode;
  const isActivePulseSession = createMode === "pulse" && Boolean(activePulsePresetId);
  const costValue = costCredits != null ? costCredits : "—";
  const modelLogoWidth = useUnoptimizedModelLogo ? 50 : 74;
  const modelLogoHeight = useUnoptimizedModelLogo ? 12 : 18;
  const inlineGuardrailReason = guardrailReason;
  const hasChatHistory = (promptStepProps.agentMessages?.length ?? 0) > 0;
  const createModeTabsStyle = React.useMemo(
    () =>
      ({
        ["--create-expert-mode-index" as string]: createMode === "pulse" ? 1 : 0,
      }) as React.CSSProperties,
    [createMode]
  );
  const createModeToggle = (
    <div className="create-expert-mode-shell">
      <div
        className="create-expert-mode-tabs"
        role="tablist"
        aria-label="Create mode"
        style={createModeTabsStyle}
      >
        <span className="create-expert-mode-indicator" aria-hidden="true" />
        <button
          type="button"
          role="tab"
          aria-selected={createMode === "standard"}
          className={`create-expert-mode-tab ${createMode === "standard" ? "is-active" : ""}`}
          onClick={() => {
            setUncontrolledCreateMode("standard");
            onExpertCreateModeChange?.("standard");
          }}
        >
          Standard
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={createMode === "pulse"}
          className={`create-expert-mode-tab ${createMode === "pulse" ? "is-active" : ""}`}
          onClick={() => {
            setUncontrolledCreateMode("pulse");
            onExpertCreateModeChange?.("pulse");
          }}
        >
          Pulse
        </button>
      </div>
    </div>
  );
  const handleClearAgentChat = promptStepProps.onClearAgentChat;
  React.useEffect(() => {
    if (createMode === "pulse") {
      setIsPulseRailMounted(true);
      let frameTwo: number | null = null;
      const frameOne = window.requestAnimationFrame(() => {
        frameTwo = window.requestAnimationFrame(() => {
          setIsPulseRailActive(true);
        });
      });
      return () => {
        window.cancelAnimationFrame(frameOne);
        if (frameTwo != null) {
          window.cancelAnimationFrame(frameTwo);
        }
      };
    }

    setIsPulseRailActive(false);
    const exitTimeout = window.setTimeout(() => {
      setIsPulseRailMounted(false);
    }, PULSE_RAIL_TRANSITION_MS);
    return () => {
      window.clearTimeout(exitTimeout);
    };
  }, [createMode]);
  const promptStepLayoutProps: React.ComponentProps<typeof PromptStep> = {
    ...promptStepProps,
    hideEmptyAgentChatState: true,
    emptyAgentChatSpacerClassName: hasChatHistory ? "" : "create-expert-chat-spacer",
    onAgentInputVisualRowCountChange: setAgentInputVisualRowCount,
    onClearAgentChat: undefined,
    composerLeadingContent: promptStepProps.composerLeadingContent,
  };
  const shouldHideReadyTitle = agentInputVisualRowCount >= 8;
  const promptAndControls = (
    <>
      {!hasChatHistory ? (
        <>
          <div className="create-expert-empty-preview-frame" aria-hidden="true" />
          <p
            className={`create-expert-ready-text ${shouldHideReadyTitle ? "is-hidden" : ""}`.trim()}
          >
            What do you want to make?
          </p>
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
                  <span className="model-picker-name">{selectedCharacterName}</span>
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
              disabled={isGenerateDisabled || isPromptGenerating}
              isBusy={isPromptGenerating}
              cost={costValue}
            />
            {isGenerateDisabled && inlineGuardrailReason ? (
              <div className="inline-warning-hint">{inlineGuardrailReason}</div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div
      className={`tool-properties text-properties-panel create-expert-panel ${!hasChatHistory ? "create-expert-panel--no-history" : ""}`.trim()}
      role="group"
      aria-label="Expert create composer"
    >
      <div className="tool-header">
        <p className="eyebrow">Create</p>
      </div>
      <div
        className={`create-expert-panel-shell ${
          isPulseRailActive ? "is-pulse-rail-active" : "is-pulse-rail-inactive"
        }`.trim()}
      >
        {isPulseRailMounted ? (
          <div
            className={`create-expert-left-panel ${
              isPulseRailActive ? "is-pulse-active" : "is-pulse-inactive"
            }`.trim()}
            aria-hidden={!isPulseRailActive}
          >
            <div className="create-expert-left-panel-inner">
              <CreateExpertPresetPanel
                selectedPresetIds={selectedPulsePresetIds}
                onSelectedPresetIdsChange={onSelectedPulsePresetIdsChange}
                activePresetId={activePulsePresetId}
                onActivePresetIdChange={onActivePulsePresetIdChange}
                onPresetStart={onPulsePresetStart}
                isActivationBusy={isPulseActivationBusy}
                savedPresets={savedPulsePresets}
                onSavedPresetsChange={onSavedPulsePresetsChange}
                onOpenPresetsLibrary={onOpenPresetsLibrary}
              />
            </div>
          </div>
        ) : null}
        <div className="create-expert-right-panel">
          <div className="create-expert-right-panel-inner">
            <div className="create-expert-right-panel-topbar">
              <div className="create-expert-right-panel-topbar-center">{createModeToggle}</div>
              {handleClearAgentChat ? (
                <button
                  type="button"
                  className="create-expert-topbar-clear-btn"
                  onClick={handleClearAgentChat}
                  aria-label={isActivePulseSession ? "Deactivate pulse" : "Clear chat"}
                >
                  {isActivePulseSession ? (
                    <Power size={14} weight="bold" aria-hidden />
                  ) : (
                    <Trash size={14} weight="bold" aria-hidden />
                  )}
                  <span>{isActivePulseSession ? "Deactivate Pulse" : "Clear"}</span>
                </button>
              ) : null}
            </div>
            {!hasChatHistory ? (
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
