import React from "react";
type MiniGenerateButtonProps = {
  cost: number | string;
  onClick: () => void;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
};

/**
 * Square prefab showing the generation cost; mirrors model-picker pill styling.
 */
export function MiniGenerateButton({
  cost,
  onClick,
  disabled = false,
  ariaLabel = "Generate with current prompt",
  className = "",
}: MiniGenerateButtonProps) {
  const displayCost =
    typeof cost === "number" ? `${cost}` : cost.startsWith("+") ? cost.slice(1) : cost;

  return (
    <button
      type="button"
      className={`agent-cost-prefab ${className}`.trim()}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      <span aria-hidden="true" className="model-chip-icon">✦</span>
      <span className="model-chip-credits">{displayCost}</span>
    </button>
  );
}

// Backward compatibility for existing imports.
export { MiniGenerateButton as AgentCostButton };
