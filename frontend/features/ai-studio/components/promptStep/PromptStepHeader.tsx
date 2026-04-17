/**
 * PromptStep header UI.
 * Encapsulates title/subtitle rendering and compact header actions.
 */
import React from "react";
import { CaretDown, Trash } from "phosphor-react";

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

type PromptStepHeaderProps = {
  beginnerMode: boolean;
  stepNumber: string | number;
  effectiveTitle: string;
  visibleSubtitle?: string;
  chatOnly: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onClearAgentChat?: () => void;
  chatHeaderExtraContent?: React.ReactNode;
};

export const PromptStepHeader: React.FC<PromptStepHeaderProps> = ({
  beginnerMode,
  stepNumber,
  effectiveTitle,
  visibleSubtitle,
  chatOnly,
  isCollapsed,
  onToggleCollapse,
  onClearAgentChat,
  chatHeaderExtraContent,
}) => {
  return (
    <div
      className="step-card-header"
      onClick={(e) => {
        e.stopPropagation();
        onToggleCollapse();
      }}
    >
      {beginnerMode ? <span className="step-badge">{stepNumber}</span> : null}
      <div className="step-header-copy">
        <p className="step-title">{effectiveTitle}</p>
        {visibleSubtitle ? (
          <span className="step-subtitle tiny helper-text">{visibleSubtitle}</span>
        ) : null}
      </div>
      <div className="step-header-actions">
        {chatOnly ? (
          <div className="prompt-chat-header-actions">
            {chatHeaderExtraContent ? (
              <div className="prompt-chat-header-extra">{chatHeaderExtraContent}</div>
            ) : null}
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
  );
};
