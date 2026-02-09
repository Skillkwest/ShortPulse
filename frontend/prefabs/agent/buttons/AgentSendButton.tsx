/**
 * Reusable send button for agent interactions (pill/round icon button).
 * Keeps visual parity between chat input and prompt actions.
 */
import React from "react";
import { PaperPlaneTilt } from "phosphor-react";

type AgentSendButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
};

export function AgentSendButton({
  onClick,
  disabled = false,
  ariaLabel = "Send to agent",
  className = "",
}: AgentSendButtonProps) {
  return (
    <button
      type="button"
      className={`agent-send-prefab ${className}`.trim()}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      <PaperPlaneTilt size={18} weight="bold" aria-hidden />
    </button>
  );
}
