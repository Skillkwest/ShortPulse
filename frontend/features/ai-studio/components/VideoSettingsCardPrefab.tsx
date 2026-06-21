/**
 * Isolated video settings card prefab for the video properties panel.
 * Owns the card chrome and control styling so the video panel can evolve independently.
 */
import React from "react";
import Image from "next/image";
import { stripEditLabel } from "../utils/modelLabels";
import type { AspectOption } from "../types";
import type { ModelModalContext } from "./ModelModal";
import styles from "../../../styles/ai-studio-video-settings-prefab.module.css";

export type VideoSettingsResolutionOption = {
  value: string;
  label: string;
};

type VideoSettingsDropdownOption<T extends string | number> = {
  value: T;
  label: string;
};

export type VideoSettingsCardPrefabProps = {
  title?: string;
  showModelRow?: boolean;
  showAspectControl?: boolean;
  showDurationControl?: boolean;
  showGenerateAudioControl?: boolean;
  resolutionAriaLabel?: string;
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
  isMotionMode: boolean;
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
  onVideoAutoFixChange?: (value: boolean) => void;
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
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const optionRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const pendingFocusIndexRef = React.useRef<number | null>(null);
  const selectedOption = React.useMemo(
    () => options.find((option) => option.value === value) ?? options[0],
    [options, value]
  );
  const selectedOptionIndex = React.useMemo(() => {
    const index = options.findIndex((option) => option.value === value);
    return index >= 0 ? index : 0;
  }, [options, value]);
  const focusOptionAtIndex = React.useCallback(
    (index: number) => {
      const boundedIndex = Math.min(Math.max(index, 0), Math.max(options.length - 1, 0));
      optionRefs.current[boundedIndex]?.focus({ preventScroll: true });
    },
    [options.length]
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

  React.useEffect(() => {
    if (!isOpen || pendingFocusIndexRef.current === null) return;
    const nextFocusIndex = pendingFocusIndexRef.current;
    pendingFocusIndexRef.current = null;
    focusOptionAtIndex(nextFocusIndex);
  }, [focusOptionAtIndex, isOpen]);

  const closeAndFocusTrigger = React.useCallback(() => {
    setIsOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  }, []);

  const handleTriggerKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      pendingFocusIndexRef.current = selectedOptionIndex;
      setIsOpen(true);
    },
    [selectedOptionIndex]
  );

  const handleOptionKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeAndFocusTrigger();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        focusOptionAtIndex(index + 1 >= options.length ? 0 : index + 1);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        focusOptionAtIndex(index - 1 < 0 ? options.length - 1 : index - 1);
        return;
      }
      if (event.key === "Home") {
        event.preventDefault();
        focusOptionAtIndex(0);
        return;
      }
      if (event.key === "End") {
        event.preventDefault();
        focusOptionAtIndex(options.length - 1);
      }
    },
    [closeAndFocusTrigger, focusOptionAtIndex, options.length]
  );

  return (
    <div className="video-settings-prefab__dropdown" ref={dropdownRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`${triggerClassName}${isOpen ? " is-open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        disabled={!onSelect || options.length === 0}
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={handleTriggerKeyDown}
      >
        {renderTriggerValue(selectedOption)}
      </button>
      {isOpen ? (
        <div className={menuClassName} role="listbox" aria-label={ariaLabel}>
          {options.map((option, index) => {
            const isActive = option.value === value;
            return (
              <button
                type="button"
                key={String(option.value)}
                className={`${optionClassName}${isActive ? " is-active" : ""}`}
                role="option"
                aria-selected={isActive}
                ref={(node) => {
                  optionRefs.current[index] = node;
                }}
                onKeyDown={(event) => handleOptionKeyDown(event, index)}
                onClick={() => {
                  onSelect?.(option.value);
                  closeAndFocusTrigger();
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
  title,
  showModelRow = true,
  showAspectControl = true,
  showDurationControl = true,
  showGenerateAudioControl = true,
  resolutionAriaLabel,
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
  isMotionMode,
  isVeoModel,
  videoAutoFix,
  onAspectChange,
  onModelPickerOpen,
  onVideoDurationChange,
  onVideoResolutionChange,
  onVideoGenerateAudioChange,
  onVideoAutoFixChange,
}: VideoSettingsCardPrefabProps) {
  const shouldShowResolutionControl = resolutionOptions.length > 0;
  const shouldShowAspectControl = showAspectControl && !isMotionMode;
  const shouldShowDurationControl = showDurationControl && !isMotionMode;
  const effectiveResolutionAriaLabel =
    resolutionAriaLabel ?? (isMotionMode ? "Motion output mode" : "Video resolution");
  const isVeo31Model =
    modelId?.includes("veo3.1") === true || modelId?.includes("veo-3.1") === true;
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
    <div className={`video-settings-prefab ${styles.bootstrapStyleScope}`}>
      <div className="video-settings-prefab__title">
        {title ?? (isMotionMode ? "Motion Settings" : "Video Settings")}
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

      {shouldShowResolutionControl && !shouldShowDurationControl ? (
        <div className="video-settings-prefab__row">
          <PrefabDropdown
            value={videoResolutionValue}
            options={resolutionDropdownOptions}
            onSelect={onVideoResolutionChange}
            ariaLabel={effectiveResolutionAriaLabel}
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
      ) : shouldShowDurationControl ? (
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
      ) : null}

      {showGenerateAudioControl ? (
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
