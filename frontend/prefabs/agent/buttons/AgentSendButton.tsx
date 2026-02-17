/**
 * Reusable send button for agent interactions (pill/round icon button).
 * Keeps visual parity between chat input and prompt actions.
 */
import React from "react";
import { ArrowUp, PaperPlaneTilt } from "phosphor-react";

type AgentSendButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  ariaLabel?: string;
  label?: string;
  className?: string;
  icon?: "paper-plane" | "arrow-up";
};

export function AgentSendButton({
  onClick,
  disabled = false,
  loading = false,
  ariaLabel = "Send to agent",
  label,
  className = "",
  icon = "paper-plane",
}: AgentSendButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <button
      type="button"
      className={`agent-send-prefab ${loading ? "is-loading" : ""} ${className}`.trim()}
      onClick={onClick}
      disabled={isDisabled}
      aria-label={ariaLabel}
      aria-busy={loading || undefined}
    >
      {loading ? (
        <>
          <span className="agent-send-spinner" aria-hidden />
          <span className="sr-only" role="status" aria-live="polite">
            Sending
          </span>
        </>
      ) : (
        <>
          {icon === "arrow-up" ? (
            <ArrowUp size={18} weight="bold" aria-hidden />
          ) : (
            <PaperPlaneTilt size={18} weight="bold" aria-hidden />
          )}
          {label ? <span className="agent-send-prefab-label">{label}</span> : null}
        </>
      )}
    </button>
  );
}
