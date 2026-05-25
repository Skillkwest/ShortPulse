/**
 * Reusable small generate button used in agent response bubbles and expert chat-off inline generate.
 * Keeps the compact response-style CTA markup consistent across surfaces while
 * preserving rapid re-click behavior whenever validation keeps the CTA active.
 */
import React, { useMemo } from "react";

type AgentResponseInlineGenerateButtonProps = {
  onClick: () => void;
  costCredits?: number | null;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  stopPropagation?: boolean;
};

export function AgentResponseInlineGenerateButton({
  onClick,
  costCredits = null,
  disabled = false,
  ariaLabel = "Generate",
  className = "",
  stopPropagation = false,
}: AgentResponseInlineGenerateButtonProps) {
  const costLabel = useMemo(
    () => (costCredits != null ? costCredits.toLocaleString() : "—"),
    [costCredits]
  );

  return (
    <button
      type="button"
      className={`agent-response-inline-generate-prefab reference-generate-pill agent-generate-prefab reference-prompt-generate-pill agent-output-generate-pill ${className}`.trim()}
      onClick={(event) => {
        if (stopPropagation) event.stopPropagation();
        onClick();
      }}
      onDoubleClick={(event) => {
        if (stopPropagation) event.stopPropagation();
      }}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      <span className="agent-generate-label">Generate</span>
      <span className="model-chip-pill generate-pill">
        <span aria-hidden="true" className="model-chip-icon">
          ✦
        </span>
        <span className="model-chip-credits">{costLabel}</span>
      </span>
    </button>
  );
}
