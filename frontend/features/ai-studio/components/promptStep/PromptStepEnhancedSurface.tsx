/**
 * PromptStep enhanced prompt surface.
 * Renders prompt textarea plus enhance/save actions.
 */
import React from "react";
import { AgentEnhanceButton, AgentSaveButton } from "../../../../prefabs/agent";

type PromptStepEnhancedSurfaceProps = {
  prompt: string;
  onPromptChange: (value: string) => void;
  handleEnhancedPromptKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  promptThinking: boolean;
  promptPlaceholder: string;
  beginnerMode: boolean;
  beginnerPinHelperText?: string;
  hideEnhanceButton: boolean;
  enhanceOnly: boolean;
  onAgentEnhanceSend?: () => void;
  onAgentSend?: () => void;
  agentIsSending: boolean;
  onSavePrompt: (customPrompt?: string) => void;
  shouldDisableSave: boolean;
  promptSaveButtonClassName: string;
  promptSaveButtonUnstyled: boolean;
};

export const PromptStepEnhancedSurface: React.FC<PromptStepEnhancedSurfaceProps> = ({
  prompt,
  onPromptChange,
  handleEnhancedPromptKeyDown,
  promptThinking,
  promptPlaceholder,
  beginnerMode,
  beginnerPinHelperText,
  hideEnhanceButton,
  enhanceOnly,
  onAgentEnhanceSend,
  onAgentSend,
  agentIsSending,
  onSavePrompt,
  shouldDisableSave,
  promptSaveButtonClassName,
  promptSaveButtonUnstyled,
}) => {
  return (
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
  );
};
