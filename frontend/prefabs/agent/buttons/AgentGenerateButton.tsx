/**
 * Primary call-to-action prefab for generating outputs with the agent.
 * Shared across prompt panels so cost/label layout stays consistent.
 */
import React from "react";

type AgentGenerateButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  isBusy?: boolean;
  cost: number | string;
};

export function AgentGenerateButton({
  onClick,
  disabled = false,
  isBusy = false,
  cost,
}: AgentGenerateButtonProps) {
  return (
    <button
      type="button"
      className={`agent-generate-prefab ${isBusy ? "is-busy" : ""}`.trim()}
      onClick={onClick}
      disabled={disabled}
      aria-label="Generate"
      aria-busy={isBusy || undefined}
    >
      <span className="agent-generate-label">Generate</span>
      <span className="model-chip-pill generate-pill">
        <span aria-hidden="true" className="model-chip-icon">
          ✦
        </span>
        <span className="model-chip-credits">
          {cost} <span className="model-chip-credits-label">credits</span>
        </span>
      </span>
    </button>
  );
}
