import React from "react";
import { Power, Trash } from "phosphor-react";
import { AgentGenerateButton } from "../../../../prefabs/agent";
import type { AgentPulseWorkflowSession } from "../../../../prefabs/agent";
import type { AiStudioPulsePresetChangeOptions } from "../../hooks/useAiStudioCreateModeRuntime";
import { PulsePromptStep } from "../PulsePromptStep";
import { CreateExpertPresetPanel } from "./CreateExpertPresetPanel";
import {
  CreatePulsePreferenceProvider,
  useCreatePulsePreferenceRuntime,
} from "./CreatePulsePreferenceProvider";
import type {
  CreatePulsePresetId,
  CreatePulsePresetStartResult,
  CreatePulseResolvedPreset,
} from "./createPulsePresets";

type PulseCreatePanelViewProps = {
  promptStepProps: React.ComponentProps<typeof PulsePromptStep>;
  onGenerate: () => void;
  costCredits?: number | null;
  isPromptGenerating: boolean;
  isGenerateDisabled: boolean;
  guardrailReason?: string | null;
  createModeToggle?: React.ReactNode;
  activePulsePresetId?: CreatePulsePresetId | null;
  hasActivePulseSession?: boolean;
  pulseWorkflowSession?: AgentPulseWorkflowSession | null;
  onActivePulsePresetIdChange?: (
    presetId: CreatePulsePresetId | null,
    options?: AiStudioPulsePresetChangeOptions
  ) => string | null | void;
  onPulsePresetStart?: (
    preset: CreatePulseResolvedPreset,
    options?: {
      pulseSessionInstanceId?: string | null;
    }
  ) => Promise<CreatePulsePresetStartResult | void> | CreatePulsePresetStartResult | void;
  isPulseActivationBusy?: boolean;
  onOpenPresetsLibrary?: () => void;
};

const PulseCreatePanelViewContent = ({
  promptStepProps,
  onGenerate,
  costCredits,
  isPromptGenerating,
  isGenerateDisabled,
  guardrailReason,
  createModeToggle = null,
  activePulsePresetId,
  hasActivePulseSession = Boolean(activePulsePresetId),
  onActivePulsePresetIdChange,
  onPulsePresetStart,
  isPulseActivationBusy = false,
  onOpenPresetsLibrary,
}: PulseCreatePanelViewProps) => {
  const {
    presetPanelIds: selectedPulsePresetIds,
    setPresetPanelIds: onSelectedPulsePresetIdsChange,
    savedPresets: savedPulsePresets,
    setSavedPresets: onSavedPulsePresetsChange,
  } = useCreatePulsePreferenceRuntime();
  const [agentInputVisualRowCount, setAgentInputVisualRowCount] = React.useState(1);
  const isActivePulseSession = hasActivePulseSession;
  const hasVisibleAgentMessages = (promptStepProps.agentMessages?.length ?? 0) > 0;
  const hasPulseLoadingSurface = promptStepProps.pulseLoadingState != null;
  const shouldShowPersistentEmptyShell = !hasVisibleAgentMessages && !hasPulseLoadingSurface;
  const costValue = costCredits != null ? costCredits : "—";
  const handleClearAgentChat = promptStepProps.onClearAgentChat;
  const promptStepLayoutProps: React.ComponentProps<typeof PulsePromptStep> = {
    ...promptStepProps,
    hideEmptyAgentChatState: true,
    forceRenderAgentChatPanel: !shouldShowPersistentEmptyShell,
    emptyAgentChatSpacerClassName: shouldShowPersistentEmptyShell
      ? "create-expert-chat-spacer"
      : "",
    onAgentInputVisualRowCountChange: setAgentInputVisualRowCount,
    onClearAgentChat: undefined,
    composerLeadingContent: null,
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
        <PulsePromptStep {...promptStepLayoutProps} />
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
      <div className="create-expert-panel-shell is-pulse-rail-active">
        <div className="create-expert-left-panel is-pulse-active">
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
};

export function PulseCreatePanelView(props: PulseCreatePanelViewProps) {
  return (
    <CreatePulsePreferenceProvider>
      <PulseCreatePanelViewContent {...props} />
    </CreatePulsePreferenceProvider>
  );
}
