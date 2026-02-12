/**
 * Prefab save button aligned with the agent action buttons.
 * Keeps visual parity across prompt/chat surfaces while remaining reusable.
 */
import React from "react";
import { PushPin } from "phosphor-react";

type AgentSaveButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  unstyled?: boolean;
};

/**
 * Square prefab save button (floppy disk icon) matching send/generate styling.
 */
export function AgentSaveButton({
  onClick,
  disabled = false,
  ariaLabel = "Save prompt",
  className = "",
  unstyled = false,
}: AgentSaveButtonProps) {
  const resolvedClassName = unstyled ? className.trim() : `agent-save-prefab ${className}`.trim();

  return (
    <button
      type="button"
      className={resolvedClassName}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      <PushPin size={18} weight="bold" aria-hidden />
    </button>
  );
}
