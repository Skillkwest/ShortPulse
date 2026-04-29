import React from "react";

type ReferenceSeedanceAdvancedStepsProps = {
  title: string;
  isSeedance15Model: boolean;
  videoCameraFixed: boolean;
  onVideoCameraFixedChange?: (value: boolean) => void;
};

function SeedanceToggleButton({
  active,
  ariaLabel,
  onClick,
}: {
  active: boolean;
  ariaLabel: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={`video-settings-prefab__toggle${active ? " is-active" : ""}`}
      aria-pressed={active}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      <span className="video-settings-prefab__toggle-track" aria-hidden="true">
        <span className="video-settings-prefab__toggle-dot" />
      </span>
    </button>
  );
}

export const ReferenceSeedanceAdvancedSteps: React.FC<ReferenceSeedanceAdvancedStepsProps> = ({
  title,
  isSeedance15Model,
  videoCameraFixed,
  onVideoCameraFixedChange,
}) => {
  if (!isSeedance15Model) return null;

  return (
    <div className="step-card seedance-advanced-card">
      <div className="step-card-header">
        <div className="step-header-copy">
          <p className="step-title">{title}</p>
          <span className="step-subtitle tiny helper-text">
            Unified 0-2 image route with fixed-lens control.
          </span>
        </div>
      </div>

      {isSeedance15Model ? (
        <div className="create-controls seedance-advanced-grid">
          <div className="video-settings-prefab__toggle-row">
            <span className="video-settings-prefab__toggle-label">Camera Fixed</span>
            <SeedanceToggleButton
              active={videoCameraFixed}
              ariaLabel={videoCameraFixed ? "Unlock camera" : "Lock camera"}
              onClick={() => onVideoCameraFixedChange?.(!videoCameraFixed)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
};
