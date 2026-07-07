/**
 * Compact generate button prefab for inline agent controls (cost pill).
 * Designed for reuse wherever we show a quick generate-with-cost action.
 */
import React, { forwardRef, useMemo } from "react";
import { Sparkle } from "phosphor-react";

type MiniGenerateButtonProps = {
  cost: number | string | null | undefined;
  onClick: () => void;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
};

/**
 * Square prefab showing the generation cost; mirrors model-picker pill styling.
 * Visuals intentionally unchanged; code tightened for clarity and reuse.
 */
export const MiniGenerateButton = forwardRef<HTMLButtonElement, MiniGenerateButtonProps>(
  (
    { cost, onClick, disabled = false, ariaLabel = "Generate with current prompt", className = "" },
    ref
  ) => {
    const dataCost = useMemo(() => {
      if (typeof cost === "number") return cost.toString();
      if (typeof cost === "string" && cost.length) {
        return cost.startsWith("+") ? cost.slice(1) : cost;
      }
      return "";
    }, [cost]);

    return (
      <button
        ref={ref}
        type="button"
        className={`agent-cost-prefab ${className}`.trim()}
        onClick={onClick}
        disabled={disabled}
        aria-label={ariaLabel}
        data-cost={dataCost}
      >
        <span className="agent-cost-prefab-label">Generate</span>
        <Sparkle size={22} weight="fill" aria-hidden className="mini-generate-sparkle" />
      </button>
    );
  }
);

MiniGenerateButton.displayName = "MiniGenerateButton";

// Backward compatibility for existing imports.
export { MiniGenerateButton as AgentCostButton };
