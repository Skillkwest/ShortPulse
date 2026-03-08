/**
 * PromptStep chat-mode surface.
 * Renders history, composer, attachment strip, and action panel for agent chat mode.
 */
import React from "react";
import { ArrowsOutSimple, Trash } from "phosphor-react";
import {
  AgentChatPanel,
  AgentInputBar,
  AgentPromptActions,
  AgentResponseInlineGenerateButton,
  AgentSaveButton,
  AgentSendButton,
} from "../../../../prefabs/agent";
import type {
  AgentActions,
  AgentAssistantMessageEditRequest,
  AgentAttachment,
  AgentMessage,
  AgentOutputBubbleMediaState,
  AgentOutputGenerateInput,
} from "../../../../prefabs/agent";
import type { PromptStepInlineGenerateConfig } from "./types";

type PromptStepChatSurfaceProps = {
  beginnerMode: boolean;
  chatOnly: boolean;
  promptOnly: boolean;
  enhanceOnly: boolean;
  promptMode: "enhanced" | "chat";
  setPromptMode: React.Dispatch<React.SetStateAction<"enhanced" | "chat">>;
  onExpandChat?: () => void;
  onClearAgentChat?: () => void;
  agentChatOpen: boolean;
  canExpandInlineChat: boolean;
  promptThinking: boolean;
  hideAgentIntroMessage: boolean;
  hideEmptyAgentChatState: boolean;
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
  onAgentSend?: () => void;
  onGenerateOutputPrompt?: (request: AgentOutputGenerateInput) => void;
  chatModeInlineGenerate?: PromptStepInlineGenerateConfig;
  useAgentResponseInlineGeneratePrefab?: boolean;
  highlightLatestAssistantOnly: boolean;
  disableOutputGenerate: boolean;
  outputGenerateCostCredits: number | null;
  composerLeadingContent: React.ReactNode;
  showComposerAttachments: boolean;
  agentInputRef: React.RefObject<HTMLTextAreaElement>;
  agentInput: string;
  handleAgentInputKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  agentInputMaxHeightPx?: number;
  embedSendButtonInInput: boolean;
  handleAgentSendClick: () => void;
  agentIsSending: boolean;
  onSavePrompt: (customPrompt?: string) => void;
  shouldDisableChatPin: boolean;
  showBeginnerChatPinTip: boolean;
  beginnerPinHelperText?: string;
  chatPromptSaveButtonClassName: string;
  chatPromptSaveButtonUnstyled: boolean;
  imageAttachmentCounts: {
    total: number;
    preparing: number;
    ready: number;
    failed: number;
  };
  agentPrimaryPrompt: string | null;
  prompt: string;
  agentPrimarySource: "agent" | "manual" | "reference";
  agentActions?: AgentActions;
  onAgentApplyPrompt?: (prompt: string) => void;
  onAgentSelectVariation?: (prompt: string) => void;
  onAgentDescribeTargets?: (targets: string[]) => void;
  onAssistantMessageEdit?: (request: AgentAssistantMessageEditRequest) => boolean;
};

export const PromptStepChatSurface: React.FC<PromptStepChatSurfaceProps> = ({
  beginnerMode,
  chatOnly,
  promptOnly,
  enhanceOnly,
  promptMode,
  setPromptMode,
  onExpandChat,
  onClearAgentChat,
  agentChatOpen,
  canExpandInlineChat,
  promptThinking,
  hideAgentIntroMessage,
  hideEmptyAgentChatState,
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
  onAgentSend,
  onGenerateOutputPrompt,
  chatModeInlineGenerate,
  useAgentResponseInlineGeneratePrefab = false,
  highlightLatestAssistantOnly,
  disableOutputGenerate,
  outputGenerateCostCredits,
  composerLeadingContent,
  showComposerAttachments,
  agentInputRef,
  agentInput,
  handleAgentInputKeyDown,
  agentInputMaxHeightPx,
  embedSendButtonInInput,
  handleAgentSendClick,
  agentIsSending,
  onSavePrompt,
  shouldDisableChatPin,
  showBeginnerChatPinTip,
  beginnerPinHelperText,
  chatPromptSaveButtonClassName,
  chatPromptSaveButtonUnstyled,
  imageAttachmentCounts,
  agentPrimaryPrompt,
  prompt,
  agentPrimarySource,
  agentActions,
  onAgentApplyPrompt,
  onAgentSelectVariation,
  onAgentDescribeTargets,
  onAssistantMessageEdit,
}) => {
  const hasHistoryAttachments = !dropToInputComposer && stagedAttachments.length > 0;
  const inlineGenerateCostLabel =
    outputGenerateCostCredits != null ? outputGenerateCostCredits.toLocaleString() : "—";
  const inlineGenerateDisabled =
    Boolean(chatModeInlineGenerate?.disabled) || agentInput.trim().length === 0;
  const hasInlineGenerateAction = !chatModeEnabled && Boolean(chatModeInlineGenerate?.onGenerate);
  const shouldUsePostInputInlineGenerate =
    hasInlineGenerateAction && Boolean(composerLeadingContent);
  const hasAgentChatContent =
    !hideAgentIntroMessage ||
    agentMessages.length > 0 ||
    hasHistoryAttachments ||
    Boolean(stagedPrompt?.trim());
  const shouldRenderAgentChatPanel = hasAgentChatContent || !hideEmptyAgentChatState;
  const shouldRenderAgentChatSpacer = !shouldRenderAgentChatPanel;

  return (
    <>
      {!chatOnly && !promptOnly && !enhanceOnly && !beginnerMode ? (
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
            {promptMode === "chat" && onExpandChat ? (
              <button
                type="button"
                className={`ghost-btn mini prompt-expand-btn ${agentChatOpen ? "is-chat-open" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (canExpandInlineChat) onExpandChat();
                }}
                aria-label="Expand chat"
                disabled={!canExpandInlineChat}
                aria-disabled={!canExpandInlineChat}
              >
                <ArrowsOutSimple size={20} weight="bold" aria-hidden />
              </button>
            ) : null}
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
      {shouldRenderAgentChatPanel ? (
        <div className="agent-chat-wrapper agent-chat-wrapper--inline">
          <AgentChatPanel
            messages={agentMessages}
            introMessage={hideAgentIntroMessage ? null : introMessage}
            input={agentInput}
            sendLabel="Send"
            isSending={promptThinking}
            showThinkingIndicator
            thinkingIndicatorPlacement="history"
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
            onAssistantMessageEdit={onAssistantMessageEdit}
            highlightLatestAssistantOnly={highlightLatestAssistantOnly}
            disableOutputGenerate={disableOutputGenerate}
            outputGenerateCostCredits={outputGenerateCostCredits}
          />
        </div>
      ) : null}
      {shouldRenderAgentChatSpacer ? (
        <div
          className={`agent-chat-inline-spacer ${emptyAgentChatSpacerClassName}`.trim()}
          aria-hidden="true"
        />
      ) : null}
      <div
        className={`step2-input-row prompt-actions-compact agent-composer-row ${
          shouldUsePostInputInlineGenerate ? "has-post-input-inline-generate" : ""
        }`.trim()}
      >
        {composerLeadingContent ? (
          <div className="agent-composer-leading">{composerLeadingContent}</div>
        ) : null}
        <div
          className={`agent-composer-input-shell ${dropToInputComposer && agentDropActive ? "is-drop-active" : ""}`.trim()}
          {...inputDropHandlers}
        >
          {showComposerAttachments ? (
            <div
              className="agent-composer-attachment-strip"
              aria-label="Attached references for next message"
            >
              <div className="agent-attachment-card-list agent-attachment-card-list--composer">
                {stagedAttachments.map((attachment) => {
                  const isLinkedPromptRef =
                    attachment.kind === "prompt" && Boolean(attachment.referenceId);
                  const attachmentStatusClass =
                    attachment.kind === "image"
                      ? `is-${attachment.deliveryStatus ?? "pending"}`
                      : "";
                  return (
                    <div
                      key={attachment.id}
                      className={`agent-attachment-card agent-attachment-card--composer agent-attachment-card--${attachment.kind} ${isLinkedPromptRef ? "is-linked-prompt-ref" : ""} ${attachmentStatusClass}`}
                    >
                      {attachment.kind === "image" && attachment.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={attachment.imageUrl}
                          alt=""
                          className="agent-attachment-card-media"
                        />
                      ) : (
                        <div className="agent-attachment-card-prompt" aria-hidden="true">
                          <span className="agent-attachment-card-prompt-marker">T</span>
                        </div>
                      )}
                      {isLinkedPromptRef ? (
                        <span className="agent-attachment-link-dot" aria-hidden="true" />
                      ) : null}
                      {onRemoveAgentAttachment ? (
                        <button
                          type="button"
                          className="agent-attachment-remove agent-attachment-remove--card"
                          aria-label="Remove attachment"
                          onClick={() => onRemoveAgentAttachment(attachment.id)}
                        >
                          ×
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
          <AgentInputBar
            ref={agentInputRef}
            value={agentInput}
            onChange={(value) => onAgentInputChange?.(value)}
            placeholder={chatModeEnabled ? "Message the agent..." : "Write your prompt..."}
            onKeyDown={handleAgentInputKeyDown}
            className={`agent-input-prefab-inline ${showComposerAttachments ? "has-leading-attachments" : ""}`}
            maxHeightPx={agentInputMaxHeightPx}
          />
          {embedSendButtonInInput && chatModeEnabled ? (
            <AgentSendButton
              onClick={handleAgentSendClick}
              disabled={!chatModeEnabled || agentIsSending}
              loading={agentIsSending}
              ariaLabel="Send to agent"
              icon="arrow-up"
              className="agent-send-prefab--inside-input"
            />
          ) : null}
        </div>
        {shouldUsePostInputInlineGenerate ? (
          <div className="agent-composer-post-input-actions">
            {useAgentResponseInlineGeneratePrefab ? (
              <AgentResponseInlineGenerateButton
                className="agent-chat-inline-generate-btn"
                onClick={chatModeInlineGenerate?.onGenerate ?? (() => {})}
                costCredits={outputGenerateCostCredits}
                disabled={inlineGenerateDisabled}
                ariaLabel={chatModeInlineGenerate?.ariaLabel ?? "Generate with current prompt"}
              />
            ) : (
              <button
                type="button"
                className="reference-generate-pill agent-generate-prefab reference-prompt-generate-pill agent-output-generate-pill agent-chat-inline-generate-btn"
                onClick={chatModeInlineGenerate?.onGenerate ?? (() => {})}
                disabled={inlineGenerateDisabled}
                aria-label={chatModeInlineGenerate?.ariaLabel ?? "Generate with current prompt"}
              >
                <span className="agent-generate-label">Generate</span>
                <span className="model-chip-pill generate-pill">
                  <span aria-hidden="true" className="model-chip-icon">
                    ✦
                  </span>
                  <span className="model-chip-credits">{inlineGenerateCostLabel}</span>
                </span>
              </button>
            )}
          </div>
        ) : null}
        <div className="agent-inline-actions">
          {hasInlineGenerateAction && !shouldUsePostInputInlineGenerate ? (
            useAgentResponseInlineGeneratePrefab ? (
              <AgentResponseInlineGenerateButton
                className="agent-chat-inline-generate-btn"
                onClick={chatModeInlineGenerate?.onGenerate ?? (() => {})}
                costCredits={outputGenerateCostCredits}
                disabled={inlineGenerateDisabled}
                ariaLabel={chatModeInlineGenerate?.ariaLabel ?? "Generate with current prompt"}
              />
            ) : (
              <button
                type="button"
                className="reference-generate-pill agent-generate-prefab reference-prompt-generate-pill agent-output-generate-pill agent-chat-inline-generate-btn"
                onClick={chatModeInlineGenerate?.onGenerate ?? (() => {})}
                disabled={inlineGenerateDisabled}
                aria-label={chatModeInlineGenerate?.ariaLabel ?? "Generate with current prompt"}
              >
                <span className="agent-generate-label">Generate</span>
                <span className="model-chip-pill generate-pill">
                  <span aria-hidden="true" className="model-chip-icon">
                    ✦
                  </span>
                  <span className="model-chip-credits">{inlineGenerateCostLabel}</span>
                </span>
              </button>
            )
          ) : null}
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
          {!embedSendButtonInInput && chatModeEnabled ? (
            <AgentSendButton
              onClick={handleAgentSendClick}
              disabled={!chatModeEnabled || agentIsSending}
              loading={agentIsSending}
              ariaLabel="Send to agent"
              label="Send"
              className="agent-send-prefab--labeled"
            />
          ) : null}
          {!showBeginnerChatPinTip ? (
            <AgentSaveButton
              onClick={() => onSavePrompt(agentInput)}
              disabled={shouldDisableChatPin}
              ariaLabel="Pin prompt"
              className={chatPromptSaveButtonClassName}
              unstyled={chatPromptSaveButtonUnstyled}
            />
          ) : null}
        </div>
      </div>
      {showBeginnerChatPinTip ? (
        <div className="agent-composer-tip-row">
          <p className="tiny helper-text beginner-pin-helper create-beginner-pin-helper">
            <span className="beginner-pin-helper-prefix">Tip:</span>
            <span>{beginnerPinHelperText}</span>
          </p>
          <AgentSaveButton
            onClick={() => onSavePrompt(agentInput)}
            disabled={shouldDisableChatPin}
            ariaLabel="Pin prompt"
            className={chatPromptSaveButtonClassName}
            unstyled={chatPromptSaveButtonUnstyled}
          />
        </div>
      ) : null}
      {!beginnerMode && chatModeEnabled ? (
        <p className="tiny helper-text agent-composer-hint">
          Enter to send. Shift+Enter for a new line.
        </p>
      ) : null}
      {imageAttachmentCounts.total > 0 ? (
        <p className="tiny helper-text agent-composer-hint agent-composer-hint--media">
          Vision images: {imageAttachmentCounts.ready}/{imageAttachmentCounts.total} ready
          {imageAttachmentCounts.preparing > 0
            ? `, ${imageAttachmentCounts.preparing} preparing`
            : ""}
          {imageAttachmentCounts.failed > 0 ? `, ${imageAttachmentCounts.failed} failed` : ""}. Max
          3 sent per message.
        </p>
      ) : null}
      <AgentPromptActions
        showPrimaryPromptStatus={false}
        primaryPrompt={agentPrimaryPrompt ?? prompt}
        primarySource={agentPrimarySource}
        actions={agentActions}
        onApplyPrompt={onAgentApplyPrompt}
        onSelectVariation={onAgentSelectVariation}
        onDescribeTargets={onAgentDescribeTargets}
      />
    </>
  );
};
