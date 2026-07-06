import React from "react";
import { Power, Trash } from "phosphor-react";
import type { AgentPulseWorkflowSession } from "../../../../prefabs/agent";
import type { AiStudioPulsePresetChangeOptions } from "../../hooks/useAiStudioCreateModeRuntime";
import { PULSE_BUSY_ATTACHMENT_DROP_NOTICE, PulsePromptStep } from "../PulsePromptStep";
import {
  resolveAgentComposerPanelDropKind,
  resolveAgentComposerTextDropInsertion,
  resolveDroppedPromptTextEdit,
  resolveDroppedPromptTextEditMode,
  useAgentComposerPromptDropModifierTracking,
} from "../promptStep/agentComposerDrop";
import type { CanvasTearOutComposerTargetRegistry } from "../../hooks/useAiStudioCanvasTearOutTargets";
import type { AgentComposerDirectDropPayload } from "../../logic/agentComposerDirectDropPayload";
import { CreatePulsePresetPanel } from "./CreatePulsePresetPanel";
import { PulseChatHistoryPanel, type PulseChatHistoryPanelProps } from "./PulseChatHistoryPanel";
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
  canvasTearOutTargetRegistry?: CanvasTearOutComposerTargetRegistry;
  onAgentComposerDirectDrop?: (payload: AgentComposerDirectDropPayload) => void;
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
  pulseChatHistory?: PulseChatHistoryPanelProps;
};

const PulseCreatePanelViewContent = ({
  promptStepProps,
  canvasTearOutTargetRegistry,
  onAgentComposerDirectDrop,
  isPromptGenerating,
  createModeToggle = null,
  activePulsePresetId,
  hasActivePulseSession = Boolean(activePulsePresetId),
  onActivePulsePresetIdChange,
  onPulsePresetStart,
  isPulseActivationBusy = false,
  onOpenPresetsLibrary,
  pulsePreferenceRuntime,
  pulseChatHistory,
}: PulseCreatePanelViewProps & {
  pulsePreferenceRuntime: CreatePulsePreferenceRuntimeValue;
}) => {
  useAgentComposerPromptDropModifierTracking();

  const {
    presetPanelIds: selectedPulsePresetIds,
    setPresetPanelIds: onSelectedPulsePresetIdsChange,
    savedPresets: savedPulsePresets,
    builtInDefinitions,
    builtInDefinitionsLoading,
    builtInDefinitionsAuthoritative,
    refreshBuiltInDefinitions,
    setSavedPresets: onSavedPulsePresetsChange,
  } = pulsePreferenceRuntime;
  const [agentInputVisualRowCount, setAgentInputVisualRowCount] = React.useState(1);
  const [canvasTearOutActive, setCanvasTearOutActive] = React.useState(false);
  const [busyAttachmentDropNoticeVisible, setBusyAttachmentDropNoticeVisible] =
    React.useState(false);
  const panelRootRef = React.useRef<HTMLDivElement>(null);
  const panelBodyRef = React.useRef<HTMLDivElement>(null);
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
  const hasPreparingPulseImageAttachment = Boolean(
    promptStepProps.stagedAttachments?.some(
      (attachment) =>
        attachment.kind === "image" && (attachment.deliveryStatus ?? "pending") === "preparing"
    )
  );
  const isPulseAttachmentIntakeBusy =
    Boolean(promptStepProps.agentIsSending) ||
    Boolean(promptStepProps.pulseLoadingState) ||
    hasPreparingPulseImageAttachment;
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
    agentError: busyAttachmentDropNoticeVisible
      ? PULSE_BUSY_ATTACHMENT_DROP_NOTICE
      : promptStepProps.agentError,
    hideEmptyAgentChatState: true,
    forceRenderAgentChatPanel: !isNoHistoryShell && !shouldShowPulseStartupShell,
    emptyAgentChatSpacerClassName: shouldShowPersistentEmptyShell
      ? "create-composer-chat-spacer"
      : "",
    onAgentInputVisualRowCountChange: setAgentInputVisualRowCount,
    onClearAgentChat: undefined,
  };
  const shouldHideReadyTitle = agentInputVisualRowCount >= 8;
  React.useEffect(() => {
    if (!isPulseAttachmentIntakeBusy) {
      setBusyAttachmentDropNoticeVisible(false);
    }
  }, [isPulseAttachmentIntakeBusy]);
  const handleCanvasTearOutTextDrop = React.useCallback(
    (text: string) => {
      const composerText = promptStepProps.agentInput ?? "";
      const panelNode = panelBodyRef.current;
      const textarea = panelNode?.querySelector("textarea") as HTMLTextAreaElement | null;
      const useTextareaSelection =
        typeof document !== "undefined" && textarea ? document.activeElement === textarea : false;
      const selectionStart =
        useTextareaSelection && textarea ? textarea.selectionStart : composerText.length;
      const selectionEnd =
        useTextareaSelection && textarea ? textarea.selectionEnd : composerText.length;
      const insertedPrompt = resolveDroppedPromptTextEdit({
        composerText,
        droppedPromptText: text,
        editMode: "replace",
        selectionStart,
        selectionEnd,
      });
      promptStepProps.onAgentInputChange?.(insertedPrompt.prompt);
      requestAnimationFrame(() => {
        const nextTextarea =
          textarea && textarea.isConnected
            ? textarea
            : (panelNode?.querySelector("textarea") as HTMLTextAreaElement | null);
        nextTextarea?.focus();
        nextTextarea?.setSelectionRange(insertedPrompt.caret, insertedPrompt.caret);
      });
    },
    [promptStepProps]
  );
  const canAcceptCanvasTearOutPayload = React.useCallback(
    (payload: AgentComposerDirectDropPayload) => {
      if (isPulseAttachmentIntakeBusy) return false;
      if (payload.kind === "unsupported") return false;
      if (payload.kind === "image") return Boolean(onAgentComposerDirectDrop);
      if (payload.kind !== "text") return false;
      return Boolean(payload.text.trim() && promptStepProps.onAgentInputChange);
    },
    [isPulseAttachmentIntakeBusy, onAgentComposerDirectDrop, promptStepProps]
  );
  const acceptCanvasTearOutPayload = React.useCallback(
    (payload: AgentComposerDirectDropPayload) => {
      if (!canAcceptCanvasTearOutPayload(payload)) return;
      if (payload.kind === "text") {
        handleCanvasTearOutTextDrop(payload.text);
        return;
      }
      if (payload.kind === "image") {
        onAgentComposerDirectDrop?.(payload);
      }
    },
    [canAcceptCanvasTearOutPayload, handleCanvasTearOutTextDrop, onAgentComposerDirectDrop]
  );
  React.useEffect(() => {
    if (!canvasTearOutTargetRegistry) return;
    return canvasTearOutTargetRegistry.registerTarget({
      id: "pulse-create-composer",
      element: panelRootRef.current,
      canAccept: canAcceptCanvasTearOutPayload,
      accept: acceptCanvasTearOutPayload,
      setActive: setCanvasTearOutActive,
    });
  }, [acceptCanvasTearOutPayload, canAcceptCanvasTearOutPayload, canvasTearOutTargetRegistry]);
  const isTargetInsideComposerInputShell = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) =>
      event.target instanceof Element &&
      Boolean(event.target.closest(".agent-composer-input-shell")),
    []
  );
  const blockBusyPanelMediaDrop = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "none";
      setBusyAttachmentDropNoticeVisible(true);
      promptStepProps.onAgentAttachmentDragLeave?.(event);
    },
    [promptStepProps]
  );
  const handlePanelMediaDragEnter = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (isTargetInsideComposerInputShell(event)) return;
      if (resolveAgentComposerPanelDropKind(event.dataTransfer) === "none") return;
      if (isPulseAttachmentIntakeBusy) {
        blockBusyPanelMediaDrop(event);
        return;
      }
      promptStepProps.onAgentAttachmentDragEnter?.(event);
    },
    [
      blockBusyPanelMediaDrop,
      isPulseAttachmentIntakeBusy,
      isTargetInsideComposerInputShell,
      promptStepProps,
    ]
  );
  const handlePanelMediaDragOver = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (isTargetInsideComposerInputShell(event)) return;
      if (resolveAgentComposerPanelDropKind(event.dataTransfer) === "none") return;
      if (isPulseAttachmentIntakeBusy) {
        blockBusyPanelMediaDrop(event);
        return;
      }
      promptStepProps.onAgentAttachmentDragOver?.(event);
    },
    [
      blockBusyPanelMediaDrop,
      isPulseAttachmentIntakeBusy,
      isTargetInsideComposerInputShell,
      promptStepProps,
    ]
  );
  const handlePanelMediaDragLeave = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (isTargetInsideComposerInputShell(event)) return;
      if (!promptStepProps.agentDropActive) return;
      promptStepProps.onAgentAttachmentDragLeave?.(event);
    },
    [isTargetInsideComposerInputShell, promptStepProps]
  );
  const handlePanelMediaDrop = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (isTargetInsideComposerInputShell(event)) return;
      const panelDropKind = resolveAgentComposerPanelDropKind(event.dataTransfer);
      if (panelDropKind === "none") return;
      if (isPulseAttachmentIntakeBusy) {
        blockBusyPanelMediaDrop(event);
        return;
      }
      if (panelDropKind === "text") {
        event.preventDefault();
        event.stopPropagation();
        promptStepProps.onAgentAttachmentDragLeave?.(event);
        const composerText = promptStepProps.agentInput ?? "";
        const textarea = event.currentTarget.querySelector(
          "textarea"
        ) as HTMLTextAreaElement | null;
        const insertedPrompt = resolveAgentComposerTextDropInsertion({
          transfer: event.dataTransfer,
          composerText,
          selectionStart: textarea?.selectionStart ?? composerText.length,
          selectionEnd: textarea?.selectionEnd ?? textarea?.selectionStart ?? composerText.length,
          editMode: resolveDroppedPromptTextEditMode(event),
        });
        if (!insertedPrompt) return;
        promptStepProps.onAgentInputChange?.(insertedPrompt.prompt);
        const panelNode = event.currentTarget;
        requestAnimationFrame(() => {
          const nextTextarea =
            textarea && textarea.isConnected
              ? textarea
              : (panelNode.querySelector("textarea") as HTMLTextAreaElement | null);
          nextTextarea?.focus();
          nextTextarea?.setSelectionRange(insertedPrompt.caret, insertedPrompt.caret);
        });
        return;
      }
      promptStepProps.onAgentAttachmentDrop?.(event);
    },
    [
      blockBusyPanelMediaDrop,
      isPulseAttachmentIntakeBusy,
      isTargetInsideComposerInputShell,
      promptStepProps,
    ]
  );

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
              <p className="create-composer-pulse-start-shell-subtitle">
                Getting the first response ready.
              </p>
            </div>
          </div>
        </div>
      ) : null}
      {shouldShowPersistentEmptyShell ? (
        <>
          <div className="create-composer-empty-preview-frame" aria-hidden="true" />
          <div className="create-composer-empty-center-stack">
            <div className="create-composer-ready-row" aria-hidden={shouldHideReadyTitle}>
              <p
                className={`create-composer-ready-text ${shouldHideReadyTitle ? "is-hidden" : ""}`.trim()}
              >
                Choose a Pulse to start
              </p>
            </div>
            <div className="create-composer-lower-preview-frame" aria-hidden="true" />
            <div className="create-composer-bottom-block">
              <PulsePromptStep {...promptStepLayoutProps} />
            </div>
          </div>
        </>
      ) : (
        <div className="create-composer-bottom-block">
          <PulsePromptStep {...promptStepLayoutProps} />
        </div>
      )}
    </>
  );

  return (
    <div
      ref={panelRootRef}
      className={`tool-properties text-properties-panel create-composer-panel is-pulse-rail-active ${
        isNoHistoryShell ? "create-composer-panel--no-history" : ""
      }`.trim()}
      role="group"
      aria-label="Create composer"
    >
      <div className="tool-header">
        <p className="eyebrow">Create</p>
      </div>
      <div className="create-composer-pulse-columns">
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
              isBuiltInCatalogLoading={builtInDefinitionsLoading}
              isBuiltInCatalogAuthoritative={builtInDefinitionsAuthoritative}
              savedPresets={savedPulsePresets}
              onSavedPresetsChange={onSavedPulsePresetsChange}
              onOpenPresetsLibrary={onOpenPresetsLibrary}
              shouldRestartActivePreset={shouldRestartActivePreset}
            />
            {pulseChatHistory ? <PulseChatHistoryPanel {...pulseChatHistory} /> : null}
          </div>
        </div>
        <div className="create-composer-right-panel">
          <div
            ref={panelBodyRef}
            className={`create-composer-right-panel-inner ${
              promptStepProps.agentDropActive || canvasTearOutActive ? "is-drop-active" : ""
            }`.trim()}
            onDragEnter={handlePanelMediaDragEnter}
            onDragOver={handlePanelMediaDragOver}
            onDragLeave={handlePanelMediaDragLeave}
            onDrop={handlePanelMediaDrop}
          >
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
