/**
 * Generate step card for reference-based generation flows.
 */
import React from "react";
import { AgentGenerateButton } from "../../../prefabs/agent";

type ReferenceGenerateStepProps = {
  beginnerMode: boolean;
  collapsed: boolean;
  generateOrder: number;
  generateBadge: string;
  onExpand: () => void;
  onRegenerate: () => void;
  isGenerateDisabled: boolean;
  isBusy: boolean;
  costCredits?: number | null;
  referenceImageWarning?: string | null;
};

/**
 * Renders the final generation action card.
 */
export const ReferenceGenerateStep: React.FC<ReferenceGenerateStepProps> = ({
  beginnerMode,
  collapsed,
  generateOrder,
  generateBadge,
  onExpand,
  onRegenerate,
  isGenerateDisabled,
  isBusy,
  costCredits,
  referenceImageWarning,
}) => {
  return (
    <div
      className={`step-card reference-generate-step ${collapsed ? "is-collapsed" : ""}`}
      onClick={onExpand}
      style={{ order: generateOrder }}
    >
      {beginnerMode ? (
        <div className="step-card-header">
          <span className="step-badge">{generateBadge}</span>
          <div className="step-header-copy">
            <p className="step-title">Generate</p>
            <span className="step-subtitle tiny helper-text">
              Run generation with the current prompt and selections.
            </span>
          </div>
        </div>
      ) : null}
      {!collapsed ? (
        <div className="create-controls single-control">
          <AgentGenerateButton
            onClick={onRegenerate}
            disabled={isGenerateDisabled}
            isBusy={isBusy}
            cost={costCredits != null ? costCredits : "—"}
          />
          {referenceImageWarning && (
            <div
              className="reference-image-warning"
              style={{
                marginTop: "8px",
                padding: "8px 12px",
                backgroundColor: "#FEF3C7",
                border: "1px solid #FCD34D",
                borderRadius: "6px",
                fontSize: "12px",
                lineHeight: "1.4",
                color: "#92400E",
              }}
            >
              ⚠️ {referenceImageWarning}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};
