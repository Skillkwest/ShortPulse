/**
 * Lightweight chat panel to replace prompt textareas.
 * UI stays minimal so existing panel styles remain dominant.
 */
import React, { useCallback, useEffect, useRef } from "react";
import { AgentSendButton } from "../buttons/AgentSendButton";
import { AgentInputBar } from "../inputs/AgentInputBar";
import type { AgentAttachment, AgentMessage } from "../types";

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
  stagedAttachments?: AgentAttachment[];
  isDropActive?: boolean;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onMessageClick?: (message: AgentMessage) => void;
  onDrop?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragOver?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragEnter?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave?: (event: React.DragEvent<HTMLDivElement>) => void;
  onRemoveAttachment?: (id: string) => void;
  onClearAttachments?: () => void;
  beginnerMode?: boolean;
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
  stagedAttachments = [],
  isDropActive = false,
  onInputChange,
  onSend,
  onMessageClick,
  onDrop,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onRemoveAttachment,
  onClearAttachments,
}) => {
  const messagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const messagesEl = messagesRef.current;
    if (messagesEl) {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  }, [messages, stagedPrompt, stagedAttachments.length]);

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

  return (
    <div className="agent-chat-panel">
      {showMessages ? (
        <div
          className={`agent-chat-surface${isDropActive ? " is-drop-active" : ""}`}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
        >
          <div className="agent-chat-surface-head">
            <p className="tiny helper-text agent-drop-hint">
              Drag references here to attach context.
            </p>
            {stagedAttachments.length && onClearAttachments ? (
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
          {stagedAttachments.length ? (
            <div className="agent-attachment-tray" aria-label="Attached references">
              {stagedAttachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className={`agent-attachment-chip agent-attachment-chip--${attachment.kind}`}
                >
                  {attachment.kind === "image" && attachment.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={attachment.imageUrl} alt="" className="agent-attachment-thumb" />
                  ) : null}
                  <div className="agent-attachment-copy">
                    <p className="agent-attachment-title tiny">
                      {attachment.kind === "image" ? "Image Ref" : "Text Ref"}
                    </p>
                    {attachment.text ? (
                      <p className="agent-attachment-text tiny">{attachment.text}</p>
                    ) : null}
                  </div>
                  {onRemoveAttachment ? (
                    <button
                      type="button"
                      className="agent-attachment-remove"
                      aria-label="Remove attachment"
                      onClick={() => onRemoveAttachment(attachment.id)}
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
          {introMessage || stagedPrompt || messages.length > 0 ? (
            <div className="agent-messages" aria-live="polite" ref={messagesRef}>
              {introMessage ? (
                <div className="agent-message agent-assistant agent-intro">
                  <p className="tiny">{introMessage.content}</p>
                </div>
              ) : null}
              {stagedPrompt ? (
                <div className="agent-message agent-assistant">
                  <p className="tiny">{stagedPrompt}</p>
                </div>
              ) : null}
              {messages.map((message, index) => {
                const isClickable = Boolean(onMessageClick);
                const key =
                  message.id || `${message.role}-${index}-${message.content.slice(0, 12)}`;
                return (
                  <div
                    key={key}
                    className={`agent-message agent-${message.role}${isClickable ? " is-clickable" : ""}`}
                    onClick={isClickable ? () => handleMessageClick(message) : undefined}
                    onKeyDown={
                      isClickable ? (event) => handleMessageKeyDown(event, message) : undefined
                    }
                    role={isClickable ? "button" : undefined}
                    tabIndex={isClickable ? 0 : undefined}
                  >
                    <p className="tiny">{message.content}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="agent-chat-empty tiny">
              Drop references and send your next instruction.
            </div>
          )}
        </div>
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
