/**
 * Shared prompt step component for AI Studio.
 * Handles text input ("Enhanced"), Chat mode, and Agent interactions.
 */
import React, { useRef } from "react";
import {
  ArrowsOutSimple,
  CaretDown,
  CloudArrowUp,
  Trash,
} from "phosphor-react";
import { AgentChatPanel } from "../../ai-agent/components/AgentChatPanel";
import { AgentSendButton } from "../../ai-agent/components/AgentSendButton";
import { AgentSaveButton } from "../../ai-agent/components/AgentSaveButton";
import { MiniGenerateButton } from "../../ai-agent/components/MiniGenerateButton";
import { AgentInputBar } from "../../ai-agent/components/AgentInputBar";
import type { AgentActions, AgentMessage } from "../../ai-agent/types";

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
  onGenerate: () => void;
  onSavePrompt: () => void;
  onOpenMediaLibrary?: () => void;
  // State / UI
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  costCredits?: number | null;
  isGenerating?: boolean;
  isGenerateDisabled?: boolean;
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
  onGenerate,
  onSavePrompt,
  onOpenMediaLibrary,
  isCollapsed,
  onToggleCollapse,
  costCredits,
  isGenerating = false,
  isGenerateDisabled = false,
  shouldDisableSave = false,
  onDrop,
  onDragOver,
  className = "",
  beginnerMode = false,
}: PromptStepProps) {
  const [promptMode, setPromptMode] = React.useState<"enhanced" | "chat">("enhanced");
  
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

  const handleCostGenerate = () => {
    onCloseAgentChat?.();
    onGenerate();
  };

  const canExpandChat = agentMessages.length > 0;
  const isChatPromptMode = promptMode === "chat";
  const showMiniGenerateButton = typeof onGenerate === "function"; // Always show if generate handler exists
  const promptThinking = Boolean(agentIsSending || isGenerating);
  const costValue = costCredits != null ? costCredits : "—";

  return (
    <div
      className={`step-card prompt-step ${isCollapsed ? "is-collapsed" : ""} ${className}`}
      onClick={(e) => {
        // Only collapse if clicking the header or specific non-interactive areas if needed.
        // For now, consistent with other steps: clicking container expands if collapsed.
        if (isCollapsed) onToggleCollapse();
      }}
      role="group"
      aria-label={`${title} section`}
      onDrop={onDrop as any}
      onDragOver={onDragOver as any}
    >
      <div className="step-card-header" onClick={(e) => {
          e.stopPropagation();
          onToggleCollapse();
      }}>
        {beginnerMode && <span className="step-badge">{stepNumber}</span>}
        <div className="step-header-copy">
          <p className="step-title">{title}</p>
          <span className="step-subtitle tiny helper-text">{subtitle}</span>
        </div>
        <div className="step-header-actions">
          <StepHeaderActionButton
            label="Open prompt tools"
            isCollapsed={isCollapsed}
            onClick={onToggleCollapse}
          />
        </div>
      </div>
      {!isCollapsed ? (
        agentEnabled ? (
          <>
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
                  <div className="step2-input-row">
                    <AgentInputBar
                      value={agentInput}
                      onChange={(value) => onAgentInputChange?.(value)}
                      placeholder="Tell the agent what you want or ask it to describe a reference."
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
                        {showMiniGenerateButton ? (
                        <MiniGenerateButton
                          cost={costValue}
                          onClick={handleCostGenerate}
                          disabled={isGenerateDisabled || isGenerating}
                          ariaLabel="Generate with current prompt"
                        />
                      ) : null}
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
                      placeholder="Describe what you want, then enhance it."
                      aria-busy={promptThinking}
                    />
                  </div>
                </div>
                <div className="enhanced-actions-row">
                  <div className="ai-control-actions">
                    {onOpenMediaLibrary ? (
                      <button type="button" className="ghost-btn mini preview-media-btn" onClick={onOpenMediaLibrary}>
                        <CloudArrowUp size={12} weight="regular" /> Media library
                      </button>
                    ) : null}
                  </div>
                  <div className="enhanced-action-buttons agent-inline-actions">
                    <AgentSaveButton
                      onClick={onSavePrompt}
                      disabled={shouldDisableSave}
                      ariaLabel="Save prompt"
                      className="prompt-fab-save"
                    />
                    <AgentSendButton
                      onClick={onAgentEnhanceSend ?? onAgentSend ?? (() => {})}
                      disabled={agentIsSending}
                      ariaLabel="Send to agent"
                      className="prompt-fab-send"
                    />
                    {showMiniGenerateButton ? (
                      <MiniGenerateButton
                        cost={costValue}
                        onClick={handleCostGenerate}
                        disabled={isGenerateDisabled || isGenerating}
                        ariaLabel="Generate with current prompt"
                      />
                    ) : null}
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
