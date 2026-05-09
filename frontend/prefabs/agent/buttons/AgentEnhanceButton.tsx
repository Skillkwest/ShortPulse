/**
 * Prefab enhance button aligned with the agent action buttons.
 * Uses the same styling as the send button with a short action label.
 */
import React from "react";
import { MagicWand } from "phosphor-react";

type AgentEnhanceButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
};

export function AgentEnhanceButton({
  onClick,
  disabled = false,
  ariaLabel = "Enhance prompt",
  className = "",
}: AgentEnhanceButtonProps) {
  return (
    <button
      type="button"
      className={`agent-send-prefab agent-enhance-prefab ${className}`.trim()}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      <MagicWand size={18} weight="bold" aria-hidden />
      <span className="agent-enhance-label">Enhance</span>
    </button>
  );
}
