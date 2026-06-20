/**
 * Prefab enhance button aligned with the agent action buttons.
 * Uses the same styling as the send button with a short action label.
 */
import React from "react";
import { MagicWand } from "phosphor-react";

type AgentEnhanceButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  ariaLabel?: string;
  label?: string;
  loadingLabel?: string;
  className?: string;
};

export function AgentEnhanceButton({
  onClick,
  disabled = false,
  loading = false,
  ariaLabel = "Enhance prompt",
  label = "Enhance",
  loadingLabel = "Enhancing",
  className = "",
}: AgentEnhanceButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <button
      type="button"
      className={`agent-send-prefab agent-enhance-prefab ${
        loading ? "is-loading" : ""
      } ${className}`.trim()}
      onClick={onClick}
      disabled={isDisabled}
      aria-label={ariaLabel}
      aria-busy={loading || undefined}
    >
      {loading ? (
        <>
          <span className="agent-send-spinner" aria-hidden />
          <span className="agent-enhance-label">{loadingLabel}</span>
          <span className="sr-only" role="status" aria-live="polite">
            {loadingLabel}
          </span>
        </>
      ) : (
        <>
          <MagicWand size={18} weight="bold" aria-hidden />
          <span className="agent-enhance-label">{label}</span>
        </>
      )}
    </button>
  );
}
