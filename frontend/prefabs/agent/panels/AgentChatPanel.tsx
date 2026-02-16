/**
 * Lightweight chat panel to replace prompt textareas.
 * UI stays minimal so existing panel styles remain dominant.
 */
import React, { useCallback, useEffect, useRef } from "react";
import { AgentSendButton } from "../buttons/AgentSendButton";
import { AgentInputBar } from "../inputs/AgentInputBar";
import { AgentPromptActions } from "../components/AgentPromptActions";
import type { AgentActions, AgentAttachment, AgentMessage } from "../types";

const PROMPT_DRAG_GHOST_MIN_WIDTH_PX = 220;
const PROMPT_DRAG_GHOST_MAX_WIDTH_PX = 360;
const PROMPT_DRAG_GHOST_MAX_HEIGHT_PX = 220;
const promptDragGhostMap = new WeakMap<HTMLElement, HTMLElement>();

const clearPromptDragGhost = (source: HTMLElement) => {
  const ghost = promptDragGhostMap.get(source);
  if (ghost?.parentNode) {
    ghost.parentNode.removeChild(ghost);
  }
  promptDragGhostMap.delete(source);
};

const createPromptDragGhost = (source: HTMLElement) => {
  clearPromptDragGhost(source);
  const rect = source.getBoundingClientRect();
  const preferredWidth = rect.width * 0.84;
  const width = Math.min(
    PROMPT_DRAG_GHOST_MAX_WIDTH_PX,
    Math.max(PROMPT_DRAG_GHOST_MIN_WIDTH_PX, preferredWidth)
  );
  const height = Math.min(PROMPT_DRAG_GHOST_MAX_HEIGHT_PX, rect.height);
  const ghost = source.cloneNode(true) as HTMLElement;
  ghost.classList.add("agent-message-drag-ghost");
  ghost.classList.remove("is-clickable", "is-draggable", "is-dragging");
  ghost.style.width = `${width}px`;
  ghost.style.maxHeight = `${PROMPT_DRAG_GHOST_MAX_HEIGHT_PX}px`;
  ghost.style.position = "fixed";
  ghost.style.top = "-9999px";
  ghost.style.left = "-9999px";
  ghost.style.pointerEvents = "none";
  document.body.appendChild(ghost);
  promptDragGhostMap.set(source, ghost);
  return {
    ghost,
    offsetX: Math.round(width * 0.5),
    offsetY: Math.round(height * 0.5),
  };
};

type AgentChatPanelProps = {
  messages: AgentMessage[];
  input: string;
  sendLabel?: string;
  disabled?: boolean;
  isSending?: boolean;
  stagedPrompt?: string | null;
  introMessage?: AgentMessage | null;
  showMessages?: boolean;
  showInput?: boolean;
  showPromptActions?: boolean;
  showPrimaryPromptStatus?: boolean;
  dropHintText?: string;
  emptyStateText?: string;
  stagedAttachments?: AgentAttachment[];
  isDropActive?: boolean;
  showClearAttachmentsButton?: boolean;
  agentActions?: AgentActions;
  primaryPrompt?: string | null;
  primarySource?: "agent" | "manual" | "reference";
  onInputChange: (value: string) => void;
  onSend: () => void;
  onMessageClick?: (message: AgentMessage) => void;
  onAgentApplyPrompt?: (prompt: string) => void;
  onAgentSelectVariation?: (prompt: string) => void;
  onAgentUseQuestion?: (question: string) => void;
  onAgentDescribeTargets?: (targets: string[]) => void;
  onGenerateOutputPrompt?: (prompt: string) => void;
  onDrop?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragOver?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragEnter?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave?: (event: React.DragEvent<HTMLDivElement>) => void;
  onRemoveAttachment?: (id: string) => void;
  onClearAttachments?: () => void;
  beginnerMode?: boolean;
  highlightLatestAssistantOnly?: boolean;
  disableOutputGenerate?: boolean;
  outputGenerateCostCredits?: number | null;
};

export const AgentChatPanel: React.FC<AgentChatPanelProps> = ({
  messages,
  input,
  sendLabel = "Send",
  disabled = false,
  isSending = false,
  stagedPrompt = null,
  introMessage = null,
  showMessages = true,
  showInput = true,
  showPromptActions = false,
  showPrimaryPromptStatus = true,
  dropHintText = "Drag & drop reference cards here to attach context.",
  emptyStateText = "Drop references and send your next instruction.",
  stagedAttachments = [],
  isDropActive = false,
  showClearAttachmentsButton = false,
  agentActions,
  primaryPrompt = null,
  primarySource = "manual",
  onInputChange,
  onSend,
  onMessageClick,
  onAgentApplyPrompt,
  onAgentSelectVariation,
  onAgentUseQuestion,
  onAgentDescribeTargets,
  onGenerateOutputPrompt,
  onDrop,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onRemoveAttachment,
  onClearAttachments,
  highlightLatestAssistantOnly = false,
  disableOutputGenerate = false,
  outputGenerateCostCredits = null,
}) => {
  const messagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const latestAssistantMessageIndex = (() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index]?.role === "assistant") {
        return index;
      }
    }
    return -1;
  })();
  const outputGenerateCostLabel =
    outputGenerateCostCredits != null ? outputGenerateCostCredits.toLocaleString() : "—";

  useEffect(() => {
    const messagesEl = messagesRef.current;
    if (messagesEl) {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  }, [messages, stagedPrompt, stagedAttachments.length]);

  useEffect(
    () => () => {
      if (typeof document === "undefined") return;
      document.querySelectorAll(".agent-message-drag-ghost").forEach((node) => {
        node.parentNode?.removeChild(node);
      });
    },
    []
  );

  const handleMessageClick = useCallback(
    (message: AgentMessage) => {
      if (!onMessageClick) return;
      if (message.role === "assistant" || message.role === "user") {
        onMessageClick(message);
      }
    },
    [onMessageClick]
  );

  const handleMessageKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>, message: AgentMessage) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      handleMessageClick(message);
    },
    [handleMessageClick]
  );

  const handleInputKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== "Enter" || event.shiftKey) return;
      event.preventDefault();
      if (disabled || isSending) return;
      onSend();
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    [disabled, isSending, onSend]
  );

  const handleSendClick = useCallback(() => {
    if (disabled || isSending) return;
    onSend();
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [disabled, isSending, onSend]);

  const handlePromptDragStart = useCallback(
    (event: React.DragEvent<HTMLDivElement>, promptText: string) => {
      const normalizedPrompt = promptText.trim();
      if (!normalizedPrompt) {
        event.preventDefault();
        return;
      }
      event.dataTransfer.effectAllowed = "copy";
      event.dataTransfer.setData("text/plain", normalizedPrompt);
      event.dataTransfer.setData("text/prompt", normalizedPrompt);
      const source = event.currentTarget;
      if (typeof event.dataTransfer.setDragImage === "function") {
        try {
          const { ghost, offsetX, offsetY } = createPromptDragGhost(source);
          event.dataTransfer.setDragImage(ghost, offsetX, offsetY);
        } catch {
          event.dataTransfer.setDragImage(source, source.offsetWidth / 2, source.offsetHeight / 2);
        }
      }
      source.classList.add("is-dragging");
    },
    []
  );

  const handlePromptDragEnd = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    const source = event.currentTarget;
    source.classList.remove("is-dragging");
    clearPromptDragGhost(source);
  }, []);

  const handleOutputGenerateClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>, promptText: string) => {
      event.stopPropagation();
      if (disableOutputGenerate) return;
      const normalizedPrompt = promptText.trim();
      if (!normalizedPrompt) return;
      onGenerateOutputPrompt?.(normalizedPrompt);
    },
    [disableOutputGenerate, onGenerateOutputPrompt]
  );

  return (
    <div
      className={`agent-chat-panel${highlightLatestAssistantOnly ? " agent-chat-panel--latest-assistant-only" : ""}`}
    >
      {showMessages ? (
        <div
          className={`agent-chat-surface${isDropActive ? " is-drop-active" : ""}`}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
        >
          <div className="agent-chat-surface-head">
            {dropHintText ? (
              <p className="tiny helper-text agent-drop-hint">{dropHintText}</p>
            ) : null}
            {showClearAttachmentsButton && stagedAttachments.length && onClearAttachments ? (
              <button
                type="button"
                className="ghost-btn mini agent-attachment-clear-btn"
                onClick={onClearAttachments}
                aria-label="Clear attached references"
              >
                Clear refs
              </button>
            ) : null}
          </div>
          {introMessage || stagedPrompt || messages.length > 0 || stagedAttachments.length > 0 ? (
            <div className="agent-messages" aria-live="polite" ref={messagesRef}>
              {introMessage ? (
                <div className="agent-message agent-assistant agent-intro">
                  <p className="tiny">{introMessage.content}</p>
                </div>
              ) : null}
              {stagedPrompt ? (
                <div
                  className={`agent-message agent-assistant ${
                    highlightLatestAssistantOnly && latestAssistantMessageIndex < 0
                      ? "is-latest-assistant"
                      : ""
                  } is-draggable agent-message--with-output-generate`.trim()}
                  draggable
                  onDragStart={(event) => handlePromptDragStart(event, stagedPrompt)}
                  onDragEnd={handlePromptDragEnd}
                >
                  <p className="tiny">{stagedPrompt}</p>
                  <button
                    type="button"
                    className="reference-generate-pill agent-generate-prefab reference-prompt-generate-pill agent-output-generate-pill"
                    onClick={(event) => handleOutputGenerateClick(event, stagedPrompt)}
                    onDoubleClick={(event) => {
                      event.stopPropagation();
                    }}
                    aria-label="Generate from this agent output"
                    disabled={disableOutputGenerate}
                  >
                    <span className="agent-generate-label">Generate</span>
                    <span className="model-chip-pill generate-pill">
                      <span aria-hidden="true" className="model-chip-icon">
                        ✦
                      </span>
                      <span className="model-chip-credits">{outputGenerateCostLabel}</span>
                    </span>
                  </button>
                </div>
              ) : null}
              {messages.map((message, index) => {
                const isClickable = Boolean(onMessageClick);
                const isDraggable =
                  (message.role === "assistant" || message.role === "user") &&
                  Boolean(message.content.trim());
                const showOutputGenerateButton = message.role === "assistant";
                const isLatestAssistantMessage =
                  highlightLatestAssistantOnly &&
                  message.role === "assistant" &&
                  index === latestAssistantMessageIndex;
                const isStaleAssistantMessage =
                  highlightLatestAssistantOnly &&
                  message.role === "assistant" &&
                  index !== latestAssistantMessageIndex;
                const key =
                  message.id || `${message.role}-${index}-${message.content.slice(0, 12)}`;
                return (
                  <div
                    key={key}
                    className={`agent-message agent-${message.role}${isClickable ? " is-clickable" : ""}${isDraggable ? " is-draggable" : ""}${isLatestAssistantMessage ? " is-latest-assistant" : ""}${isStaleAssistantMessage ? " is-stale-assistant" : ""}${showOutputGenerateButton ? " agent-message--with-output-generate" : ""}`}
                    onClick={isClickable ? () => handleMessageClick(message) : undefined}
                    onKeyDown={
                      isClickable ? (event) => handleMessageKeyDown(event, message) : undefined
                    }
                    role={isClickable ? "button" : undefined}
                    tabIndex={isClickable ? 0 : undefined}
                    draggable={isDraggable}
                    onDragStart={
                      isDraggable
                        ? (event) => handlePromptDragStart(event, message.content)
                        : undefined
                    }
                    onDragEnd={isDraggable ? handlePromptDragEnd : undefined}
                  >
                    <p className="tiny">{message.content}</p>
                    {showOutputGenerateButton ? (
                      <button
                        type="button"
                        className="reference-generate-pill agent-generate-prefab reference-prompt-generate-pill agent-output-generate-pill"
                        onClick={(event) => handleOutputGenerateClick(event, message.content)}
                        onDoubleClick={(event) => {
                          event.stopPropagation();
                        }}
                        aria-label="Generate from this agent output"
                        disabled={disableOutputGenerate}
                      >
                        <span className="agent-generate-label">Generate</span>
                        <span className="model-chip-pill generate-pill">
                          <span aria-hidden="true" className="model-chip-icon">
                            ✦
                          </span>
                          <span className="model-chip-credits">{outputGenerateCostLabel}</span>
                        </span>
                      </button>
                    ) : null}
                  </div>
                );
              })}
              {stagedAttachments.length ? (
                <div
                  className="agent-message agent-user agent-user-attachments"
                  aria-label="Attached references"
                >
                  <div className="agent-attachment-card-list">
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
                          className={`agent-attachment-card agent-attachment-card--${attachment.kind} ${isLinkedPromptRef ? "is-linked-prompt-ref" : ""} ${attachmentStatusClass}`}
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
                          {onRemoveAttachment ? (
                            <button
                              type="button"
                              className="agent-attachment-remove agent-attachment-remove--card"
                              aria-label="Remove attachment"
                              onClick={() => onRemoveAttachment(attachment.id)}
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
            </div>
          ) : (
            <div className="agent-chat-empty tiny">{emptyStateText}</div>
          )}
        </div>
      ) : null}
      {showPromptActions ? (
        <AgentPromptActions
          showPrimaryPromptStatus={showPrimaryPromptStatus}
          primaryPrompt={primaryPrompt}
          primarySource={primarySource}
          actions={agentActions}
          onApplyPrompt={onAgentApplyPrompt}
          onSelectVariation={onAgentSelectVariation}
          onUseQuestion={onAgentUseQuestion}
          onDescribeTargets={onAgentDescribeTargets}
        />
      ) : null}
      {isSending ? (
        <p className="agent-thinking" aria-live="polite">
          Thinking…
        </p>
      ) : null}
      {showInput ? (
        <div className="agent-input-row pill-agent-input-row">
          <AgentInputBar
            ref={inputRef}
            value={input}
            onChange={onInputChange}
            placeholder="Tell the agent what you want or ask it to describe a reference."
            disabled={disabled}
            className="agent-input-prefab-inline"
            onKeyDown={handleInputKeyDown}
          />
          <div className="agent-inline-actions">
            <AgentSendButton
              onClick={handleSendClick}
              disabled={disabled || isSending}
              ariaLabel={sendLabel}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
};
