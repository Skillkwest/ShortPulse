/**
 * Primary call-to-action prefab for generating outputs with the agent.
 * Shared across prompt panels so cost/label layout stays consistent while
 * keeping Generate availability validation-only rather than in-flight-busy driven.
 */
import React from "react";

type AgentGenerateButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  cost: number | null | undefined;
};

export function AgentGenerateButton({ onClick, disabled = false, cost }: AgentGenerateButtonProps) {
  const normalizedCost =
    typeof cost === "number" && Number.isFinite(cost) ? cost.toLocaleString() : null;
  const isDisabled = disabled || normalizedCost == null;

  return (
    <button
      type="button"
      className="agent-generate-prefab"
      onClick={onClick}
      disabled={isDisabled}
      aria-label={normalizedCost == null ? "Generate: cost estimate pending" : "Generate"}
      title={normalizedCost == null ? "Cost estimate pending" : undefined}
    >
      <span className="agent-generate-label">Generate</span>
      <span className="model-chip-pill generate-pill">
        <span aria-hidden="true" className="model-chip-icon">
          ✦
        </span>
        <span className="model-chip-credits">
          {normalizedCost == null ? (
            "Cost pending"
          ) : (
            <>
              {normalizedCost} <span className="model-chip-credits-label">credits</span>
            </>
          )}
        </span>
      </span>
    </button>
  );
}
