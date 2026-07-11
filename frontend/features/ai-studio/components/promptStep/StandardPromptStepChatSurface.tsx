/**
 * Standard PromptStep chat-mode surface.
 * Renders Standard history, composer, attachment strip, and action panel.
 */
import React from "react";
import { Trash } from "phosphor-react";
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
  AgentOutputBubbleMediaState,
  AgentOutputGenerateInput,
} from "../../../../prefabs/agent";
import { AgentComposerAttachmentStrip } from "./AgentComposerAttachmentStrip";
import { AGENT_IMAGE_ATTACHMENT_MAX_ITEMS } from "../../../../prefabs/agent/attachmentPolicy";
import { canUseAssistantMessageAsPrompt } from "../../createRuntime/agentRuntimeShared";

type StandardPromptStepChatSurfaceProps = {
  chatOnly: boolean;
  promptOnly: boolean;
  enhanceOnly: boolean;
  promptMode: "enhanced" | "chat";
  setPromptMode: React.Dispatch<React.SetStateAction<"enhanced" | "chat">>;
  onClearAgentChat?: () => void;
  promptThinking: boolean;
  thinkingIndicatorLabel?: string;
  hideAgentIntroMessage: boolean;
  hideEmptyAgentChatState: boolean;
  forceRenderAgentChatPanel: boolean;
  emptyAgentChatSpacerClassName: string;
  agentMessages: AgentMessage[];
  introMessage: AgentMessage;
  stagedPrompt: string | null;
  assistantBubbleMedia?: Record<string, AgentOutputBubbleMediaState>;
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
  chatModeEnabled: boolean;
  onChatModeEnabledChange?: (value: boolean) => void;
  hideChatModeToggle?: boolean;
  agentBootstrapPending: boolean;
  onAgentSend?: () => void;
  onGenerateOutputPrompt?: (request: AgentOutputGenerateInput) => void;
  onUseAssistantMessageAsPrompt?: (request: { messageId: string; prompt: string }) => void;
  highlightLatestAssistantOnly: boolean;
  CreateChatPanel?: React.ComponentType<AgentChatPanelProps>;
  disableOutputGenerate: boolean;
  outputGenerateCostCredits: number | null;
  outputGenerateGuardrailReason?: string | null;
  hideOutputGenerateControls?: boolean;
  composerMiddleContent: React.ReactNode;
  composerLeadingContent: React.ReactNode;
  composerTrailingContent: React.ReactNode;
  chatComposerOverlayEnabled: boolean;
  stackTrailingComposerControls: boolean;
  hideChatComposerHint: boolean;
  showComposerAttachments: boolean;
  agentInputRef: React.RefObject<HTMLTextAreaElement>;
  agentInput: string;
  handleAgentInputKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  agentInputMaxHeightPx?: number;
  agentInputCollapseOnBlur: boolean;
  agentInputVerticalExpansionAnchor: "top" | "bottom";
  onAgentInputVisualRowCountChange?: (rowCount: number) => void;
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

export const StandardPromptStepChatSurface: React.FC<StandardPromptStepChatSurfaceProps> = ({
  chatOnly,
  promptOnly,
  enhanceOnly,
  promptMode,
  setPromptMode,
  onClearAgentChat,
  promptThinking,
  thinkingIndicatorLabel,
  hideAgentIntroMessage,
  hideEmptyAgentChatState,
  forceRenderAgentChatPanel,
  emptyAgentChatSpacerClassName,
  agentMessages,
  introMessage,
  stagedPrompt,
  assistantBubbleMedia,
  stagedAttachments,
  dropToInputComposer,
  hideInputDropHint,
  agentDropActive,
  historyDropHandlers,
  inputDropHandlers,
  onRemoveAgentAttachment,
  onClearAgentAttachments,
  onAgentInputChange,
  chatModeEnabled,
  onChatModeEnabledChange,
  hideChatModeToggle = false,
  agentBootstrapPending,
  onAgentSend,
  onGenerateOutputPrompt,
  onUseAssistantMessageAsPrompt,
  highlightLatestAssistantOnly,
  CreateChatPanel = AgentChatPanel,
  disableOutputGenerate,
  outputGenerateCostCredits,
  outputGenerateGuardrailReason,
  hideOutputGenerateControls = false,
  composerMiddleContent,
  composerLeadingContent,
  composerTrailingContent,
  chatComposerOverlayEnabled,
  stackTrailingComposerControls,
  hideChatComposerHint,
  showComposerAttachments,
  agentInputRef,
  agentInput,
  handleAgentInputKeyDown,
  agentInputMaxHeightPx,
  agentInputCollapseOnBlur,
  agentInputVerticalExpansionAnchor,
  onAgentInputVisualRowCountChange,
  embedSendButtonInInput,
  handleAgentSendClick,
  agentIsSending,
  imageAttachmentCounts,
  onAssistantMessageEdit,
}) => {
  const [isAgentInputExpanded, setIsAgentInputExpanded] = React.useState(false);
  const [agentInputVisualRowCount, setAgentInputVisualRowCount] = React.useState(1);
  const hasHistoryAttachments = !dropToInputComposer && stagedAttachments.length > 0;
  const hasBlockingImageAttachments =
    imageAttachmentCounts.preparing > 0 || imageAttachmentCounts.failed > 0;
  const canSendAgentInput =
    chatModeEnabled &&
    !hasBlockingImageAttachments &&
    (agentInput.trim().length > 0 || stagedAttachments.length > 0);
  const hasInsideInputSendButton = embedSendButtonInInput && chatModeEnabled;
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
    chatComposerOverlayEnabled && shouldRenderAgentChatPanel && !shouldRenderAgentChatSpacer;
  const shouldBlurComposerUnderlay = isAgentInputExpanded && agentInputVisualRowCount >= 8;
  const hasReturnedPromptToDrag =
    Boolean(stagedPrompt?.trim()) ||
    agentMessages.some((message) => canUseAssistantMessageAsPrompt(message));
  const showDragGenerateHint =
    chatModeEnabled && agentInput.trim().length === 0 && hasReturnedPromptToDrag;
  const handleAgentInputVisualRowCountChange = React.useCallback(
    (rowCount: number) => {
      setAgentInputVisualRowCount(rowCount);
      onAgentInputVisualRowCountChange?.(rowCount);
    },
    [onAgentInputVisualRowCountChange]
  );

  const chatHistoryContent = shouldRenderAgentChatPanel ? (
    <div className="agent-chat-wrapper agent-chat-wrapper--inline">
      <CreateChatPanel
        messages={agentMessages}
        introMessage={hideAgentIntroMessage ? null : introMessage}
        input=""
        sendLabel="Send"
        isSending={promptThinking}
        showThinkingIndicator
        thinkingIndicatorPlacement="history"
        thinkingIndicatorLabel={thinkingIndicatorLabel}
        stagedPrompt={agentMessages.length === 0 ? stagedPrompt : null}
        assistantBubbleMedia={assistantBubbleMedia}
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
        onGenerateOutputPrompt={onGenerateOutputPrompt}
        onUseAssistantMessageAsPrompt={onUseAssistantMessageAsPrompt}
        onAssistantMessageEdit={onAssistantMessageEdit}
        highlightLatestAssistantOnly={highlightLatestAssistantOnly}
        disableOutputGenerate={disableOutputGenerate}
        outputGenerateCostCredits={outputGenerateCostCredits}
        outputGenerateGuardrailReason={outputGenerateGuardrailReason}
        hideOutputGenerateControls={hideOutputGenerateControls || !chatModeEnabled}
        preserveOutputGenerateLayoutWhenControlsHidden={!chatModeEnabled}
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
        placeholder={chatModeEnabled ? "Message the agent..." : "Write your prompt..."}
        onKeyDown={handleAgentInputKeyDown}
        className={`agent-input-prefab-inline ${showComposerAttachments ? "has-leading-attachments" : ""}`}
        maxHeightPx={agentInputMaxHeightPx}
        collapseToMinHeightWhenBlurred={agentInputCollapseOnBlur}
        verticalExpansionAnchor={agentInputVerticalExpansionAnchor}
        disabled={agentBootstrapPending}
      />
      {composerTrailingContent ? (
        <div className="agent-composer-trailing-content">{composerTrailingContent}</div>
      ) : null}
      {hasInsideInputSendButton ? (
        <AgentSendButton
          onClick={handleAgentSendClick}
          disabled={agentBootstrapPending || !canSendAgentInput || agentIsSending}
          loading={agentIsSending}
          ariaLabel="Send to agent"
          icon="arrow-up"
          className="agent-send-prefab--inside-input"
        />
      ) : null}
    </div>
  );

  const chatModeToggleContent = hideChatModeToggle ? null : (
    <div className="ai-chat-mode-row-shell agent-chat-mode-row agent-chat-mode-toggle-shell">
      <div className="agent-chat-mode-toggle-copy">
        <span className="agent-chat-mode-label">Chat Mode</span>
      </div>
      <button
        type="button"
        className={`audio-toggle ai-chat-mode-toggle agent-chat-mode-toggle ${chatModeEnabled ? "is-active" : ""}`}
        aria-pressed={chatModeEnabled}
        aria-label={chatModeEnabled ? "Disable chat mode" : "Enable chat mode"}
        disabled={!onChatModeEnabledChange}
        onClick={() => onChatModeEnabledChange?.(!chatModeEnabled)}
      >
        <span className="audio-toggle-track" aria-hidden="true">
          <span className="audio-toggle-dot" />
        </span>
      </button>
    </div>
  );

  const chatSendButtonContent =
    !embedSendButtonInInput && chatModeEnabled ? (
      <AgentSendButton
        onClick={handleAgentSendClick}
        disabled={agentBootstrapPending || !canSendAgentInput || agentIsSending}
        loading={agentIsSending}
        ariaLabel="Send to agent"
        label="Send"
        className="agent-send-prefab--labeled"
      />
    ) : null;

  const chatModeActionsContent = (
    <div className="agent-inline-actions">{chatModeToggleContent}</div>
  );

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
    <div
      className={`step2-input-row prompt-actions-compact agent-composer-row ${
        shouldStackTrailingComposerControls ? "is-stacked" : ""
      }`.trim()}
    >
      {shouldStackTrailingComposerControls ? (
        <>
          <div className="agent-composer-primary-row">
            {chatModeToggleContent}
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
      {chatModeEnabled && !hideChatComposerHint ? (
        <p className="tiny helper-text agent-composer-hint">
          {showDragGenerateHint
            ? "Drag agent text into the composer to enable Generate. Enter sends chat. Shift+Enter adds a new line."
            : "Enter sends chat. Shift+Enter adds a new line."}
        </p>
      ) : null}
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
