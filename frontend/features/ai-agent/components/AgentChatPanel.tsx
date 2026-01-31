/**
 * Lightweight chat panel to replace prompt textareas.
 * UI stays minimal so existing panel styles remain dominant.
 */
import React, { useCallback, useEffect, useRef } from "react";
import { PaperPlaneTilt, Sparkle } from "phosphor-react";
import type { AgentActions, AgentMessage } from "../types";

type AgentChatPanelProps = {
  messages: AgentMessage[];
  input: string;
  sendLabel?: string;
  disabled?: boolean;
  isSending?: boolean;
  actions?: AgentActions;
  stagedPrompt?: string | null;
  showMessages?: boolean;
  showActions?: boolean;
  showInput?: boolean;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onApplyPrompt?: (prompt: string) => void;
  onSelectVariation?: (prompt: string) => void;
  onMessageClick?: (message: AgentMessage) => void;
};

const renderAssistantActions = (
  actions: AgentActions | undefined,
  handlers: { onApplyPrompt?: (prompt: string) => void; onSelectVariation?: (prompt: string) => void },
) => {
  if (!actions) return null;
  const { applyPrompt } = actions;
  return (
    <div className="agent-actions-row">
      {applyPrompt ? (
        <button type="button" className="primary-btn mini" onClick={() => handlers.onApplyPrompt?.(applyPrompt)}>
          <Sparkle size={14} weight="fill" /> Apply prompt
        </button>
      ) : null}
    </div>
  );
};

export const AgentChatPanel: React.FC<AgentChatPanelProps> = ({
  messages,
  input,
  sendLabel = "Send",
  disabled = false,
  isSending = false,
  actions,
  stagedPrompt = null,
  showMessages = true,
  showActions = true,
  showInput = true,
  onInputChange,
  onSend,
  onApplyPrompt,
  onSelectVariation,
  onMessageClick,
}) => {
  const messagesRef = useRef<HTMLDivElement>(null);

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
    [onMessageClick],
  );

  const handleMessageKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>, message: AgentMessage) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      handleMessageClick(message);
    },
    [handleMessageClick],
  );

  return (
    <div className="agent-chat-panel">
      {showMessages ? (
        <div className="agent-messages" aria-live="polite" ref={messagesRef}>
          {stagedPrompt ? (
            <div className="agent-message agent-assistant">
              <p className="tiny">{stagedPrompt}</p>
            </div>
          ) : null}
          {messages.length === 0 ? <p className="tiny subdued helper-text">Ask the agent for a prompt or describe a reference.</p> : null}
          {messages.map((message, index) => {
            const isClickable = Boolean(onMessageClick);
            const key = message.id || `${message.role}-${index}-${message.content.slice(0, 12)}`;
            return (
              <div
                key={key}
                className={`agent-message agent-${message.role}${isClickable ? " is-clickable" : ""}`}
                onClick={isClickable ? () => handleMessageClick(message) : undefined}
                onKeyDown={isClickable ? (event) => handleMessageKeyDown(event, message) : undefined}
                role={isClickable ? "button" : undefined}
                tabIndex={isClickable ? 0 : undefined}
              >
                <p className="tiny">{message.content}</p>
              </div>
            );
          })}
        </div>
      ) : null}
      {showActions ? renderAssistantActions(actions, { onApplyPrompt, onSelectVariation }) : null}
      {showInput ? (
        <div className="agent-input-row pill-agent-input-row">
          <textarea
            className="prompt-input agent-step-textarea"
            rows={3}
            value={input}
            onChange={(event) => onInputChange(event.target.value)}
            placeholder="Tell the agent what you want or ask it to describe a reference."
          />
          <button
            type="button"
            className="primary-btn agent-send-btn step2-send-btn"
            onClick={onSend}
            disabled={disabled || isSending}
          >
            <PaperPlaneTilt size={18} weight="bold" aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
  );
};
