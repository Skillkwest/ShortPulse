import React from "react";

type Seedance2InputMode = "text" | "first-frame" | "first-last" | "multimodal";

type ReferenceSeedanceAdvancedStepsProps = {
  title: string;
  isSeedance15Model: boolean;
  isSeedance2FamilyModel: boolean;
  displayInputMode: Seedance2InputMode;
  videoCameraFixed: boolean;
  onVideoCameraFixedChange?: (value: boolean) => void;
  seedance2InputMode: Seedance2InputMode;
  seedance2ReferenceImageUrls: string[];
  seedance2ReferenceVideoUrls: string[];
  seedance2ReferenceAudioUrls: string[];
  seedance2ReturnLastFrame: boolean;
  seedance2WebSearch: boolean;
  onSeedance2InputModeChange?: (value: Seedance2InputMode) => void;
  onSeedance2ReferenceImageUrlsChange?: (value: string[]) => void;
  onSeedance2ReferenceVideoUrlsChange?: (value: string[]) => void;
  onSeedance2ReferenceAudioUrlsChange?: (value: string[]) => void;
  onSeedance2ReturnLastFrameChange?: (value: boolean) => void;
  onSeedance2WebSearchChange?: (value: boolean) => void;
};

const parseReferenceTextarea = (value: string): string[] =>
  value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);

const formatReferenceTextarea = (value: string[]): string => value.join("\n");

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
  isSeedance2FamilyModel,
  displayInputMode,
  videoCameraFixed,
  onVideoCameraFixedChange,
  seedance2InputMode,
  seedance2ReferenceImageUrls,
  seedance2ReferenceVideoUrls,
  seedance2ReferenceAudioUrls,
  seedance2ReturnLastFrame,
  seedance2WebSearch,
  onSeedance2InputModeChange,
  onSeedance2ReferenceImageUrlsChange,
  onSeedance2ReferenceVideoUrlsChange,
  onSeedance2ReferenceAudioUrlsChange,
  onSeedance2ReturnLastFrameChange,
  onSeedance2WebSearchChange,
}) => {
  if (!isSeedance15Model && !isSeedance2FamilyModel) return null;

  return (
    <div className="step-card seedance-advanced-card">
      <div className="step-card-header">
        <div className="step-header-copy">
          <p className="step-title">{title}</p>
          <span className="step-subtitle tiny helper-text">
            {isSeedance15Model
              ? "Unified 0-2 image route with fixed-lens control."
              : "Frame lanes plus multimodal image, video, and audio reference support."}
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

      {isSeedance2FamilyModel ? (
        <div className="create-controls seedance-advanced-grid">
          <div className="seedance-mode-section">
            <span className="input-label seedance-mode-label">Active mode</span>
            <div
              className="video-shot-mode-tabs seedance-mode-tabs"
              role="presentation"
              style={
                {
                  "--video-shot-mode-slots": 4,
                  "--video-shot-mode-index":
                    displayInputMode === "first-frame"
                      ? 1
                      : displayInputMode === "first-last"
                        ? 2
                        : displayInputMode === "multimodal"
                          ? 3
                          : 0,
                } as React.CSSProperties
              }
            >
              <span className="video-shot-mode-indicator" aria-hidden="true" />
              <span
                className={`video-shot-mode-tab ${displayInputMode === "text" ? "is-active" : ""}`}
              >
                Text
              </span>
              <span
                className={`video-shot-mode-tab ${displayInputMode === "first-frame" ? "is-active" : ""}`}
              >
                First
              </span>
              <span
                className={`video-shot-mode-tab ${displayInputMode === "first-last" ? "is-active" : ""}`}
              >
                First + Last
              </span>
              <span
                className={`video-shot-mode-tab ${displayInputMode === "multimodal" ? "is-active" : ""}`}
              >
                Multi-Ref
              </span>
            </div>
            <span className="tiny helper-text">
              Frame slots drive text, first-frame, and first/last behavior. Multimodal mode is
              explicit and mutually exclusive with frame inputs.
            </span>
          </div>

          <div className="seedance-toggle-row">
            <div className="seedance-toggle-copy">
              <span className="seedance-toggle-label">Multimodal references</span>
              <span className="seedance-toggle-helper">
                Use external image, video, and audio reference URLs instead of first/last frame
                inputs.
              </span>
            </div>
            <SeedanceToggleButton
              active={seedance2InputMode === "multimodal"}
              ariaLabel={
                seedance2InputMode === "multimodal"
                  ? "Disable multimodal references"
                  : "Enable multimodal references"
              }
              onClick={() =>
                onSeedance2InputModeChange?.(
                  seedance2InputMode === "multimodal" ? "text" : "multimodal"
                )
              }
            />
          </div>

          <div className="seedance-toggle-row">
            <div className="seedance-toggle-copy">
              <span className="seedance-toggle-label">Return last frame</span>
              <span className="seedance-toggle-helper">
                Ask the provider to include the ending frame in the response payload.
              </span>
            </div>
            <SeedanceToggleButton
              active={seedance2ReturnLastFrame}
              ariaLabel={
                seedance2ReturnLastFrame ? "Disable return last frame" : "Enable return last frame"
              }
              onClick={() => onSeedance2ReturnLastFrameChange?.(!seedance2ReturnLastFrame)}
            />
          </div>

          <div className="seedance-toggle-row">
            <div className="seedance-toggle-copy">
              <span className="seedance-toggle-label">Web search</span>
              <span className="seedance-toggle-helper">
                Allow the provider to use web context when it supports that mode.
              </span>
            </div>
            <SeedanceToggleButton
              active={seedance2WebSearch}
              ariaLabel={seedance2WebSearch ? "Disable web search" : "Enable web search"}
              onClick={() => onSeedance2WebSearchChange?.(!seedance2WebSearch)}
            />
          </div>

          {seedance2InputMode === "multimodal" ? (
            <div className="seedance-reference-grid">
              <label className="seedance-reference-field">
                <span className="input-label">Reference image URLs</span>
                <textarea
                  className="model-select kling-textarea seedance-reference-textarea"
                  rows={3}
                  value={formatReferenceTextarea(seedance2ReferenceImageUrls)}
                  onChange={(event) =>
                    onSeedance2ReferenceImageUrlsChange?.(
                      parseReferenceTextarea(event.target.value)
                    )
                  }
                  placeholder="One URL per line or comma-separated"
                />
              </label>
              <label className="seedance-reference-field">
                <span className="input-label">Reference video URLs</span>
                <textarea
                  className="model-select kling-textarea seedance-reference-textarea"
                  rows={3}
                  value={formatReferenceTextarea(seedance2ReferenceVideoUrls)}
                  onChange={(event) =>
                    onSeedance2ReferenceVideoUrlsChange?.(
                      parseReferenceTextarea(event.target.value)
                    )
                  }
                  placeholder="One URL per line or comma-separated"
                />
              </label>
              <label className="seedance-reference-field">
                <span className="input-label">Reference audio URLs</span>
                <textarea
                  className="model-select kling-textarea seedance-reference-textarea"
                  rows={3}
                  value={formatReferenceTextarea(seedance2ReferenceAudioUrls)}
                  onChange={(event) =>
                    onSeedance2ReferenceAudioUrlsChange?.(
                      parseReferenceTextarea(event.target.value)
                    )
                  }
                  placeholder="One URL per line or comma-separated"
                />
              </label>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
