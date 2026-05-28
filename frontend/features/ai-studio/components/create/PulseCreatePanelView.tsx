import React from "react";
import { Power, Trash } from "phosphor-react";
import type { AgentPulseWorkflowSession } from "../../../../prefabs/agent";
import type { AiStudioPulsePresetChangeOptions } from "../../hooks/useAiStudioCreateModeRuntime";
import { PulsePromptStep } from "../PulsePromptStep";
import { CreatePulsePresetPanel } from "./CreatePulsePresetPanel";
import {
  CreatePulsePreferenceProvider,
  useCreatePulsePreferenceRuntime,
} from "./CreatePulsePreferenceProvider";
import { resolveCreateComposerNoHistoryShell } from "./createComposerEmptyState";
import type { CreatePulsePreferenceRuntimeValue } from "./createPulsePreferenceRuntime";
import type {
  CreatePulsePresetId,
  CreatePulsePresetStartResult,
  CreatePulseResolvedPreset,
} from "./createPulsePresets";

type PulseCreatePanelViewProps = {
  promptStepProps: React.ComponentProps<typeof PulsePromptStep>;
  isPromptGenerating: boolean;
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
      deferWorkflowSessionCommit?: boolean;
      allowInterruptCurrentPulse?: boolean;
    }
  ) => Promise<CreatePulsePresetStartResult | void> | CreatePulsePresetStartResult | void;
  onPulsePresetRestart?: (preset: CreatePulseResolvedPreset) => Promise<void> | void;
  isPulseActivationBusy?: boolean;
  onOpenPresetsLibrary?: () => void;
  pulsePreferenceRuntime?: CreatePulsePreferenceRuntimeValue;
};

const PulseCreatePanelViewContent = ({
  promptStepProps,
  isPromptGenerating,
  createModeToggle = null,
  activePulsePresetId,
  hasActivePulseSession = Boolean(activePulsePresetId),
  onActivePulsePresetIdChange,
  onPulsePresetStart,
  isPulseActivationBusy = false,
  onOpenPresetsLibrary,
  pulsePreferenceRuntime,
}: PulseCreatePanelViewProps & {
  pulsePreferenceRuntime: CreatePulsePreferenceRuntimeValue;
}) => {
  const {
    presetPanelIds: selectedPulsePresetIds,
    setPresetPanelIds: onSelectedPulsePresetIdsChange,
    savedPresets: savedPulsePresets,
    builtInDefinitions,
    refreshBuiltInDefinitions,
    setSavedPresets: onSavedPulsePresetsChange,
  } = pulsePreferenceRuntime;
  const [agentInputVisualRowCount, setAgentInputVisualRowCount] = React.useState(1);
  const isActivePulseSession = hasActivePulseSession;
  const hasVisibleAgentMessages = (promptStepProps.agentMessages?.length ?? 0) > 0;
  const pulseLoadingState = promptStepProps.pulseLoadingState ?? null;
  const hasPulseLoadingSurface = pulseLoadingState != null;
  const isNoHistoryShell = resolveCreateComposerNoHistoryShell({
    hasVisibleAgentMessages,
  });
  const shouldShowPulseStartupShell =
    isNoHistoryShell && pulseLoadingState?.phase === "starting_pulse";
  const shouldShowPersistentEmptyShell = isNoHistoryShell && !hasPulseLoadingSurface;
  const handleClearAgentChat = promptStepProps.onClearAgentChat;
  const isPulseSessionLocked = isPulseActivationBusy || isPromptGenerating;
  const shouldRestartActivePreset = React.useCallback(
    (presetId: CreatePulsePresetId) =>
      presetId === activePulsePresetId &&
      isActivePulseSession &&
      !hasVisibleAgentMessages &&
      !hasPulseLoadingSurface,
    [activePulsePresetId, hasPulseLoadingSurface, hasVisibleAgentMessages, isActivePulseSession]
  );
  const promptStepLayoutProps: React.ComponentProps<typeof PulsePromptStep> = {
    ...promptStepProps,
    hideEmptyAgentChatState: true,
    forceRenderAgentChatPanel: !isNoHistoryShell && !shouldShowPulseStartupShell,
    emptyAgentChatSpacerClassName: shouldShowPersistentEmptyShell
      ? "create-composer-chat-spacer"
      : "",
    onAgentInputVisualRowCountChange: setAgentInputVisualRowCount,
    onClearAgentChat: undefined,
  };
  const shouldHideReadyTitle = agentInputVisualRowCount >= 8;

  const promptAndControls = (
    <>
      {shouldShowPulseStartupShell ? (
        <div
          className="create-composer-pulse-start-shell"
          role="status"
          aria-live="polite"
          aria-label={`Starting ${pulseLoadingState.presetLabel ?? "Pulse"}`}
        >
          <div className="create-composer-pulse-start-shell-badge">
            <span className="create-composer-pulse-start-shell-badge-dot" aria-hidden="true" />
            <span className="create-composer-pulse-start-shell-badge-label">
              {pulseLoadingState.presetLabel ?? "Pulse"}
            </span>
          </div>
          <div className="create-composer-pulse-start-shell-card">
            <span className="create-composer-pulse-start-shell-spinner" aria-hidden="true" />
            <div className="create-composer-pulse-start-shell-copy">
              <p className="create-composer-pulse-start-shell-title">Starting Pulse</p>
            </div>
          </div>
        </div>
      ) : null}
      {shouldShowPersistentEmptyShell ? (
        <>
          <div className="create-composer-empty-preview-frame" aria-hidden="true" />
          <div className="create-composer-ready-row" aria-hidden={shouldHideReadyTitle}>
            <p
              className={`create-composer-ready-text ${shouldHideReadyTitle ? "is-hidden" : ""}`.trim()}
            >
              What do you want to make?
            </p>
          </div>
          <div className="create-composer-lower-preview-frame" aria-hidden="true" />
        </>
      ) : null}
      <div className="create-composer-bottom-block">
        <PulsePromptStep {...promptStepLayoutProps} />
      </div>
    </>
  );

  return (
    <div
      className={`tool-properties text-properties-panel create-composer-panel ${isNoHistoryShell ? "create-composer-panel--no-history" : ""}`.trim()}
      role="group"
      aria-label="Create composer"
    >
      <div className="tool-header">
        <p className="eyebrow">Create</p>
      </div>
      <div className="create-composer-panel-shell is-pulse-rail-active">
        <div className="create-composer-left-panel is-pulse-active">
          <div className="create-composer-left-panel-inner">
            <CreatePulsePresetPanel
              selectedPresetIds={selectedPulsePresetIds}
              onSelectedPresetIdsChange={onSelectedPulsePresetIdsChange}
              activePresetId={activePulsePresetId}
              onActivePresetIdChange={onActivePulsePresetIdChange}
              onPresetStart={onPulsePresetStart}
              isActivationBusy={isPulseSessionLocked}
              builtInDefinitions={builtInDefinitions}
              refreshBuiltInDefinitions={refreshBuiltInDefinitions}
              savedPresets={savedPulsePresets}
              onSavedPresetsChange={onSavedPulsePresetsChange}
              onOpenPresetsLibrary={onOpenPresetsLibrary}
              shouldRestartActivePreset={shouldRestartActivePreset}
            />
          </div>
        </div>
        <div className="create-composer-right-panel">
          <div className="create-composer-right-panel-inner">
            <div className="create-composer-right-panel-topbar">
              <div className="create-composer-right-panel-topbar-center">{createModeToggle}</div>
              <div className="create-composer-topbar-actions">
                {handleClearAgentChat ? (
                  <button
                    type="button"
                    className="create-composer-topbar-clear-btn"
                    onClick={handleClearAgentChat}
                    aria-label={isActivePulseSession ? "Deactivate pulse" : "Clear chat"}
                    disabled={isPulseSessionLocked}
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
            </div>
            {isNoHistoryShell ? (
              <div className="create-composer-empty-state-shell">{promptAndControls}</div>
            ) : (
              <div className="create-composer-flow-shell">{promptAndControls}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const PulseCreatePanelViewContentWithProvider = (props: PulseCreatePanelViewProps) => {
  const pulsePreferenceRuntime = useCreatePulsePreferenceRuntime();
  return <PulseCreatePanelViewContent {...props} pulsePreferenceRuntime={pulsePreferenceRuntime} />;
};

export function PulseCreatePanelView(props: PulseCreatePanelViewProps) {
  if (props.pulsePreferenceRuntime) {
    return (
      <PulseCreatePanelViewContent
        {...props}
        pulsePreferenceRuntime={props.pulsePreferenceRuntime}
      />
    );
  }
  return (
    <CreatePulsePreferenceProvider>
      <PulseCreatePanelViewContentWithProvider {...props} />
    </CreatePulsePreferenceProvider>
  );
}
