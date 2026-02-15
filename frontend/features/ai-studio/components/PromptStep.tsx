/**
 * Shared prompt step component for AI Studio.
 * Handles prompt entry modes and Agent interactions.
 */
import React from "react";
import { ArrowsOutSimple, CaretDown, Trash } from "phosphor-react";
import {
  AgentChatPanel,
  AgentEnhanceButton,
  AgentSendButton,
  AgentSaveButton,
  AgentInputBar,
  AgentPromptActions,
} from "../../../prefabs/agent";
import type { AgentActions, AgentAttachment, AgentMessage } from "../../../prefabs/agent";

type StepHeaderActionButtonProps = {
  label: string;
  isCollapsed?: boolean;
  onClick: () => void;
};

const StepHeaderActionButton: React.FC<StepHeaderActionButtonProps> = ({
  label,
  isCollapsed = false,
  onClick,
}) => {
  return (
    <button
      type="button"
      className="ghost-btn mini step-utility-btn"
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      aria-expanded={!isCollapsed}
    >
      <CaretDown size={16} weight="bold" aria-hidden />
    </button>
  );
};

export type PromptStepProps = {
  stepNumber: string | number;
  title?: string;
  subtitle?: string;
  prompt: string;
  onPromptChange: (value: string) => void;
  // Agent props
  agentEnabled?: boolean;
  agentMessages?: AgentMessage[];
  agentActions?: AgentActions;
  agentInput?: string;
  agentIsSending?: boolean;
  agentError?: string;
  agentPrimaryPrompt?: string | null;
  agentPrimarySource?: "agent" | "manual" | "reference";
  stagedPrompt?: string | null;
  stagedAttachments?: AgentAttachment[];
  agentDropActive?: boolean;
  agentChatOpen?: boolean;
  onAgentInputChange?: (value: string) => void;
  onAgentSend?: () => void;
  onAgentEnhanceSend?: () => void;
  onAgentMessageClick?: (message: AgentMessage) => void;
  onAgentAttachmentDrop?: (event: React.DragEvent<HTMLDivElement>) => void;
  onAgentAttachmentDragOver?: (event: React.DragEvent<HTMLDivElement>) => void;
  onAgentAttachmentDragEnter?: (event: React.DragEvent<HTMLDivElement>) => void;
  onAgentAttachmentDragLeave?: (event: React.DragEvent<HTMLDivElement>) => void;
  onRemoveAgentAttachment?: (id: string) => void;
  onClearAgentAttachments?: () => void;
  onExpandChat?: () => void;
  onClearAgentChat?: () => void;
  onAgentApplyPrompt?: (prompt: string) => void;
  onAgentSelectVariation?: (prompt: string) => void;
  onAgentUseQuestion?: (question: string) => void;
  onAgentDescribeTargets?: (targets: string[]) => void;
  // Actions
  onSavePrompt: (customPrompt?: string) => void;
  // State / UI
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isGenerating?: boolean;
  shouldDisableSave?: boolean;
  // Drag and Drop support
  onDrop?: (event: React.DragEvent<HTMLDivElement | HTMLTextAreaElement>) => void;
  onDragOver?: (event: React.DragEvent<HTMLDivElement | HTMLTextAreaElement>) => void;
  className?: string;
  beginnerMode?: boolean;
  chatOnly?: boolean;
  promptOnly?: boolean;
  enhanceOnly?: boolean;
  hideEnhanceButton?: boolean;
  promptPlaceholder?: string;
  beginnerSubtitle?: string;
  beginnerTitle?: string;
  promptSaveButtonClassName?: string;
  promptSaveButtonUnstyled?: boolean;
  beginnerPinHelperText?: string;
  chatPromptSaveButtonClassName?: string;
  chatPromptSaveButtonUnstyled?: boolean;
};

export function PromptStep({
  stepNumber,
  title = "Choose Prompt Mode",
  subtitle = "Draft the prompt you want to use, or switch to Chat to have the agent craft one for you.",
  prompt,
  onPromptChange,
  agentEnabled = false,
  agentMessages = [],
  agentActions,
  agentInput = "",
  agentIsSending = false,
  agentError,
  agentPrimaryPrompt = null,
  agentPrimarySource = "manual",
  stagedPrompt = null,
  stagedAttachments = [],
  agentDropActive = false,
  agentChatOpen = false,
  onAgentInputChange,
  onAgentSend,
  onAgentEnhanceSend,
  onAgentMessageClick,
  onAgentAttachmentDrop,
  onAgentAttachmentDragOver,
  onAgentAttachmentDragEnter,
  onAgentAttachmentDragLeave,
  onRemoveAgentAttachment,
  onClearAgentAttachments,
  onExpandChat,
  onClearAgentChat,
  onAgentApplyPrompt,
  onAgentSelectVariation,
  onAgentUseQuestion,
  onAgentDescribeTargets,
  onSavePrompt,
  isCollapsed,
  onToggleCollapse,
  isGenerating = false,
  shouldDisableSave = false,
  onDrop,
  onDragOver,
  className = "",
  beginnerMode = false,
  chatOnly = false,
  promptOnly = false,
  enhanceOnly = false,
  hideEnhanceButton = false,
  promptPlaceholder = "Describe what you want, then refine it.",
  beginnerSubtitle,
  beginnerTitle,
  promptSaveButtonClassName = "prompt-fab-save",
  promptSaveButtonUnstyled = false,
  beginnerPinHelperText,
  chatPromptSaveButtonClassName = "",
  chatPromptSaveButtonUnstyled = false,
}: PromptStepProps) {
  const [promptMode, setPromptMode] = React.useState<"enhanced" | "chat">(
    chatOnly ? "chat" : "enhanced"
  );
  const agentInputRef = React.useRef<HTMLTextAreaElement>(null);

  // Chat-only overrides local mode state; otherwise beginner mode defaults to enhanced prompt mode.
  React.useEffect(() => {
    if (promptOnly && promptMode !== "enhanced") {
      setPromptMode("enhanced");
      return;
    }
    if (chatOnly && promptMode !== "chat") {
      setPromptMode("chat");
      return;
    }
    if (!chatOnly && beginnerMode && promptMode !== "enhanced") {
      setPromptMode("enhanced");
    }
  }, [beginnerMode, chatOnly, promptMode, promptOnly]);

  const effectiveTitle = beginnerMode ? (beginnerTitle ?? "Build Your Prompt") : title;

  const handleEnhancedPromptKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || agentIsSending) return;
    event.preventDefault();
    onAgentEnhanceSend?.();
  };

  const handleAgentInputKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || agentIsSending) return;
    event.preventDefault();
    onAgentSend?.();
    // Keep focus in the composer so the user can immediately type the next message.
    requestAnimationFrame(() => agentInputRef.current?.focus());
  };

  const canExpandInlineChat = agentMessages.length > 0;
  const canUsePromptSurface = agentEnabled || enhanceOnly;
  const isChatMode = !promptOnly && !enhanceOnly && (chatOnly || promptMode === "chat");
  // Chat-only mode should not depend on "expanded chat" state now that the expand control is removed.
  const showInlineChat = isChatMode && (!agentChatOpen || chatOnly);
  const promptThinking = Boolean(agentIsSending || isGenerating);
  const visibleSubtitle = beginnerMode ? beginnerSubtitle : subtitle;
  const canPinAgentInput = agentInput.trim().length > 0;
  const shouldDisableChatPin = chatPromptSaveButtonUnstyled
    ? false
    : shouldDisableSave || !canPinAgentInput;
  const showBeginnerChatPinTip = Boolean(beginnerMode && chatOnly && beginnerPinHelperText);
  const imageAttachmentCounts = React.useMemo(() => {
    const images = stagedAttachments.filter((attachment) => attachment.kind === "image");
    const total = images.length;
    const preparing = images.filter(
      (attachment) => (attachment.deliveryStatus ?? "pending") === "preparing"
    ).length;
    const ready = images.filter(
      (attachment) => (attachment.deliveryStatus ?? "pending") === "ready"
    ).length;
    const failed = images.filter(
      (attachment) => (attachment.deliveryStatus ?? "pending") === "failed"
    ).length;
    return {
      total,
      preparing,
      ready,
      failed,
    };
  }, [stagedAttachments]);
  const handleAgentSendClick = () => {
    onAgentSend?.();
    requestAnimationFrame(() => agentInputRef.current?.focus());
  };

  const introMessage = React.useMemo<AgentMessage>(
    () => ({
      id: "agent-intro",
      role: "system",
      content:
        "Hey, I'm your studio agent. Tell me what you want to create and I'll turn it into a generation ready prompt.",
    }),
    []
  );

  return (
    <div
      className={`step-card prompt-step ${isCollapsed ? "is-collapsed" : ""} ${className}`}
      onClick={() => {
        // Only collapse if clicking the header or specific non-interactive areas if needed.
        // For now, consistent with other steps: clicking container expands if collapsed.
        if (isCollapsed) onToggleCollapse();
      }}
      role="group"
      aria-label={`${effectiveTitle} section`}
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      <div
        className="step-card-header"
        onClick={(e) => {
          e.stopPropagation();
          onToggleCollapse();
        }}
      >
        {beginnerMode && <span className="step-badge">{stepNumber}</span>}
        <div className="step-header-copy">
          <p className="step-title">{effectiveTitle}</p>
          {visibleSubtitle ? (
            <span className="step-subtitle tiny helper-text">{visibleSubtitle}</span>
          ) : null}
        </div>
        <div className="step-header-actions">
          {chatOnly ? (
            <div className="prompt-chat-header-actions">
              {onClearAgentChat ? (
                <button
                  type="button"
                  className="ghost-btn mini prompt-chat-header-btn"
                  onClick={(event) => {
                    event.stopPropagation();
                    onClearAgentChat();
                  }}
                  aria-label="Clear chat"
                >
                  <Trash size={14} weight="bold" aria-hidden />
                  <span>Clear</span>
                </button>
              ) : null}
            </div>
          ) : null}
          {!beginnerMode ? (
            <StepHeaderActionButton
              label="Open prompt tools"
              isCollapsed={isCollapsed}
              onClick={onToggleCollapse}
            />
          ) : null}
        </div>
      </div>
      {!isCollapsed ? (
        canUsePromptSurface ? (
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
            {showInlineChat ? (
              <>
                <div className="agent-chat-wrapper agent-chat-wrapper--inline">
                  <AgentChatPanel
                    messages={agentMessages}
                    introMessage={introMessage}
                    input={agentInput}
                    sendLabel="Send"
                    isSending={agentIsSending}
                    stagedPrompt={agentMessages.length === 0 ? stagedPrompt : null}
                    stagedAttachments={stagedAttachments}
                    isDropActive={agentDropActive}
                    showInput={false}
                    onDrop={onAgentAttachmentDrop}
                    onDragOver={onAgentAttachmentDragOver}
                    onDragEnter={onAgentAttachmentDragEnter}
                    onDragLeave={onAgentAttachmentDragLeave}
                    onRemoveAttachment={onRemoveAgentAttachment}
                    onClearAttachments={onClearAgentAttachments}
                    onInputChange={(value) => onAgentInputChange?.(value)}
                    onSend={onAgentSend ?? (() => {})}
                    onMessageClick={onAgentMessageClick}
                  />
                </div>
                <div className="step2-input-row prompt-actions-compact agent-composer-row">
                  <AgentInputBar
                    ref={agentInputRef}
                    value={agentInput}
                    onChange={(value) => onAgentInputChange?.(value)}
                    placeholder="Message the agent..."
                    onKeyDown={handleAgentInputKeyDown}
                    className="agent-input-prefab-inline"
                  />
                  <div className="agent-inline-actions">
                    <AgentSendButton
                      onClick={handleAgentSendClick}
                      disabled={agentIsSending}
                      ariaLabel="Send to agent"
                      label="Send"
                      className="agent-send-prefab--labeled"
                    />
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
                {!beginnerMode ? (
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
                    {imageAttachmentCounts.failed > 0
                      ? `, ${imageAttachmentCounts.failed} failed`
                      : ""}
                    . Max 3 sent per message.
                  </p>
                ) : null}
                <AgentPromptActions
                  showPrimaryPromptStatus={false}
                  primaryPrompt={agentPrimaryPrompt ?? prompt}
                  primarySource={agentPrimarySource}
                  actions={agentActions}
                  onApplyPrompt={onAgentApplyPrompt}
                  onSelectVariation={onAgentSelectVariation}
                  onUseQuestion={onAgentUseQuestion}
                  onDescribeTargets={onAgentDescribeTargets}
                />
              </>
            ) : (
              <>
                <div className="step2-input-row enhanced-mode">
                  <div className="prompt-enhanced-wrapper">
                    {promptThinking ? (
                      <div className="prompt-thinking-overlay" aria-live="polite">
                        <span className="prompt-thinking-text">Thinking...</span>
                      </div>
                    ) : null}
                    <textarea
                      className="prompt-input agent-step-textarea enhanced-prompt-input"
                      value={prompt}
                      onChange={(event) => onPromptChange(event.target.value)}
                      onKeyDown={handleEnhancedPromptKeyDown}
                      rows={6}
                      placeholder={promptPlaceholder}
                      aria-busy={promptThinking}
                    />
                  </div>
                </div>
                <div className="enhanced-actions-row prompt-actions-compact">
                  {beginnerMode && beginnerPinHelperText ? (
                    <p className="tiny helper-text beginner-pin-helper">
                      <span className="beginner-pin-helper-prefix">Tip:</span>
                      <span>{beginnerPinHelperText}</span>
                    </p>
                  ) : null}
                  <div className="enhanced-action-buttons agent-inline-actions">
                    {!hideEnhanceButton ? (
                      <AgentEnhanceButton
                        onClick={
                          enhanceOnly
                            ? (onAgentEnhanceSend ?? (() => {}))
                            : (onAgentEnhanceSend ?? onAgentSend ?? (() => {}))
                        }
                        disabled={agentIsSending}
                        ariaLabel="Enhance prompt"
                        className="prompt-fab-send"
                      />
                    ) : null}
                    <AgentSaveButton
                      onClick={onSavePrompt}
                      disabled={shouldDisableSave}
                      ariaLabel={enhanceOnly ? "Pin prompt" : "Save prompt"}
                      className={promptSaveButtonClassName}
                      unstyled={promptSaveButtonUnstyled}
                    />
                  </div>
                </div>
              </>
            )}
          </>
        ) : (
          <div className="prompt-placeholder helper-text">
            <p className="prompt-placeholder-highlight">Prompt mode disabled</p>
            <p>Components are not active.</p>
          </div>
        )
      ) : null}
      {canUsePromptSurface && agentError && !isCollapsed ? (
        <div className="inline-error-hint">{agentError}</div>
      ) : null}
    </div>
  );
}
