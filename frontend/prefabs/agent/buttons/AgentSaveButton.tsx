/**
 * Prefab save button aligned with the agent action buttons.
 * Keeps visual parity across prompt/chat surfaces while remaining reusable.
 */
import React from "react";
import { FloppyDisk } from "phosphor-react";

type AgentSaveButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
};

/**
 * Square prefab save button (floppy disk icon) matching send/generate styling.
 */
export function AgentSaveButton({
  onClick,
  disabled = false,
  ariaLabel = "Save prompt",
  className = "",
}: AgentSaveButtonProps) {
  return (
    <button
      type="button"
      className={`agent-save-prefab ${className}`.trim()}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      <FloppyDisk size={18} weight="bold" aria-hidden />
    </button>
  );
}
