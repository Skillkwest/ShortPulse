/**
 * Shared prompt step component for AI Studio.
 * Handles text input ("Text"), Chat mode, and Agent interactions.
 */
import React, { useRef } from "react";
import { ArrowsOutSimple, CaretDown, FloppyDisk, Trash } from "phosphor-react";
import {
  AgentChatPanel,
  AgentEnhanceButton,
  AgentSendButton,
  AgentSaveButton,
  AgentInputBar,
} from "../../../prefabs/agent";
import type { AgentActions, AgentMessage } from "../../../prefabs/agent";
import { PromptLibraryButton } from "./PromptLibraryButton";

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
  stagedPrompt?: string | null;
  agentChatOpen?: boolean;
  onAgentInputChange?: (value: string) => void;
  onAgentSend?: () => void;
  onAgentEnhanceSend?: () => void;
  onAgentMessageClick?: (message: AgentMessage) => void;
  onExpandChat?: () => void;
  onCloseAgentChat?: () => void;
  onClearAgentChat?: () => void;
  // Actions
  onSavePrompt: () => void;
  onOpenMediaLibrary?: () => void;
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
};

export function PromptStep({
  stepNumber,
  title = "Write your prompt",
  subtitle = "Draft the prompt you want to use, or switch to Chat to have the agent craft one for you.",
  prompt,
  onPromptChange,
  agentEnabled = false,
  agentMessages = [],
  agentActions,
  agentInput = "",
  agentIsSending = false,
  agentError,
  stagedPrompt = null,
  agentChatOpen = false,
  onAgentInputChange,
  onAgentSend,
  onAgentEnhanceSend,
  onAgentMessageClick,
  onExpandChat,
  onCloseAgentChat,
  onClearAgentChat,
  onSavePrompt,
  isCollapsed,
  onToggleCollapse,
  isGenerating = false,
  shouldDisableSave = false,
  onDrop,
  onDragOver,
  className = "",
  beginnerMode = false,
}: PromptStepProps) {
  const [promptMode, setPromptMode] = React.useState<"enhanced" | "chat">("enhanced");

  // When beginner mode is on, force enhanced mode and hide chat-specific controls.
  React.useEffect(() => {
    if (beginnerMode && promptMode !== "enhanced") {
      setPromptMode("enhanced");
    }
  }, [beginnerMode, promptMode]);

  const effectiveTitle = beginnerMode ? "Write your prompt" : "Choose Prompt Mode";

  const handleEnhancedPromptKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || agentIsSending) return;
    event.preventDefault();
    onAgentEnhanceSend?.();
  };

  const handleAgentInputKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || agentIsSending) return;
    event.preventDefault();
    onAgentSend?.();
  };

  const canExpandChat = agentMessages.length > 0;
  const isChatPromptMode = promptMode === "chat";
  const promptThinking = Boolean(agentIsSending || isGenerating);
  const lastAssistantMessage = React.useMemo(
    () => [...agentMessages].reverse().find((message) => message.role === "assistant")?.content ?? null,
    [agentMessages],
  );

  React.useEffect(() => {
    if (promptMode !== "chat") return;
    if (!lastAssistantMessage) return;
    if (prompt === lastAssistantMessage) return;
    onPromptChange(lastAssistantMessage);
  }, [promptMode, lastAssistantMessage, prompt, onPromptChange]);

  return (
    <div
      className={`step-card prompt-step ${isCollapsed ? "is-collapsed" : ""} ${className}`}
      onClick={(e) => {
        // Only collapse if clicking the header or specific non-interactive areas if needed.
        // For now, consistent with other steps: clicking container expands if collapsed.
        if (isCollapsed) onToggleCollapse();
      }}
      role="group"
      aria-label={`${effectiveTitle} section`}
      onDrop={onDrop as any}
      onDragOver={onDragOver as any}
    >
        <div className="step-card-header" onClick={(e) => {
          e.stopPropagation();
          onToggleCollapse();
        }}>
          {beginnerMode && <span className="step-badge">{stepNumber}</span>}
          <div className="step-header-copy">
            <p className="step-title">{effectiveTitle}</p>
            <span className="step-subtitle tiny helper-text">{subtitle}</span>
          </div>
          {!beginnerMode ? (
            <div className="step-header-actions">
              <StepHeaderActionButton
                label="Open prompt tools"
                isCollapsed={isCollapsed}
                onClick={onToggleCollapse}
              />
            </div>
          ) : null}
        </div>
      {!isCollapsed ? (
        agentEnabled ? (
          <>
            {(!beginnerMode) ? (
              <div className="prompt-mode-row">
                <div className="prompt-mode-toggle-row prompt-mode-toggle-standalone" role="group" aria-label="Prompt options">
                  <button
                    type="button"
                    className={`ghost-btn small mode-toggle-btn ${promptMode === "enhanced" ? "is-active" : ""}`}
                    aria-pressed={promptMode === "enhanced"}
                    onClick={(e) => { e.stopPropagation(); setPromptMode("enhanced"); }}
                  >
                    Prompt
                  </button>
                  <button
                    type="button"
                    className={`ghost-btn small mode-toggle-btn ${promptMode === "chat" ? "is-active" : ""}`}
                    aria-pressed={promptMode === "chat"}
                    onClick={(e) => { e.stopPropagation(); setPromptMode("chat"); }}
                  >
                    Chat
                  </button>
                </div>
                <div className={`prompt-chat-actions ${promptMode === "chat" ? "is-active" : ""}`}>
                  {onExpandChat ? (
                    <button
                      type="button"
                      className={`ghost-btn mini prompt-expand-btn ${agentChatOpen ? "is-chat-open" : ""}`}
                      onClick={(e) => { e.stopPropagation(); if (canExpandChat) onExpandChat(); }}
                      aria-label="Expand chat"
                      disabled={!canExpandChat}
                      aria-disabled={!canExpandChat}
                    >
                      <ArrowsOutSimple size={20} weight="bold" aria-hidden />
                    </button>
                  ) : null}
                  {onClearAgentChat ? (
                    <button
                      type="button"
                      className="ghost-btn mini prompt-clear-btn"
                      onClick={(e) => { e.stopPropagation(); onClearAgentChat(); }}
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
            {promptMode === "chat" ? (
              agentChatOpen ? null : (
                <>
                  {agentMessages.length > 0 || stagedPrompt ? (
                    <div className="agent-chat-wrapper">
                      <AgentChatPanel
                        messages={agentMessages}
                        input={agentInput}
                        sendLabel="Send"
                        isSending={agentIsSending}
                        showInput={false}
                        onInputChange={(value) => onAgentInputChange?.(value)}
                        onSend={onAgentSend ?? (() => {})}
                        onMessageClick={onAgentMessageClick}
                      />
                    </div>
                  ) : null}
                  <div className="step2-input-row prompt-actions-compact">
                    <AgentInputBar
                      value={agentInput}
                      onChange={(value) => onAgentInputChange?.(value)}
                      placeholder="Tell the agent what you want to make."
                      disabled={agentIsSending}
                      onKeyDown={handleAgentInputKeyDown}
                      className="agent-input-prefab-inline"
                    />
                    <div className="agent-inline-actions">
                      <AgentSendButton
                        onClick={onAgentSend ?? (() => {})}
                        disabled={agentIsSending}
                        ariaLabel="Send to agent"
                      />
                    </div>
                  </div>
                </>
              )
            ) : (
              <>
                <div className="step2-input-row enhanced-mode">
                  <div className="prompt-enhanced-wrapper">
                    {promptThinking ? (
                      <div className="prompt-thinking-overlay" aria-live="polite">
                        <span className="prompt-thinking-text">Thinking…</span>
                      </div>
                    ) : null}
                    <textarea
                      className="prompt-input agent-step-textarea enhanced-prompt-input"
                      value={prompt}
                      onChange={(event) => onPromptChange(event.target.value)}
                      onKeyDown={handleEnhancedPromptKeyDown}
                      rows={6}
                      placeholder="Describe what you want, then refine it."
                      aria-busy={promptThinking}
                    />
                  </div>
                </div>
                <div className="enhanced-actions-row prompt-actions-compact">
                  <div className="ai-control-actions">
                    {!beginnerMode ? (
                      <PromptLibraryButton
                        className="prompt-media-btn prompt-save-btn"
                        aria-label="Save prompt to media library"
                        label="Save Prompt"
                        showLabel={false}
                        icon={<FloppyDisk size={16} weight="regular" aria-hidden />}
                        tone="save"
                      />
                    ) : null}
                  </div>
                  <div className="enhanced-action-buttons agent-inline-actions">
                    <AgentEnhanceButton
                      onClick={onAgentEnhanceSend ?? onAgentSend ?? (() => {})}
                      disabled={agentIsSending}
                      ariaLabel="Enhance prompt"
                      className="prompt-fab-send"
                    />
                    <AgentSaveButton
                      onClick={onSavePrompt}
                      disabled={shouldDisableSave}
                      ariaLabel="Save prompt"
                      className="prompt-fab-save"
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
      {agentEnabled && agentError && !isCollapsed ? <div className="inline-error-hint">{agentError}</div> : null}
    </div>
  );
}
