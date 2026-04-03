/**
 * Dedicated multi-shot toggle card for KIE Kling video runs.
 */
import React from "react";

type ReferenceVideoMultiShotStepProps = {
  order: number;
  enabled: boolean;
  shotCount: number;
  onToggle: () => void;
};

export const ReferenceVideoMultiShotStep: React.FC<ReferenceVideoMultiShotStepProps> = ({
  order,
  enabled,
  shotCount,
  onToggle,
}) => {
  const helperText = enabled
    ? `${shotCount} shot${shotCount === 1 ? "" : "s"} configured for this run.`
    : "Turn on to split this video into multiple shot prompts.";

  return (
    <div className="reference-dropzone-block" style={{ order }}>
      <div className="step-card video-multishot-card">
        <div className="video-settings-toggle-row video-multishot-toggle-row">
          <div className="video-settings-toggle-copy">
            <span className="input-label">Multi-shot</span>
            <span className="tiny helper-text">{enabled ? "Enabled" : "Disabled"}</span>
            <span className="tiny helper-text">{helperText}</span>
          </div>
          <button
            type="button"
            className={`audio-toggle ${enabled ? "is-active" : ""}`}
            aria-pressed={enabled}
            aria-label={enabled ? "Disable multi-shot" : "Enable multi-shot"}
            onClick={onToggle}
          >
            <span className="audio-toggle-track" aria-hidden="true">
              <span className="audio-toggle-dot" />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
