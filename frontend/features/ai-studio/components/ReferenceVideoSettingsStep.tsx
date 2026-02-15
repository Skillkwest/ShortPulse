/**
 * Video settings step cards for reference-based generation flows.
 */
import React from "react";
import { ReferenceStepHeaderActionButton } from "./ReferenceStepHeaderActionButton";

type ResolutionOption = { value: string; label: string };

type ReferenceVideoSettingsStepProps = {
  isVideoVariant: boolean;
  isMotionMode: boolean;
  beginnerMode: boolean;
  videoSettingsOrder: number;
  videoSettingsBadge: string;
  motionAudioOrder: number;
  motionAudioBadge: string;
  collapsedVideoSettings: boolean;
  collapsedMotionAudio: boolean;
  videoDurationValue: number;
  videoResolutionValue: string;
  durationOptions: number[];
  resolutionOptions: ResolutionOption[];
  videoGenerateAudioValue: boolean;
  isVeoImageToVideoStandard: boolean;
  isVeoFirstLastModel: boolean;
  isSeedanceI2VModel: boolean;
  videoCameraFixed: boolean;
  isKling3Model: boolean;
  klingShotType: "customize" | "intelligent";
  isVeoModel: boolean;
  videoAutoFix: boolean;
  onExpandVideoSettings: () => void;
  onToggleVideoSettings: () => void;
  onExpandMotionAudio: () => void;
  onToggleMotionAudio: () => void;
  onVideoDurationChange?: (value: number) => void;
  onVideoResolutionChange?: (value: string) => void;
  onVideoGenerateAudioChange?: (value: boolean) => void;
  onVideoCameraFixedChange?: (value: boolean) => void;
  onKlingShotTypeChange?: (value: "customize" | "intelligent") => void;
  onVideoAutoFixChange?: (value: boolean) => void;
};

/**
 * Renders video settings and motion-audio cards.
 */
export const ReferenceVideoSettingsStep: React.FC<ReferenceVideoSettingsStepProps> = ({
  isVideoVariant,
  isMotionMode,
  beginnerMode,
  videoSettingsOrder,
  videoSettingsBadge,
  motionAudioOrder,
  motionAudioBadge,
  collapsedVideoSettings,
  collapsedMotionAudio,
  videoDurationValue,
  videoResolutionValue,
  durationOptions,
  resolutionOptions,
  videoGenerateAudioValue,
  isVeoImageToVideoStandard,
  isVeoFirstLastModel,
  isSeedanceI2VModel,
  videoCameraFixed,
  isKling3Model,
  klingShotType,
  isVeoModel,
  videoAutoFix,
  onExpandVideoSettings,
  onToggleVideoSettings,
  onExpandMotionAudio,
  onToggleMotionAudio,
  onVideoDurationChange,
  onVideoResolutionChange,
  onVideoGenerateAudioChange,
  onVideoCameraFixedChange,
  onKlingShotTypeChange,
  onVideoAutoFixChange,
}) => {
  return (
    <>
      {isVideoVariant && !isMotionMode ? (
        <div
          className={`step-card video-settings-card ${collapsedVideoSettings ? "is-collapsed" : ""}`}
          onClick={onExpandVideoSettings}
          style={{ order: videoSettingsOrder }}
        >
          <div className="step-card-header">
            {beginnerMode && <span className="step-badge">{videoSettingsBadge}</span>}
            <div className="step-header-copy">
              <p className="step-title">Choose Video Settings</p>
              <span className="step-subtitle tiny helper-text">
                Set duration, resolution, and audio output before generating.
              </span>
            </div>
            {!beginnerMode ? (
              <div className="step-header-actions">
                <ReferenceStepHeaderActionButton
                  label="Open video settings"
                  isCollapsed={collapsedVideoSettings}
                  onClick={onToggleVideoSettings}
                />
              </div>
            ) : null}
          </div>
          {!collapsedVideoSettings ? (
            <div className="create-controls video-settings-controls">
              <div className="control-row compact fixed-select">
                <label className="input-label">Duration</label>
                <select
                  className="model-select"
                  value={videoDurationValue}
                  onChange={(event) => onVideoDurationChange?.(Number(event.target.value))}
                >
                  {durationOptions.map((seconds) => (
                    <option value={seconds} key={`duration-${seconds}`}>
                      {seconds} seconds
                    </option>
                  ))}
                </select>
              </div>
              <div className="control-row compact fixed-select">
                <label className="input-label">Resolution</label>
                <select
                  className="model-select"
                  value={videoResolutionValue}
                  onChange={(event) => onVideoResolutionChange?.(event.target.value)}
                >
                  {resolutionOptions.map((option) => (
                    <option value={option.value} key={`resolution-${option.value}`}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="video-settings-toggle-row">
                <div className="video-settings-toggle-copy">
                  <span className="input-label">Generate audio</span>
                  <span className="tiny helper-text">
                    {isVeoImageToVideoStandard
                      ? "Use Veo's optional audio track when enabled."
                      : isVeoFirstLastModel
                        ? "Use Veo's optional audio track when enabled for first/last frame."
                        : "Include ambient audio in the output."}
                  </span>
                </div>
                <button
                  type="button"
                  className={`audio-toggle ${videoGenerateAudioValue ? "is-active" : ""}`}
                  aria-pressed={videoGenerateAudioValue}
                  aria-label={
                    videoGenerateAudioValue ? "Disable audio generation" : "Enable audio generation"
                  }
                  onClick={() => onVideoGenerateAudioChange?.(!videoGenerateAudioValue)}
                >
                  <span className="audio-toggle-track" aria-hidden="true">
                    <span className="audio-toggle-dot" />
                  </span>
                </button>
              </div>

              {isSeedanceI2VModel && (
                <div className="video-settings-toggle-row">
                  <div className="video-settings-toggle-copy">
                    <span className="input-label">Camera Fixed</span>
                    <span className="tiny helper-text">Lock camera position (tripod shot)</span>
                  </div>
                  <button
                    type="button"
                    className={`warm-toggle ${videoCameraFixed ? "is-active" : ""}`}
                    aria-pressed={videoCameraFixed}
                    aria-label={videoCameraFixed ? "Unlock camera" : "Lock camera"}
                    onClick={() => onVideoCameraFixedChange?.(!videoCameraFixed)}
                  >
                    <span className="warm-toggle-track" aria-hidden="true">
                      <span className="warm-toggle-dot" />
                    </span>
                  </button>
                </div>
              )}

              {isKling3Model && (
                <div className="control-row compact fixed-select">
                  <label className="input-label">Shot Type</label>
                  <select
                    className="model-select"
                    value={klingShotType}
                    onChange={(event) =>
                      onKlingShotTypeChange?.(event.target.value as "customize" | "intelligent")
                    }
                  >
                    <option value="intelligent">Intelligent (Auto multi-shot)</option>
                    <option value="customize">Customize (Single shot)</option>
                  </select>
                </div>
              )}

              {isVeoModel && (
                <div className="video-settings-toggle-row">
                  <div className="video-settings-toggle-copy">
                    <span className="input-label">Auto-fix</span>
                    <span className="tiny helper-text">Automatically correct visual issues</span>
                  </div>
                  <button
                    type="button"
                    className={`audio-toggle ${videoAutoFix ? "is-active" : ""}`}
                    aria-pressed={videoAutoFix}
                    aria-label={videoAutoFix ? "Disable auto-fix" : "Enable auto-fix"}
                    onClick={() => onVideoAutoFixChange?.(!videoAutoFix)}
                  >
                    <span className="audio-toggle-track" aria-hidden="true">
                      <span className="audio-toggle-dot" />
                    </span>
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {isMotionMode ? (
        <div
          className={`step-card motion-audio-card ${collapsedMotionAudio ? "is-collapsed" : ""}`}
          onClick={onExpandMotionAudio}
          style={{ order: motionAudioOrder }}
        >
          <div className="step-card-header">
            {beginnerMode && <span className="step-badge">{motionAudioBadge}</span>}
            <div className="step-header-copy">
              <p className="step-title">Audio Settings</p>
              <span className="step-subtitle tiny helper-text">
                Control audio generation for your motion video
              </span>
            </div>
            {!beginnerMode ? (
              <div className="step-header-actions">
                <ReferenceStepHeaderActionButton
                  label="Toggle audio settings"
                  isCollapsed={collapsedMotionAudio}
                  onClick={onToggleMotionAudio}
                />
              </div>
            ) : null}
          </div>
          {!collapsedMotionAudio ? (
            <div className="create-controls motion-audio-controls">
              <div className="video-settings-toggle-row">
                <div className="video-settings-toggle-copy">
                  <span className="input-label">Generate audio</span>
                  <span className="tiny helper-text">
                    Generate ambient audio for the motion video
                  </span>
                </div>
                <button
                  type="button"
                  className={`audio-toggle ${videoGenerateAudioValue ? "is-active" : ""}`}
                  aria-pressed={videoGenerateAudioValue}
                  aria-label={
                    videoGenerateAudioValue ? "Disable audio generation" : "Enable audio generation"
                  }
                  onClick={() => onVideoGenerateAudioChange?.(!videoGenerateAudioValue)}
                >
                  <span className="audio-toggle-track" aria-hidden="true">
                    <span className="audio-toggle-dot" />
                  </span>
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
};
