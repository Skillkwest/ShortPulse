/**
 * Pulse PromptStep chat-mode surface.
 * Owns Pulse flow composer layout and Pulse-mode loading history chrome.
 */
import React from "react";
import { Trash } from "phosphor-react";
import { AppMessage } from "../../../../components/AppMessage";
import {
  AgentChatPanel,
  type AgentChatPanelProps,
  AgentInputBar,
  AgentSendButton,
} from "../../../../prefabs/agent";
import type {
  AgentAssistantMessageEditRequest,
  AgentAttachment,
  AgentMessage,
} from "../../../../prefabs/agent";
import { AgentComposerAttachmentStrip } from "./AgentComposerAttachmentStrip";
import { AGENT_IMAGE_ATTACHMENT_MAX_ITEMS } from "../../../../prefabs/agent/attachmentPolicy";
import type { PromptStepPulseLoadingState } from "./types";

type PulsePromptStepChatSurfaceProps = {
  chatOnly: boolean;
  promptOnly: boolean;
  enhanceOnly: boolean;
  promptMode: "enhanced" | "chat";
  setPromptMode: React.Dispatch<React.SetStateAction<"enhanced" | "chat">>;
  onClearAgentChat?: () => void;
  promptThinking: boolean;
  hideAgentIntroMessage: boolean;
  hideEmptyAgentChatState: boolean;
  forceRenderAgentChatPanel: boolean;
  emptyAgentChatSpacerClassName: string;
  agentMessages: AgentMessage[];
  introMessage: AgentMessage;
  chatHistoryHeaderContent?: React.ReactNode;
  stagedPrompt: string | null;
  stagedAttachments: AgentAttachment[];
  dropToInputComposer: boolean;
  hideInputDropHint: boolean;
  agentDropActive: boolean;
  historyDropHandlers: {
    onDrop?: (event: React.DragEvent<HTMLDivElement>) => void;
    onDragOver?: (event: React.DragEvent<HTMLDivElement>) => void;
    onDragEnter?: (event: React.DragEvent<HTMLDivElement>) => void;
    onDragLeave?: (event: React.DragEvent<HTMLDivElement>) => void;
  };
  inputDropHandlers: {
    onDrop?: (event: React.DragEvent<HTMLDivElement>) => void;
    onDragOver?: (event: React.DragEvent<HTMLDivElement>) => void;
    onDragEnter?: (event: React.DragEvent<HTMLDivElement>) => void;
    onDragLeave?: (event: React.DragEvent<HTMLDivElement>) => void;
  };
  onRemoveAgentAttachment?: (id: string) => void;
  onClearAgentAttachments?: () => void;
  onAgentInputChange?: (value: string) => void;
  agentBootstrapPending: boolean;
  agentInputDisabled: boolean;
  onAgentSend?: () => void;
  highlightLatestAssistantOnly: boolean;
  CreateChatPanel?: React.ComponentType<AgentChatPanelProps>;
  useFlowComposerLayout?: boolean;
  composerMiddleContent: React.ReactNode;
  composerLeadingContent: React.ReactNode;
  chatComposerOverlayEnabled: boolean;
  stackTrailingComposerControls: boolean;
  showComposerAttachments: boolean;
  agentInputRef: React.RefObject<HTMLTextAreaElement>;
  agentInput: string;
  handleAgentInputKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  agentInputMaxHeightPx?: number;
  agentInputCollapseOnBlur: boolean;
  agentInputVerticalExpansionAnchor: "top" | "bottom";
  onAgentInputVisualRowCountChange?: (rowCount: number) => void;
  pulseLoadingState?: PromptStepPulseLoadingState | null;
  agentError?: string;
  embedSendButtonInInput: boolean;
  handleAgentSendClick: () => void;
  agentIsSending: boolean;
  imageAttachmentCounts: {
    total: number;
    preparing: number;
    ready: number;
    failed: number;
  };
  onAssistantMessageEdit?: (request: AgentAssistantMessageEditRequest) => boolean;
};

export const PulsePromptStepChatSurface: React.FC<PulsePromptStepChatSurfaceProps> = ({
  chatOnly,
  promptOnly,
  enhanceOnly,
  promptMode,
  setPromptMode,
  onClearAgentChat,
  promptThinking,
  hideAgentIntroMessage,
  hideEmptyAgentChatState,
  forceRenderAgentChatPanel,
  emptyAgentChatSpacerClassName,
  agentMessages,
  introMessage,
  chatHistoryHeaderContent = null,
  stagedPrompt,
  stagedAttachments,
  dropToInputComposer,
  hideInputDropHint,
  agentDropActive,
  historyDropHandlers,
  inputDropHandlers,
  onRemoveAgentAttachment,
  onClearAgentAttachments,
  onAgentInputChange,
  agentBootstrapPending,
  agentInputDisabled,
  onAgentSend,
  highlightLatestAssistantOnly,
  CreateChatPanel = AgentChatPanel,
  useFlowComposerLayout = false,
  composerMiddleContent,
  composerLeadingContent,
  chatComposerOverlayEnabled,
  stackTrailingComposerControls,
  showComposerAttachments,
  agentInputRef,
  agentInput,
  handleAgentInputKeyDown,
  agentInputMaxHeightPx,
  agentInputCollapseOnBlur,
  agentInputVerticalExpansionAnchor,
  onAgentInputVisualRowCountChange,
  pulseLoadingState = null,
  agentError,
  embedSendButtonInInput,
  handleAgentSendClick,
  agentIsSending,
  imageAttachmentCounts,
  onAssistantMessageEdit,
}) => {
  const [isAgentInputExpanded, setIsAgentInputExpanded] = React.useState(false);
  const [agentInputVisualRowCount, setAgentInputVisualRowCount] = React.useState(1);
  const isPulseLoading = pulseLoadingState != null;
  const isAgentInputDisabled =
    agentBootstrapPending || agentInputDisabled || agentIsSending || isPulseLoading;
  const hasHistoryAttachments = !dropToInputComposer && stagedAttachments.length > 0;
  const hasBlockingImageAttachments =
    imageAttachmentCounts.preparing > 0 || imageAttachmentCounts.failed > 0;
  const canSendAgentInput =
    !hasBlockingImageAttachments && (agentInput.trim().length > 0 || stagedAttachments.length > 0);
  const hasInsideInputSendButton = embedSendButtonInInput;
  const hasAuxComposerControls = Boolean(composerMiddleContent) || Boolean(composerLeadingContent);
  const shouldStackTrailingComposerControls =
    stackTrailingComposerControls && hasAuxComposerControls;
  const hasAgentChatContent =
    !hideAgentIntroMessage ||
    agentMessages.length > 0 ||
    hasHistoryAttachments ||
    Boolean(stagedPrompt?.trim()) ||
    forceRenderAgentChatPanel;
  const shouldRenderAgentChatPanel = hasAgentChatContent || !hideEmptyAgentChatState;
  const shouldRenderAgentChatSpacer = !shouldRenderAgentChatPanel;
  const shouldUseComposerOverlay =
    chatComposerOverlayEnabled &&
    shouldRenderAgentChatPanel &&
    !shouldRenderAgentChatSpacer &&
    !useFlowComposerLayout;
  const shouldBlurComposerUnderlay = isAgentInputExpanded && agentInputVisualRowCount >= 8;
  const handleAgentInputVisualRowCountChange = React.useCallback(
    (rowCount: number) => {
      setAgentInputVisualRowCount(rowCount);
      onAgentInputVisualRowCountChange?.(rowCount);
    },
    [onAgentInputVisualRowCountChange]
  );

  const pulseLoadingTitle = "Generating...";
  const pulseLoadingContent = pulseLoadingState ? (
    <div
      className={`create-composer-pulse-loading-card is-${pulseLoadingState.phase.replace("_", "-")}`}
      role="status"
      aria-live="polite"
      aria-label={pulseLoadingTitle}
    >
      <span className="create-composer-pulse-loading-spinner" aria-hidden="true" />
      <div className="create-composer-pulse-loading-card-copy">
        <p className="create-composer-pulse-loading-card-title">{pulseLoadingTitle}</p>
      </div>
    </div>
  ) : null;

  const chatHistoryContent = shouldRenderAgentChatPanel ? (
    <div
      className="agent-chat-wrapper agent-chat-wrapper--inline"
      aria-busy={isPulseLoading ? true : undefined}
    >
      <CreateChatPanel
        messages={agentMessages}
        introMessage={hideAgentIntroMessage ? null : introMessage}
        input=""
        sendLabel="Send"
        isSending={promptThinking}
        showThinkingIndicator={!isPulseLoading}
        thinkingIndicatorPlacement="history"
        historyHeaderContent={chatHistoryHeaderContent}
        historyFooterContent={pulseLoadingContent}
        stagedPrompt={agentMessages.length === 0 ? stagedPrompt : null}
        stagedAttachments={dropToInputComposer ? [] : stagedAttachments}
        isDropActive={!dropToInputComposer && agentDropActive}
        showInput={false}
        dropHintText={
          dropToInputComposer
            ? hideInputDropHint
              ? ""
              : "References attach from the message bar."
            : undefined
        }
        emptyStateText={dropToInputComposer ? "Send your next instruction." : undefined}
        {...historyDropHandlers}
        onRemoveAttachment={onRemoveAgentAttachment}
        onClearAttachments={onClearAgentAttachments}
        onInputChange={(value) => onAgentInputChange?.(value)}
        onSend={onAgentSend ?? (() => {})}
        onAssistantMessageEdit={onAssistantMessageEdit}
        highlightLatestAssistantOnly={highlightLatestAssistantOnly}
        hideOutputGenerateControls
      />
    </div>
  ) : null;

  const chatSpacerContent = shouldRenderAgentChatSpacer ? (
    <>
      <div
        className={`agent-chat-inline-spacer ${emptyAgentChatSpacerClassName}`.trim()}
        aria-hidden="true"
      />
    </>
  ) : null;

  const inputShellContent = (
    <div
      className={`agent-composer-input-shell ${
        hasInsideInputSendButton ? "has-inside-send-button" : "has-full-width-text"
      } ${dropToInputComposer && agentDropActive ? "is-drop-active" : ""}`.trim()}
      {...inputDropHandlers}
    >
      {showComposerAttachments ? (
        <AgentComposerAttachmentStrip
          attachments={stagedAttachments}
          onRemoveAttachment={onRemoveAgentAttachment}
        />
      ) : null}
      <AgentInputBar
        ref={agentInputRef}
        value={agentInput}
        onChange={(value) => onAgentInputChange?.(value)}
        onFocusChange={setIsAgentInputExpanded}
        onVisualRowCountChange={handleAgentInputVisualRowCountChange}
        placeholder={
          agentInputDisabled
            ? "Choose a Pulse to start"
            : isPulseLoading
              ? pulseLoadingState.phase === "starting_pulse"
                ? "Pulse is starting..."
                : "Pulse is generating the next response..."
              : "Message the agent..."
        }
        onKeyDown={handleAgentInputKeyDown}
        className={`agent-input-prefab-inline ${showComposerAttachments ? "has-leading-attachments" : ""}`}
        maxHeightPx={agentInputMaxHeightPx}
        collapseToMinHeightWhenBlurred={agentInputCollapseOnBlur}
        verticalExpansionAnchor={agentInputVerticalExpansionAnchor}
        disabled={isAgentInputDisabled}
      />
      {hasInsideInputSendButton ? (
        <AgentSendButton
          onClick={handleAgentSendClick}
          disabled={isAgentInputDisabled || !canSendAgentInput}
          loading={agentIsSending}
          ariaLabel="Send to agent"
          icon="arrow-up"
          className="agent-send-prefab--inside-input"
        />
      ) : null}
    </div>
  );

  const chatSendButtonContent = !embedSendButtonInInput ? (
    <AgentSendButton
      onClick={handleAgentSendClick}
      disabled={isAgentInputDisabled || !canSendAgentInput}
      loading={agentIsSending}
      ariaLabel="Send to agent"
      label="Send"
      className="agent-send-prefab--labeled"
    />
  ) : null;

  const chatModeActionsContent = <div className="agent-inline-actions"></div>;

  const inlineAgentErrorContent = agentError ? (
    <AppMessage
      className="agent-composer-inline-status"
      tone="warning"
      mode="inline"
      message={agentError}
    />
  ) : null;

  const composerMiddleControlContent = composerMiddleContent ? (
    <div className="agent-composer-middle">{composerMiddleContent}</div>
  ) : null;
  const composerLeadingControlContent = composerLeadingContent ? (
    <div className="agent-composer-leading">{composerLeadingContent}</div>
  ) : null;
  const stackedControlsRowContent = composerMiddleControlContent ? (
    <div className="agent-composer-controls-row">{composerMiddleControlContent}</div>
  ) : null;

  const composerRowContent = (
    <>
      {inlineAgentErrorContent}
      <div
        className={`step2-input-row prompt-actions-compact agent-composer-row ${
          shouldStackTrailingComposerControls ? "is-stacked" : ""
        }`.trim()}
      >
        {shouldStackTrailingComposerControls ? (
          <>
            <div className="agent-composer-primary-row">
              {chatModeActionsContent}
              {inputShellContent}
              {composerLeadingControlContent}
            </div>
            {stackedControlsRowContent}
          </>
        ) : (
          <>
            {inputShellContent}
            {composerMiddleControlContent}
            {composerLeadingControlContent}
            {chatModeActionsContent}
            {chatSendButtonContent}
          </>
        )}
      </div>
    </>
  );

  return (
    <>
      {!chatOnly && !promptOnly && !enhanceOnly ? (
        <div className="prompt-mode-row">
          <div
            className="prompt-mode-toggle-row prompt-mode-toggle-standalone"
            role="group"
            aria-label="Prompt options"
          >
            <button
              type="button"
              className={`ghost-btn small mode-toggle-btn ${promptMode === "enhanced" ? "is-active" : ""}`}
              aria-pressed={promptMode === "enhanced"}
              onClick={(e) => {
                e.stopPropagation();
                setPromptMode("enhanced");
              }}
            >
              Prompt
            </button>
            <button
              type="button"
              className={`ghost-btn small mode-toggle-btn ${promptMode === "chat" ? "is-active" : ""}`}
              aria-pressed={promptMode === "chat"}
              onClick={(e) => {
                e.stopPropagation();
                setPromptMode("chat");
              }}
            >
              Chat
            </button>
          </div>
          <div className={`prompt-chat-actions ${promptMode === "chat" ? "is-active" : ""}`}>
            {promptMode === "chat" && onClearAgentChat ? (
              <button
                type="button"
                className="ghost-btn mini prompt-clear-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onClearAgentChat();
                }}
                aria-label="Clear chat"
                disabled={agentMessages.length === 0 && !stagedPrompt}
                aria-disabled={agentMessages.length === 0 && !stagedPrompt}
              >
                <Trash size={18} weight="bold" aria-hidden />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      {shouldUseComposerOverlay ? (
        <div
          className={`create-composer-chat-composer-overlay-zone ${shouldBlurComposerUnderlay ? "is-composer-expanded" : ""}`.trim()}
        >
          <div className="create-composer-chat-composer-base-layer">{chatHistoryContent}</div>
          <div className="create-composer-chat-composer-overlay">{composerRowContent}</div>
        </div>
      ) : (
        <>
          {chatHistoryContent}
          {chatSpacerContent}
          {composerRowContent}
        </>
      )}
      <p className="tiny helper-text agent-composer-hint">
        Enter to send. Shift+Enter for a new line.
      </p>
      {imageAttachmentCounts.total > 0 ? (
        <p className="tiny helper-text agent-composer-hint agent-composer-hint--media">
          Vision images: {imageAttachmentCounts.ready}/{imageAttachmentCounts.total} ready
          {imageAttachmentCounts.preparing > 0
            ? `, ${imageAttachmentCounts.preparing} preparing`
            : ""}
          {imageAttachmentCounts.failed > 0 ? `, ${imageAttachmentCounts.failed} failed` : ""}. Max
          {AGENT_IMAGE_ATTACHMENT_MAX_ITEMS} sent per message.
        </p>
      ) : null}
    </>
  );
};
