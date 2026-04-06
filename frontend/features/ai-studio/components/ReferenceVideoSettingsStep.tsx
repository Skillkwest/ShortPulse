/**
 * Inline video settings card.
 */
import React from "react";
import Image from "next/image";
import { AspectDropdown } from "./AspectDropdown";
import { stripEditLabel } from "../utils/modelLabels";
import type { AspectOption } from "../types";
import type { ModelModalContext } from "./ModelModal";

type ResolutionOption = { value: string; label: string };

type VideoSettingsDropdownOption<T extends string | number> = {
  value: T;
  label: string;
};

type VideoSettingsModelPickerButtonProps = {
  modelId: string | null;
  modelLabel: string;
  modelLogoSrc?: string;
  isModelModalOpen: boolean;
  modelModalAnchor: string | null;
  modelModalContext?: ModelModalContext | null;
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
  modelModalContext = "reference-video",
  onModelPickerOpen,
}) => (
  <button
    type="button"
    className={`model-picker-btn ${!modelId ? "is-empty" : ""} ${isModelModalOpen && modelModalAnchor === "video-settings-model" ? "is-open" : ""}`}
    data-model-anchor="video-settings-model"
    onClick={(event) =>
      onModelPickerOpen("video-settings-model", event.currentTarget, modelModalContext)
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

type VideoSettingsListDropdownProps<T extends string | number> = {
  value: T;
  options: VideoSettingsDropdownOption<T>[];
  onSelect?: (value: T) => void;
  ariaLabel: string;
  triggerClassName: string;
};

function VideoSettingsListDropdown<T extends string | number>({
  value,
  options,
  onSelect,
  ariaLabel,
  triggerClassName,
}: VideoSettingsListDropdownProps<T>) {
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement | null>(null);
  const selectedOption = React.useMemo(
    () => options.find((option) => option.value === value) ?? options[0],
    [options, value]
  );

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const isDisabled = !onSelect || options.length === 0;

  return (
    <div className="aspect-dropdown video-settings-list-dropdown" ref={dropdownRef}>
      <button
        type="button"
        className={`${triggerClassName}${isOpen ? " is-open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        disabled={isDisabled}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="video-settings-list-dropdown-value">{selectedOption?.label ?? value}</span>
      </button>
      {isOpen ? (
        <div
          className="aspect-menu video-settings-list-dropdown-menu"
          role="listbox"
          aria-label={ariaLabel}
        >
          {options.map((option) => {
            const isActive = option.value === value;
            return (
              <button
                type="button"
                key={String(option.value)}
                className={`aspect-menu-item video-settings-list-dropdown-option${isActive ? " is-active" : ""}`}
                role="option"
                aria-selected={isActive}
                onClick={() => {
                  onSelect?.(option.value);
                  setIsOpen(false);
                }}
              >
                <span className="video-settings-list-dropdown-option-label">{option.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

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
  modelModalContext?: ModelModalContext | null;
  aspect: string;
  aspectOptionsForModel: AspectOption[];
  videoSettingsOrder: number;
  motionAudioOrder: number;
  videoDurationValue: number;
  videoResolutionValue: string;
  durationOptions: number[];
  resolutionOptions: ResolutionOption[];
  videoGenerateAudioValue: boolean;
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
  modelId,
  modelLabel,
  modelLogoSrc,
  isModelModalOpen,
  modelModalAnchor,
  modelModalContext = "reference-video",
  aspect,
  aspectOptionsForModel,
  videoSettingsOrder,
  motionAudioOrder,
  videoDurationValue,
  videoResolutionValue,
  durationOptions,
  resolutionOptions,
  videoGenerateAudioValue,
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
  const shouldShowResolutionControl = resolutionOptions.length > 0;
  const settingsOrder = isMotionMode ? motionAudioOrder : videoSettingsOrder;
  const isVeo31Model =
    modelId?.includes("veo3.1") === true || modelId?.includes("veo-3.1") === true;
  const shouldShowSeedanceCameraFixed = false;
  const resolutionDropdownOptions = React.useMemo(
    () => resolutionOptions.map((option) => ({ value: option.value, label: option.label })),
    [resolutionOptions]
  );
  const durationDropdownOptions = React.useMemo(
    () =>
      durationOptions.map((seconds) => ({
        value: seconds,
        label: `${seconds} seconds`,
      })),
    [durationOptions]
  );

  if (!isVideoVariant) return null;

  const settingsContent = (
    <>
      <div className="step-card video-settings-card">
        <div className="video-settings-card-title">Video Settings</div>
        {showModelRow ? (
          <div className="video-settings-card-model-row">
            <VideoSettingsModelPickerButton
              modelId={modelId}
              modelLabel={modelLabel}
              modelLogoSrc={modelLogoSrc}
              isModelModalOpen={isModelModalOpen}
              modelModalAnchor={modelModalAnchor}
              modelModalContext={modelModalContext}
              onModelPickerOpen={onModelPickerOpen}
            />
          </div>
        ) : null}
        <div className="video-settings-inline-controls">
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
            <div className="video-settings-inline-dual-row">
              <div className="control-row compact video-settings-resolution-select-row">
                <VideoSettingsListDropdown
                  ariaLabel="Video resolution"
                  triggerClassName="aspect-trigger video-settings-list-dropdown-trigger"
                  value={videoResolutionValue}
                  options={resolutionDropdownOptions}
                  onSelect={onVideoResolutionChange}
                />
              </div>
              <div className="control-row compact video-settings-duration-select-row">
                <VideoSettingsListDropdown
                  ariaLabel="Video duration"
                  triggerClassName="aspect-trigger video-settings-list-dropdown-trigger"
                  value={videoDurationValue}
                  options={durationDropdownOptions}
                  onSelect={onVideoDurationChange}
                />
              </div>
            </div>
          ) : null}
          {!shouldShowResolutionControl ? (
            <div className="control-row compact video-settings-duration-select-row">
              <VideoSettingsListDropdown
                ariaLabel="Video duration"
                triggerClassName="aspect-trigger video-settings-list-dropdown-trigger"
                value={videoDurationValue}
                options={durationDropdownOptions}
                onSelect={onVideoDurationChange}
              />
            </div>
          ) : null}
          <div className="video-settings-toggle-row video-settings-toggle-row--compact">
            <span className="input-label">Generate audio</span>
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

          {showMultiShotToggle ? (
            <div className="video-settings-toggle-row video-settings-toggle-row--compact">
              <span className="input-label">Multi-shot</span>
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

          {!isMotionMode && isSeedanceI2VModel && shouldShowSeedanceCameraFixed ? (
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

          {!isMotionMode && isVeoModel && !isVeo31Model ? (
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
        </div>
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
