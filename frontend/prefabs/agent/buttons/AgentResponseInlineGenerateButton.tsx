/**
 * Reusable small generate button used in agent response bubbles and expert chat-off inline generate.
 * Keeps the compact response-style CTA markup consistent across surfaces while
 * leaving duplicate-click suppression to the owning generation lane.
 */
import React from "react";

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
  const costDescriptionId = React.useId();
  const hasKnownCost = typeof costCredits === "number" && Number.isFinite(costCredits);
  const costLabel = hasKnownCost ? costCredits.toLocaleString() : "Cost pending";
  const isDisabled = disabled || !hasKnownCost;

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
      disabled={isDisabled}
      aria-label={ariaLabel}
      aria-describedby={costDescriptionId}
    >
      <span className="agent-generate-label">Generate</span>
      <span className="model-chip-pill generate-pill">
        <span aria-hidden="true" className="model-chip-icon">
          ✦
        </span>
        <span id={costDescriptionId} className="model-chip-credits">
          {costLabel}
        </span>
      </span>
    </button>
  );
}
