/**
 * Isolated video settings card prefab for the video properties panel.
 * Owns the card chrome and control styling so the video panel can evolve independently.
 */
import React from "react";
import Image from "next/image";
import { stripEditLabel } from "../utils/modelLabels";
import type { AspectOption } from "../types";
import type { ModelModalContext } from "./ModelModal";

export type VideoSettingsResolutionOption = {
  value: string;
  label: string;
};

type VideoSettingsDropdownOption<T extends string | number> = {
  value: T;
  label: string;
};

export type VideoSettingsCardPrefabProps = {
  showModelRow?: boolean;
  modelId: string | null;
  modelLabel: string;
  modelLogoSrc?: string;
  isModelModalOpen: boolean;
  modelModalAnchor: string | null;
  modelModalContext?: ModelModalContext | null;
  aspect: string;
  aspectOptionsForModel: AspectOption[];
  videoDurationValue: number;
  videoResolutionValue: string;
  durationOptions: number[];
  resolutionOptions: VideoSettingsResolutionOption[];
  videoGenerateAudioValue: boolean;
  showMultiShotToggle?: boolean;
  multiShotEnabled?: boolean;
  isMotionMode: boolean;
  isSeedanceModel: boolean;
  showSeedanceCameraFixedControl?: boolean;
  videoCameraFixed: boolean;
  isVeoModel: boolean;
  videoAutoFix: boolean;
  onAspectChange: (value: string) => void;
  onModelPickerOpen: (
    anchorId: string,
    target: HTMLElement,
    context?: ModelModalContext | null
  ) => void;
  onVideoDurationChange?: (value: number) => void;
  onVideoResolutionChange?: (value: string) => void;
  onVideoGenerateAudioChange?: (value: boolean) => void;
  onVideoCameraFixedChange?: (value: boolean) => void;
  onVideoAutoFixChange?: (value: boolean) => void;
  onToggleMultiShot?: () => void;
};

type PrefabDropdownProps<T extends string | number> = {
  value: T;
  options: VideoSettingsDropdownOption<T>[];
  onSelect?: (value: T) => void;
  ariaLabel: string;
  triggerClassName: string;
  menuClassName: string;
  optionClassName: string;
  renderTriggerValue: (selected: VideoSettingsDropdownOption<T> | undefined) => React.ReactNode;
  renderOption?: (option: VideoSettingsDropdownOption<T>) => React.ReactNode;
};

const toRatioClassName = (value: string): string | null => {
  if (!value.includes(":")) return null;
  return `video-settings-prefab__aspect-shape--ratio-${value.replace(":", "-")}`;
};

function PrefabDropdown<T extends string | number>({
  value,
  options,
  onSelect,
  ariaLabel,
  triggerClassName,
  menuClassName,
  optionClassName,
  renderTriggerValue,
  renderOption,
}: PrefabDropdownProps<T>) {
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement | null>(null);
  const selectedOption = React.useMemo(
    () => options.find((option) => option.value === value) ?? options[0],
    [options, value]
  );

  React.useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handlePointerDown);
    }
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

  return (
    <div className="video-settings-prefab__dropdown" ref={dropdownRef}>
      <button
        type="button"
        className={`${triggerClassName}${isOpen ? " is-open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        disabled={!onSelect || options.length === 0}
        onClick={() => setIsOpen((open) => !open)}
      >
        {renderTriggerValue(selectedOption)}
      </button>
      {isOpen ? (
        <div className={menuClassName} role="listbox" aria-label={ariaLabel}>
          {options.map((option) => {
            const isActive = option.value === value;
            return (
              <button
                type="button"
                key={String(option.value)}
                className={`${optionClassName}${isActive ? " is-active" : ""}`}
                role="option"
                aria-selected={isActive}
                onClick={() => {
                  onSelect?.(option.value);
                  setIsOpen(false);
                }}
              >
                {renderOption ? (
                  renderOption(option)
                ) : (
                  <span className="video-settings-prefab__menu-option-label">{option.label}</span>
                )}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function VideoSettingsPrefabModelButton({
  modelId,
  modelLabel,
  modelLogoSrc,
  isModelModalOpen,
  modelModalAnchor,
  modelModalContext = "reference-video",
  onModelPickerOpen,
}: Pick<
  VideoSettingsCardPrefabProps,
  | "modelId"
  | "modelLabel"
  | "modelLogoSrc"
  | "isModelModalOpen"
  | "modelModalAnchor"
  | "modelModalContext"
  | "onModelPickerOpen"
>) {
  return (
    <button
      type="button"
      className={`video-settings-prefab__model-button ${!modelId ? "is-empty" : ""} ${
        isModelModalOpen && modelModalAnchor === "video-settings-model" ? "is-open" : ""
      }`}
      data-model-anchor="video-settings-model"
      onClick={(event) =>
        onModelPickerOpen("video-settings-model", event.currentTarget, modelModalContext)
      }
    >
      <span className="video-settings-prefab__model-value">
        {modelLogoSrc ? (
          <Image
            className="video-settings-prefab__model-logo"
            src={modelLogoSrc}
            alt=""
            aria-hidden
            width={80}
            height={20}
          />
        ) : null}
        <span className="video-settings-prefab__model-name">{stripEditLabel(modelLabel)}</span>
      </span>
    </button>
  );
}

function VideoSettingsPrefabToggle({
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

/**
 * Renders the isolated video settings card used by the video properties panel.
 * Keeps all existing callbacks and conditional rows intact while avoiding shared selector skins.
 */
export function VideoSettingsCardPrefab({
  showModelRow = true,
  modelId,
  modelLabel,
  modelLogoSrc,
  isModelModalOpen,
  modelModalAnchor,
  modelModalContext = "reference-video",
  aspect,
  aspectOptionsForModel,
  videoDurationValue,
  videoResolutionValue,
  durationOptions,
  resolutionOptions,
  videoGenerateAudioValue,
  showMultiShotToggle = false,
  multiShotEnabled = false,
  isMotionMode,
  isSeedanceModel,
  showSeedanceCameraFixedControl = true,
  videoCameraFixed,
  isVeoModel,
  videoAutoFix,
  onAspectChange,
  onModelPickerOpen,
  onVideoDurationChange,
  onVideoResolutionChange,
  onVideoGenerateAudioChange,
  onVideoCameraFixedChange,
  onVideoAutoFixChange,
  onToggleMultiShot,
}: VideoSettingsCardPrefabProps) {
  const shouldShowResolutionControl = resolutionOptions.length > 0;
  const shouldShowAspectControl = !isMotionMode;
  const shouldShowDurationControl = !isMotionMode;
  const isVeo31Model =
    modelId?.includes("veo3.1") === true || modelId?.includes("veo-3.1") === true;
  const shouldShowSeedanceCameraFixed = showSeedanceCameraFixedControl;
  const resolutionDropdownOptions = React.useMemo(
    () => resolutionOptions.map((option) => ({ value: option.value, label: option.label })),
    [resolutionOptions]
  );
  const durationDropdownOptions = React.useMemo(
    () => durationOptions.map((seconds) => ({ value: seconds, label: `${seconds}s` })),
    [durationOptions]
  );
  const selectedAspect =
    aspectOptionsForModel.find((option) => option.value === aspect) ?? aspectOptionsForModel[0];
  const selectedAspectRatioClass = selectedAspect?.value
    ? toRatioClassName(selectedAspect.value)
    : null;

  return (
    <div className="video-settings-prefab">
      <div className="video-settings-prefab__title">
        {isMotionMode ? "Motion Settings" : "Video Settings"}
      </div>
      {showModelRow ? (
        <div className="video-settings-prefab__row">
          <VideoSettingsPrefabModelButton
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

      {shouldShowAspectControl ? (
        <div className="video-settings-prefab__row">
          <PrefabDropdown
            value={aspect}
            options={aspectOptionsForModel.map((option) => ({
              value: option.value,
              label: `${option.ratioLabel} ${option.name}`,
            }))}
            onSelect={onAspectChange}
            ariaLabel="Video aspect ratio"
            triggerClassName="video-settings-prefab__aspect-trigger"
            menuClassName="video-settings-prefab__menu video-settings-prefab__menu--aspect"
            optionClassName="video-settings-prefab__menu-option video-settings-prefab__menu-option--aspect"
            renderOption={(option) => {
              const aspectOption =
                aspectOptionsForModel.find((aspectItem) => aspectItem.value === option.value) ??
                selectedAspect;
              const ratioClass = aspectOption?.value ? toRatioClassName(aspectOption.value) : null;
              return (
                <>
                  <span
                    className={[
                      "video-settings-prefab__aspect-shape",
                      `video-settings-prefab__aspect-shape--${aspectOption?.orientation ?? "horizontal"}`,
                      ratioClass ?? "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-hidden="true"
                  />
                  <span className="video-settings-prefab__menu-option-text">
                    <span className="video-settings-prefab__menu-option-ratio">
                      {aspectOption?.ratioLabel ?? option.value}
                    </span>
                    <span className="video-settings-prefab__menu-option-name">
                      {aspectOption?.name ?? option.label}
                    </span>
                  </span>
                </>
              );
            }}
            renderTriggerValue={() => (
              <>
                <span
                  className={[
                    "video-settings-prefab__aspect-shape",
                    `video-settings-prefab__aspect-shape--${selectedAspect?.orientation ?? "horizontal"}`,
                    selectedAspectRatioClass ?? "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-hidden="true"
                />
                <span className="video-settings-prefab__aspect-meta">
                  <span className="video-settings-prefab__aspect-ratio">
                    {selectedAspect?.ratioLabel ?? aspect}
                  </span>
                  <span className="video-settings-prefab__aspect-name">
                    {selectedAspect?.name ?? ""}
                  </span>
                </span>
              </>
            )}
          />
        </div>
      ) : null}

      {isMotionMode && shouldShowResolutionControl ? (
        <div className="video-settings-prefab__row">
          <PrefabDropdown
            value={videoResolutionValue}
            options={resolutionDropdownOptions}
            onSelect={onVideoResolutionChange}
            ariaLabel="Motion output mode"
            triggerClassName="video-settings-prefab__select-trigger"
            menuClassName="video-settings-prefab__menu"
            optionClassName="video-settings-prefab__menu-option"
            renderTriggerValue={(selected) => (
              <span className="video-settings-prefab__select-value">
                {selected?.label ?? videoResolutionValue}
              </span>
            )}
          />
        </div>
      ) : shouldShowResolutionControl && shouldShowDurationControl ? (
        <div className="video-settings-prefab__dual-row">
          <div className="video-settings-prefab__dual-slot">
            <PrefabDropdown
              value={videoResolutionValue}
              options={resolutionDropdownOptions}
              onSelect={onVideoResolutionChange}
              ariaLabel="Video resolution"
              triggerClassName="video-settings-prefab__select-trigger"
              menuClassName="video-settings-prefab__menu"
              optionClassName="video-settings-prefab__menu-option"
              renderTriggerValue={(selected) => (
                <span className="video-settings-prefab__select-value">
                  {selected?.label ?? videoResolutionValue}
                </span>
              )}
            />
          </div>
          <div className="video-settings-prefab__dual-slot">
            <PrefabDropdown
              value={videoDurationValue}
              options={durationDropdownOptions}
              onSelect={onVideoDurationChange}
              ariaLabel="Video duration"
              triggerClassName="video-settings-prefab__select-trigger"
              menuClassName="video-settings-prefab__menu"
              optionClassName="video-settings-prefab__menu-option"
              renderTriggerValue={(selected) => (
                <span className="video-settings-prefab__select-value">
                  {selected?.label ?? `${videoDurationValue}s`}
                </span>
              )}
            />
          </div>
        </div>
      ) : (
        <div className="video-settings-prefab__row">
          <PrefabDropdown
            value={videoDurationValue}
            options={durationDropdownOptions}
            onSelect={onVideoDurationChange}
            ariaLabel="Video duration"
            triggerClassName="video-settings-prefab__select-trigger"
            menuClassName="video-settings-prefab__menu"
            optionClassName="video-settings-prefab__menu-option"
            renderTriggerValue={(selected) => (
              <span className="video-settings-prefab__select-value">
                {selected?.label ?? `${videoDurationValue}s`}
              </span>
            )}
          />
        </div>
      )}

      <div className="video-settings-prefab__toggle-row">
        <span className="video-settings-prefab__toggle-label">Generate audio</span>
        <VideoSettingsPrefabToggle
          active={videoGenerateAudioValue}
          ariaLabel={
            videoGenerateAudioValue ? "Disable audio generation" : "Enable audio generation"
          }
          onClick={() => onVideoGenerateAudioChange?.(!videoGenerateAudioValue)}
        />
      </div>

      {showMultiShotToggle ? (
        <div className="video-settings-prefab__toggle-row">
          <span className="video-settings-prefab__toggle-label">Multi-shot</span>
          <VideoSettingsPrefabToggle
            active={multiShotEnabled}
            ariaLabel={multiShotEnabled ? "Disable multi-shot" : "Enable multi-shot"}
            onClick={() => onToggleMultiShot?.()}
          />
        </div>
      ) : null}

      {!isMotionMode && isSeedanceModel && shouldShowSeedanceCameraFixed ? (
        <div className="video-settings-prefab__toggle-row">
          <div className="video-settings-prefab__toggle-copy">
            <span className="video-settings-prefab__toggle-label">Camera Fixed</span>
            <span className="video-settings-prefab__toggle-helper">
              Lock camera position (tripod shot)
            </span>
          </div>
          <VideoSettingsPrefabToggle
            active={videoCameraFixed}
            ariaLabel={videoCameraFixed ? "Unlock camera" : "Lock camera"}
            onClick={() => onVideoCameraFixedChange?.(!videoCameraFixed)}
          />
        </div>
      ) : null}

      {!isMotionMode && isVeoModel && !isVeo31Model ? (
        <div className="video-settings-prefab__toggle-row">
          <div className="video-settings-prefab__toggle-copy">
            <span className="video-settings-prefab__toggle-label">Auto-fix</span>
            <span className="video-settings-prefab__toggle-helper">
              Automatically correct visual issues
            </span>
          </div>
          <VideoSettingsPrefabToggle
            active={videoAutoFix}
            ariaLabel={videoAutoFix ? "Disable auto-fix" : "Enable auto-fix"}
            onClick={() => onVideoAutoFixChange?.(!videoAutoFix)}
          />
        </div>
      ) : null}
    </div>
  );
}
