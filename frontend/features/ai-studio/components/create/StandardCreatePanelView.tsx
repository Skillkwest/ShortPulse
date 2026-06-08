import Image from "next/image";
import React from "react";
import { Trash } from "phosphor-react";
import { AppMessage } from "../../../../components/AppMessage";
import { AspectDropdown } from "../AspectDropdown";
import { ResolutionDropdown } from "../ResolutionDropdown";
import { PromptStep } from "../PromptStep";
import {
  insertDroppedPromptTextAtSelection,
  resolveAgentComposerPanelDropKind,
  resolveAgentComposerTextDropInsertion,
} from "../promptStep/agentComposerDrop";
import type { CanvasTearOutComposerTargetRegistry } from "../../hooks/useAiStudioCanvasTearOutTargets";
import type { AgentComposerDirectDropPayload } from "../../logic/agentComposerDirectDropPayload";
import type { AspectOption } from "../../types";
import {
  resolveCreateComposerInlineGuardrailReason,
  resolveCreateComposerNoHistoryShell,
} from "./createComposerEmptyState";

type StandardCreatePanelViewProps = {
  promptStepProps: React.ComponentProps<typeof PromptStep>;
  canvasTearOutTargetRegistry?: CanvasTearOutComposerTargetRegistry;
  onAgentComposerDirectDrop?: (payload: AgentComposerDirectDropPayload) => void;
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
  showCreateControlSet: boolean;
  shouldShowImageResolutionCard: boolean;
  imageResolutionValue: string;
  imageResolutionOptions: Array<{ value: string; label: string }>;
  onImageResolutionChange?: (value: string) => void;
  guardrailReason?: string | null;
  createModeToggle?: React.ReactNode;
};

export function StandardCreatePanelView({
  promptStepProps,
  canvasTearOutTargetRegistry,
  onAgentComposerDirectDrop,
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
  showCreateControlSet,
  shouldShowImageResolutionCard,
  imageResolutionValue,
  imageResolutionOptions,
  onImageResolutionChange,
  guardrailReason = null,
  createModeToggle = null,
}: StandardCreatePanelViewProps) {
  const resolvedSelectedCharacterDisplayName =
    selectedCharacterDisplayName ?? selectedCharacterName;
  const [agentInputVisualRowCount, setAgentInputVisualRowCount] = React.useState(1);
  const [canvasTearOutActive, setCanvasTearOutActive] = React.useState(false);
  const panelRootRef = React.useRef<HTMLDivElement>(null);
  const panelBodyRef = React.useRef<HTMLDivElement>(null);
  const [restoreAgentInputAfterShellSwap, setRestoreAgentInputAfterShellSwap] =
    React.useState(false);
  const hasVisibleAgentMessages = (promptStepProps.agentMessages?.length ?? 0) > 0;
  const shouldShowPersistentEmptyShell = resolveCreateComposerNoHistoryShell({
    hasVisibleAgentMessages,
  });
  const inlineGuardrailReason = resolveCreateComposerInlineGuardrailReason(guardrailReason);
  const modelLogoWidth = useUnoptimizedModelLogo ? 50 : 74;
  const modelLogoHeight = useUnoptimizedModelLogo ? 12 : 18;
  const handleClearAgentChat = promptStepProps.onClearAgentChat;
  const handleAgentSend = React.useCallback(() => {
    if (shouldShowPersistentEmptyShell) {
      setRestoreAgentInputAfterShellSwap(true);
    }
    promptStepProps.onAgentSend?.();
  }, [promptStepProps, shouldShowPersistentEmptyShell]);

  React.useEffect(() => {
    if (shouldShowPersistentEmptyShell) return;
    if (!restoreAgentInputAfterShellSwap) return;
    setRestoreAgentInputAfterShellSwap(false);
  }, [restoreAgentInputAfterShellSwap, shouldShowPersistentEmptyShell]);

  const promptStepLayoutProps: React.ComponentProps<typeof PromptStep> = {
    ...promptStepProps,
    hideEmptyAgentChatState: true,
    forceRenderAgentChatPanel: !shouldShowPersistentEmptyShell,
    emptyAgentChatSpacerClassName: shouldShowPersistentEmptyShell
      ? "create-composer-chat-spacer"
      : "",
    autoFocusAgentInputOnMount: restoreAgentInputAfterShellSwap && !shouldShowPersistentEmptyShell,
    onAgentInputVisualRowCountChange: setAgentInputVisualRowCount,
    onClearAgentChat: undefined,
    onAgentSend: handleAgentSend,
    composerMiddleContent: promptStepProps.composerMiddleContent,
    composerLeadingContent: promptStepProps.composerLeadingContent,
  };
  const shouldHideReadyTitle = agentInputVisualRowCount >= 8;
  const handleCanvasTearOutTextDrop = React.useCallback(
    (text: string) => {
      const isChatModeEnabled = promptStepProps.chatModeEnabled ?? true;
      const composerText = isChatModeEnabled
        ? (promptStepProps.agentInput ?? "")
        : promptStepProps.prompt;
      const applyComposerTextChange = isChatModeEnabled
        ? promptStepProps.onAgentInputChange
        : promptStepProps.onPromptChange;
      const panelNode = panelBodyRef.current;
      const textarea = panelNode?.querySelector("textarea") as HTMLTextAreaElement | null;
      const useTextareaSelection =
        typeof document !== "undefined" && textarea ? document.activeElement === textarea : false;
      const selectionStart =
        useTextareaSelection && textarea ? textarea.selectionStart : composerText.length;
      const selectionEnd =
        useTextareaSelection && textarea ? textarea.selectionEnd : composerText.length;
      const insertedPrompt = insertDroppedPromptTextAtSelection({
        composerText,
        droppedPromptText: text,
        selectionStart,
        selectionEnd,
      });
      applyComposerTextChange?.(insertedPrompt.prompt);
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
      if (payload.kind === "unsupported") return false;
      if (payload.kind === "image") return Boolean(onAgentComposerDirectDrop);
      if (payload.kind !== "text") return false;
      if (!payload.text.trim()) return false;
      const isChatModeEnabled = promptStepProps.chatModeEnabled ?? true;
      return Boolean(
        isChatModeEnabled ? promptStepProps.onAgentInputChange : promptStepProps.onPromptChange
      );
    },
    [onAgentComposerDirectDrop, promptStepProps]
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
      id: "standard-create-composer",
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
  const handlePanelMediaDragEnter = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (isTargetInsideComposerInputShell(event)) return;
      if (resolveAgentComposerPanelDropKind(event.dataTransfer) === "none") return;
      promptStepProps.onAgentAttachmentDragEnter?.(event);
    },
    [isTargetInsideComposerInputShell, promptStepProps]
  );
  const handlePanelMediaDragOver = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (isTargetInsideComposerInputShell(event)) return;
      if (resolveAgentComposerPanelDropKind(event.dataTransfer) === "none") return;
      promptStepProps.onAgentAttachmentDragOver?.(event);
    },
    [isTargetInsideComposerInputShell, promptStepProps]
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
      if (panelDropKind === "text") {
        event.preventDefault();
        event.stopPropagation();
        promptStepProps.onAgentAttachmentDragLeave?.(event);
        const isChatModeEnabled = promptStepProps.chatModeEnabled ?? true;
        const composerText = isChatModeEnabled
          ? (promptStepProps.agentInput ?? "")
          : promptStepProps.prompt;
        const applyComposerTextChange = isChatModeEnabled
          ? promptStepProps.onAgentInputChange
          : promptStepProps.onPromptChange;
        const textarea = event.currentTarget.querySelector(
          "textarea"
        ) as HTMLTextAreaElement | null;
        const insertedPrompt = resolveAgentComposerTextDropInsertion({
          transfer: event.dataTransfer,
          composerText,
          selectionStart: textarea?.selectionStart ?? composerText.length,
          selectionEnd: textarea?.selectionEnd ?? textarea?.selectionStart ?? composerText.length,
        });
        if (!insertedPrompt) return;
        applyComposerTextChange?.(insertedPrompt.prompt);
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
    [isTargetInsideComposerInputShell, promptStepProps]
  );

  const promptAndControls = (
    <>
      {shouldShowPersistentEmptyShell ? (
        <>
          <div className="create-composer-empty-preview-frame" aria-hidden="true" />
          <div className="create-composer-empty-center-stack">
            <div className="create-composer-ready-row" aria-hidden={shouldHideReadyTitle}>
              <p
                className={`create-composer-ready-text ${shouldHideReadyTitle ? "is-hidden" : ""}`.trim()}
              >
                What do you want to make?
              </p>
            </div>
            <div className="create-composer-lower-preview-frame" aria-hidden="true" />
            <div className="create-composer-bottom-block">
              <PromptStep {...promptStepLayoutProps} />
              {showCreateControlSet && inlineGuardrailReason ? (
                <AppMessage
                  className="create-composer-inline-warning-bubble"
                  tone="warning"
                  mode="inline"
                  message={inlineGuardrailReason}
                  role="status"
                  ariaLive="polite"
                />
              ) : null}
              {showCreateControlSet ? (
                <div className="create-composer-secondary-row create-composer-controls-row">
                  <div className="create-composer-controls">
                    <div
                      className={`create-composer-control create-composer-character-mode-control ${
                        characterModeEnabled ? "is-character-mode-on" : "is-character-mode-off"
                      }`}
                    >
                      <div className="create-composer-character-mode-meta">
                        <span className="create-composer-character-mode-title">Character</span>
                        <button
                          type="button"
                          className={`audio-toggle ai-character-mode-toggle create-composer-toggle-control ${
                            characterModeEnabled ? "is-active" : ""
                          }`}
                          aria-pressed={characterModeEnabled}
                          aria-label={
                            characterModeEnabled
                              ? "Disable character mode"
                              : "Enable character mode"
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
                      <div className="create-composer-control create-composer-character-picker-control">
                        <button
                          type="button"
                          className={`model-picker-btn create-composer-picker-control create-composer-character-picker-trigger ${
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
                          <span className="model-picker-name">
                            {resolvedSelectedCharacterDisplayName}
                          </span>
                        </button>
                      </div>
                    ) : null}
                    <div className="create-composer-control create-composer-model-control">
                      <span className="create-composer-control-label">Model</span>
                      <button
                        type="button"
                        className={`model-picker-btn create-composer-picker-control create-composer-model-picker-trigger ${
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
                            style={{ width: "auto" }}
                          />
                        ) : null}
                        <span className="model-picker-name">{effectiveModelLabel}</span>
                      </button>
                    </div>
                    <div className="create-composer-control create-composer-aspect-control">
                      <span className="create-composer-control-label">Aspect</span>
                      <AspectDropdown
                        aspect={aspect}
                        onSelect={onAspectChange}
                        options={aspectOptionsForModel}
                      />
                    </div>
                    {shouldShowImageResolutionCard ? (
                      <div className="create-composer-control create-composer-resolution-control">
                        <span className="create-composer-control-label">Resolution</span>
                        <ResolutionDropdown
                          value={imageResolutionValue}
                          options={imageResolutionOptions}
                          onSelect={onImageResolutionChange}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </>
      ) : (
        <div className="create-composer-bottom-block">
          <PromptStep {...promptStepLayoutProps} />
          {showCreateControlSet ? (
            <div className="create-composer-secondary-row create-composer-controls-row">
              <div className="create-composer-controls">
                <div
                  className={`create-composer-control create-composer-character-mode-control ${
                    characterModeEnabled ? "is-character-mode-on" : "is-character-mode-off"
                  }`}
                >
                  <div className="create-composer-character-mode-meta">
                    <span className="create-composer-character-mode-title">Character</span>
                    <button
                      type="button"
                      className={`audio-toggle ai-character-mode-toggle create-composer-toggle-control ${
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
                  <div className="create-composer-control create-composer-character-picker-control">
                    <button
                      type="button"
                      className={`model-picker-btn create-composer-picker-control create-composer-character-picker-trigger ${
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
                      <span className="model-picker-name">
                        {resolvedSelectedCharacterDisplayName}
                      </span>
                    </button>
                  </div>
                ) : null}
                <div className="create-composer-control create-composer-model-control">
                  <span className="create-composer-control-label">Model</span>
                  <button
                    type="button"
                    className={`model-picker-btn create-composer-picker-control create-composer-model-picker-trigger ${
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
                        style={{ width: "auto" }}
                      />
                    ) : null}
                    <span className="model-picker-name">{effectiveModelLabel}</span>
                  </button>
                </div>
                <div className="create-composer-control create-composer-aspect-control">
                  <span className="create-composer-control-label">Aspect</span>
                  <AspectDropdown
                    aspect={aspect}
                    onSelect={onAspectChange}
                    options={aspectOptionsForModel}
                  />
                </div>
                {shouldShowImageResolutionCard ? (
                  <div className="create-composer-control create-composer-resolution-control">
                    <span className="create-composer-control-label">Resolution</span>
                    <ResolutionDropdown
                      value={imageResolutionValue}
                      options={imageResolutionOptions}
                      onSelect={onImageResolutionChange}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </>
  );

  return (
    <div
      ref={panelRootRef}
      className={`tool-properties text-properties-panel create-composer-panel ${shouldShowPersistentEmptyShell ? "create-composer-panel--no-history" : ""}`.trim()}
      role="group"
      aria-label="Create composer"
    >
      <div className="tool-header">
        <p className="eyebrow">Create</p>
      </div>
      <div className="create-composer-panel-shell is-pulse-rail-inactive">
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
              {handleClearAgentChat ? (
                <button
                  type="button"
                  className="create-composer-topbar-clear-btn"
                  onClick={handleClearAgentChat}
                  aria-label="Clear chat"
                >
                  <Trash size={14} weight="bold" aria-hidden />
                  <span>Clear</span>
                </button>
              ) : null}
            </div>
            {shouldShowPersistentEmptyShell ? (
              <div className="create-composer-empty-state-shell">{promptAndControls}</div>
            ) : (
              <div className="create-composer-flow-shell">{promptAndControls}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
