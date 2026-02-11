/**
 * Lightweight chat panel to replace prompt textareas.
 * UI stays minimal so existing panel styles remain dominant.
 */
import React, { useCallback, useEffect, useRef } from "react";
import { AgentSendButton } from "../buttons/AgentSendButton";
import { AgentInputBar } from "../inputs/AgentInputBar";
import type { AgentMessage } from "../types";

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
  onInputChange: (value: string) => void;
  onSend: () => void;
  onMessageClick?: (message: AgentMessage) => void;
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
  onInputChange,
  onSend,
  onMessageClick,
}) => {
  const messagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const messagesEl = messagesRef.current;
    if (messagesEl) {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  }, [messages, stagedPrompt]);

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
      {showMessages && (introMessage || stagedPrompt || messages.length > 0) ? (
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
            const key = message.id || `${message.role}-${index}-${message.content.slice(0, 12)}`;
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
