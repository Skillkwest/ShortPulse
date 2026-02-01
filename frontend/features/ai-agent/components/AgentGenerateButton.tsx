import React from "react";
import { Sparkle } from "phosphor-react";

type AgentGenerateButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  isBusy?: boolean;
  cost: number | string;
};

export function AgentGenerateButton({ onClick, disabled = false, isBusy = false, cost }: AgentGenerateButtonProps) {
  return (
    <button type="button" className="agent-generate-prefab" onClick={onClick} disabled={disabled} aria-label="Generate">
      <span className="agent-generate-label">{isBusy ? "Generating…" : "Generate"}</span>
      <span className="model-chip-pill generate-pill">
        <span aria-hidden="true" className="model-chip-icon">
          ✦
        </span>
        <span className="model-chip-credits">{cost}</span>
      </span>
    </button>
  );
}
