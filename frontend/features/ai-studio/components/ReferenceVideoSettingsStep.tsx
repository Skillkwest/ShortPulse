/**
 * Video settings summary card with compact pop-up editor.
 */
import React from "react";
import Image from "next/image";
import { X } from "phosphor-react";
import { AspectDropdown } from "./AspectDropdown";
import { stripEditLabel } from "../utils/modelLabels";
import type { AspectOption } from "../types";
import type { ModelModalContext } from "./ModelModal";

type ResolutionOption = { value: string; label: string };

type VideoSettingsModelPickerButtonProps = {
  modelId: string | null;
  modelLabel: string;
  modelLogoSrc?: string;
  isModelModalOpen: boolean;
  modelModalAnchor: string | null;
  onModelPickerOpen: (
    anchorId: string,
    target: HTMLElement,
    context?: ModelModalContext | null
  ) => void;
};

export const VideoSettingsModelPickerButton: React.FC<VideoSettingsModelPickerButtonProps> = ({
  modelId,
  modelLabel,
  modelLogoSrc,
  isModelModalOpen,
  modelModalAnchor,
  onModelPickerOpen,
}) => (
  <button
    type="button"
    className={`model-picker-btn ${!modelId ? "is-empty" : ""} ${isModelModalOpen && modelModalAnchor === "video-settings-model" ? "is-open" : ""}`}
    data-model-anchor="video-settings-model"
    onClick={(event) =>
      onModelPickerOpen("video-settings-model", event.currentTarget, "reference-video")
    }
  >
    <div className="model-picker-row">
      <span className="model-picker-value">
        {modelLogoSrc ? (
          <Image
            className="model-chip-logo-img"
            src={modelLogoSrc}
            alt=""
            aria-hidden
            width={80}
            height={20}
          />
        ) : null}
        <span className="model-picker-name">{stripEditLabel(modelLabel)}</span>
      </span>
    </div>
  </button>
);

type ReferenceVideoSettingsStepProps = {
  isVideoVariant: boolean;
  isMotionMode: boolean;
  showMultiShotToggle?: boolean;
  multiShotEnabled?: boolean;
  multiShotShotCount?: number;
  modelId: string | null;
  modelLabel: string;
  modelLogoSrc?: string;
  isModelModalOpen: boolean;
  modelModalAnchor: string | null;
  aspect: string;
  aspectOptionsForModel: AspectOption[];
  videoSettingsOrder: number;
  motionAudioOrder: number;
  videoDurationValue: number;
  videoResolutionValue: string;
  durationOptions: number[];
  resolutionOptions: ResolutionOption[];
  videoGenerateAudioValue: boolean;
  isVeoImageToVideoStandard: boolean;
  isVeoFirstLastModel: boolean;
  isSeedanceI2VModel: boolean;
  videoCameraFixed: boolean;
  isVeoModel: boolean;
  videoAutoFix: boolean;
  onAspectChange: (value: string) => void;
  onModelPickerOpen: (
    anchorId: string,
    target: HTMLElement,
    context?: ModelModalContext | null
  ) => void;
  showModelRow?: boolean;
  inlineAside?: boolean;
  onVideoDurationChange?: (value: number) => void;
  onVideoResolutionChange?: (value: string) => void;
  onVideoGenerateAudioChange?: (value: boolean) => void;
  onVideoCameraFixedChange?: (value: boolean) => void;
  onVideoAutoFixChange?: (value: boolean) => void;
  onToggleMultiShot?: () => void;
};

export const ReferenceVideoSettingsStep: React.FC<ReferenceVideoSettingsStepProps> = ({
  isVideoVariant,
  isMotionMode,
  showMultiShotToggle = false,
  multiShotEnabled = false,
  multiShotShotCount = 0,
  modelId,
  modelLabel,
  modelLogoSrc,
  isModelModalOpen,
  modelModalAnchor,
  aspect,
  aspectOptionsForModel,
  videoSettingsOrder,
  motionAudioOrder,
  videoDurationValue,
  videoResolutionValue,
  durationOptions,
  resolutionOptions,
  videoGenerateAudioValue,
  isVeoImageToVideoStandard,
  isVeoFirstLastModel,
  isSeedanceI2VModel,
  videoCameraFixed,
  isVeoModel,
  videoAutoFix,
  onAspectChange,
  onModelPickerOpen,
  showModelRow = true,
  inlineAside = false,
  onVideoDurationChange,
  onVideoResolutionChange,
  onVideoGenerateAudioChange,
  onVideoCameraFixedChange,
  onVideoAutoFixChange,
  onToggleMultiShot,
}) => {
  const [isEditorOpen, setIsEditorOpen] = React.useState(false);
  const shouldShowResolutionControl = resolutionOptions.length > 0;
  const settingsOrder = isMotionMode ? motionAudioOrder : videoSettingsOrder;

  React.useEffect(() => {
    if (!isVideoVariant) {
      setIsEditorOpen(false);
    }
  }, [isVideoVariant]);

  React.useEffect(() => {
    if (!isEditorOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsEditorOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isEditorOpen]);

  const summaryItems = isMotionMode
    ? [
        aspect,
        shouldShowResolutionControl ? videoResolutionValue : null,
        videoGenerateAudioValue ? "Audio on" : "Audio off",
      ]
    : [
        aspect,
        `${videoDurationValue} seconds`,
        shouldShowResolutionControl ? videoResolutionValue : null,
        videoGenerateAudioValue ? "Audio on" : "Audio off",
        isSeedanceI2VModel ? (videoCameraFixed ? "Camera fixed" : "Camera free") : null,
        isVeoModel ? (videoAutoFix ? "Auto-fix on" : "Auto-fix off") : null,
        showMultiShotToggle ? (multiShotEnabled ? "Multi-shot on" : "Multi-shot off") : null,
      ].filter(Boolean);

  const editorTitle = isMotionMode ? "Motion Settings" : "Video Settings";
  const summaryTitle = isMotionMode ? "Motion settings" : "Video settings";
  const audioHelperText = isMotionMode
    ? "Generate ambient audio for the motion video"
    : isVeoImageToVideoStandard
      ? "Use Veo's optional audio track when enabled."
      : isVeoFirstLastModel
        ? "Use Veo's optional audio track when enabled for first/last frame."
        : "Include ambient audio in the output.";
  const multiShotHelperText = multiShotEnabled
    ? `${multiShotShotCount} shot${multiShotShotCount === 1 ? "" : "s"} configured for this run.`
    : "Turn on to split this video into multiple shot prompts.";

  if (!isVideoVariant) return null;

  const settingsContent = (
    <>
      <div className="step-card video-settings-card video-settings-summary-card">
        {showModelRow ? (
          <div className="video-settings-card-model-row">
            <VideoSettingsModelPickerButton
              modelId={modelId}
              modelLabel={modelLabel}
              modelLogoSrc={modelLogoSrc}
              isModelModalOpen={isModelModalOpen}
              modelModalAnchor={modelModalAnchor}
              onModelPickerOpen={onModelPickerOpen}
            />
          </div>
        ) : null}
        <button
          type="button"
          className="video-settings-summary-surface"
          onClick={() => setIsEditorOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={isEditorOpen}
        >
          <div className="video-settings-summary-header">
            <div className="video-settings-summary-title-group">
              <span className="video-settings-summary-kicker">{summaryTitle}</span>
            </div>
          </div>
          <div className="video-settings-summary-grid">
            {summaryItems.map((item) => (
              <span className="video-settings-summary-chip" key={item}>
                {item}
              </span>
            ))}
          </div>
        </button>

        {isEditorOpen ? (
          <>
            <button
              type="button"
              className="video-settings-popover-backdrop"
              aria-label="Close settings editor"
              onClick={() => setIsEditorOpen(false)}
            />
            <div className="video-settings-popover" role="dialog" aria-modal="true">
              <div className="video-settings-popover-header">
                <div className="video-settings-popover-copy">
                  <p className="video-settings-popover-title">{editorTitle}</p>
                  <p className="video-settings-popover-subtitle">
                    Configure the controls shown on the summary surface.
                  </p>
                </div>
                <button
                  type="button"
                  className="video-settings-popover-close"
                  onClick={() => setIsEditorOpen(false)}
                  aria-label="Close settings editor"
                >
                  <X size={14} weight="bold" />
                </button>
              </div>

              <div className="video-settings-popover-body">
                <div className="video-settings-popover-inline-row">
                  <div
                    className={`control-row compact ${shouldShowResolutionControl ? "" : "video-settings-full-row"}`}
                  >
                    <AspectDropdown
                      aspect={aspect}
                      onSelect={onAspectChange}
                      options={aspectOptionsForModel}
                    />
                  </div>
                  {shouldShowResolutionControl ? (
                    <div className="control-row compact fixed-select">
                      <select
                        className="model-select"
                        value={videoResolutionValue}
                        onChange={(event) => onVideoResolutionChange?.(event.target.value)}
                      >
                        {resolutionOptions.map((option) => (
                          <option
                            value={option.value}
                            key={`${isMotionMode ? "motion-" : ""}resolution-${option.value}`}
                          >
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                </div>
                {!isMotionMode ? (
                  <div className="video-settings-popover-inline-row">
                    <div className="control-row compact fixed-select">
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
                    <div className="video-settings-toggle-row video-settings-toggle-row--compact">
                      <span className="input-label">Generate audio</span>
                      <button
                        type="button"
                        className={`audio-toggle ${videoGenerateAudioValue ? "is-active" : ""}`}
                        aria-pressed={videoGenerateAudioValue}
                        aria-label={
                          videoGenerateAudioValue
                            ? "Disable audio generation"
                            : "Enable audio generation"
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
                {isMotionMode ? (
                  <div className="video-settings-toggle-row">
                    <div className="video-settings-toggle-copy">
                      <span className="input-label">Generate audio</span>
                      <span className="tiny helper-text">{audioHelperText}</span>
                    </div>
                    <button
                      type="button"
                      className={`audio-toggle ${videoGenerateAudioValue ? "is-active" : ""}`}
                      aria-pressed={videoGenerateAudioValue}
                      aria-label={
                        videoGenerateAudioValue
                          ? "Disable audio generation"
                          : "Enable audio generation"
                      }
                      onClick={() => onVideoGenerateAudioChange?.(!videoGenerateAudioValue)}
                    >
                      <span className="audio-toggle-track" aria-hidden="true">
                        <span className="audio-toggle-dot" />
                      </span>
                    </button>
                  </div>
                ) : null}

                {!isMotionMode && isSeedanceI2VModel ? (
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
                ) : null}

                {!isMotionMode && isVeoModel ? (
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
                ) : null}

                {showMultiShotToggle ? (
                  <div className="video-settings-toggle-row">
                    <div className="video-settings-toggle-copy">
                      <span className="input-label">Multi-shot</span>
                      <span className="tiny helper-text">
                        {multiShotEnabled ? "Enabled" : "Disabled"}
                      </span>
                      <span className="tiny helper-text">{multiShotHelperText}</span>
                    </div>
                    <button
                      type="button"
                      className={`audio-toggle ${multiShotEnabled ? "is-active" : ""}`}
                      aria-pressed={multiShotEnabled}
                      aria-label={multiShotEnabled ? "Disable multi-shot" : "Enable multi-shot"}
                      onClick={() => onToggleMultiShot?.()}
                    >
                      <span className="audio-toggle-track" aria-hidden="true">
                        <span className="audio-toggle-dot" />
                      </span>
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </>
  );

  if (inlineAside) {
    return <div className="video-settings-inline-aside">{settingsContent}</div>;
  }

  return (
    <div className="reference-dropzone-block" style={{ order: settingsOrder }}>
      {settingsContent}
    </div>
  );
};
