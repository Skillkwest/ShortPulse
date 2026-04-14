/**
 * Voices properties panel for AI Studio.
 * Keeps the Voices workflow visually aligned with the TTS layout while remaining fully isolated.
 */
import React from "react";
import { Microphone } from "phosphor-react";
import { useReferenceGridHorizontalSplit } from "../hooks/useReferenceGridHorizontalSplit";
import { useSharedVoicesGrid } from "../hooks/useSharedVoicesGrid";
import {
  releaseVoiceChangerSource,
  VoiceChangerSourceDropzone,
  type VoiceChangerSource,
} from "./VoiceChangerSourceDropzone";

type VoicesSurfaceMode = "create" | "edit";
type VoicesSliderTheme = "voiceover" | "voice-changer";

type VoicesSliderProps = {
  label: string;
  helper: string;
  value: number;
  displayValue: string;
  onChange: (nextValue: number) => void;
  theme: VoicesSliderTheme;
  isModeTransitioning: boolean;
};

type VoicesSliderDefinition = {
  id: string;
  label: string;
  helper: string;
  defaultValue: number;
  formatValue: (value: number) => string;
};

type VoiceoverSliderValues = {
  speed?: number;
  stability?: number;
  similarityBoost?: number;
};

type ElevenVoiceoverRequestConfig = {
  model_id: "eleven_v3";
  language_code: null;
  voice_settings: {
    stability: number;
    similarity_boost: number;
    speed: number;
    style: 0;
  };
};

const voiceDescriptionPlaceholder =
  "Describe the voice you want to create: tone, age, and delivery.";
const voiceScriptPlaceholder = "Paste or write the script that will be spoken with this voice.";

const maxVoicePromptCharacters = 1000;
const maxVoiceScriptCharacters = 5000;
const voiceGenerateCost = 15;
const splitModeTransitionDurationMs = 240;
const minTopVoicesPaneHeightPx = 0;
const minBottomComposePaneHeightPx = 480;
const maxVoicePromptHeightPx = 264;
const minVisibleVoicesPaneHeightPx = 76;
const minBottomVoiceChangerPaneHeightPx = 560;
const droppedImageUrlPattern = /^https?:\/\/\S+\.(?:png|jpe?g|gif|webp|svg)(?:\?.*)?$/i;
const droppedVideoUrlPattern = /^https?:\/\/\S+\.(?:mp4|mov|webm|m4v)(?:\?.*)?$/i;
export const hardcodedVoiceoverModelId = "eleven_v3";
export const hardcodedVoiceoverLanguageCode = null;
export const hardcodedVoiceoverStyleValue = 0 as const;

const normalizeSliderValue = (value: number | undefined, fallback: number): number =>
  Number(((value ?? fallback) / 100).toFixed(2));

export const buildVoiceoverElevenV3RequestConfig = (
  sliderValues: VoiceoverSliderValues
): ElevenVoiceoverRequestConfig => ({
  model_id: hardcodedVoiceoverModelId,
  language_code: hardcodedVoiceoverLanguageCode,
  voice_settings: {
    stability: normalizeSliderValue(sliderValues.stability, 50),
    similarity_boost: normalizeSliderValue(sliderValues.similarityBoost, 75),
    speed: Number((0.5 + (sliderValues.speed ?? 50) / 100).toFixed(2)),
    style: hardcodedVoiceoverStyleValue,
  },
});

const voiceoverShapingSliders = [
  {
    id: "speed",
    label: "Speed",
    helper: "Controls the playback speed for voice output.",
    defaultValue: 50,
    formatValue: (value: number) => `${(0.5 + value / 100).toFixed(2)}x`,
  },
  {
    id: "stability",
    label: "Stability",
    helper: "Lower values add more variation. Higher values keep the read steadier.",
    defaultValue: 50,
    formatValue: (value: number) => (value / 100).toFixed(2),
  },
  {
    id: "similarityBoost",
    label: "Similarity boost",
    helper: "Controls how closely the output stays matched to the selected voice.",
    defaultValue: 75,
    formatValue: (value: number) => (value / 100).toFixed(2),
  },
] satisfies readonly VoicesSliderDefinition[];

const voiceoverFormatOptions = [
  { value: "mp3_44100_128", label: "MP3" },
  { value: "wav_44100", label: "WAV" },
  { value: "pcm_24000", label: "PCM" },
] as const;

const voiceChangerShapingSliders = [
  {
    id: "speed",
    label: "Speed",
    helper: "Adjusts the pacing of the converted performance.",
    defaultValue: 64,
    formatValue: (value: number) => `${(value * 0.015).toFixed(2)}x`,
  },
  {
    id: "stability",
    label: "Stability",
    helper: "Higher values keep the conversion more even across takes.",
    defaultValue: 62,
    formatValue: (value: number) => (value / 100).toFixed(2),
  },
  {
    id: "similarityBoost",
    label: "Similarity boost",
    helper: "Pushes the result closer to the selected output voice.",
    defaultValue: 82,
    formatValue: (value: number) => (value / 100).toFixed(2),
  },
] satisfies readonly VoicesSliderDefinition[];

const voiceChangerOutputFormatOptions = [
  { value: "mp3_44100_128", label: "MP3" },
  { value: "wav_44100", label: "WAV" },
  { value: "pcm_24000", label: "PCM" },
] as const;

const hardcodedVoiceChangerModel = "eleven_multilingual_sts_v2";
const hardcodedVoiceChangerSpeakerBoostEnabled = true;
const hardcodedVoiceChangerInputFormat = "other";
const sliderThemeTokens: Record<
  VoicesSliderTheme,
  {
    accentStart: string;
    accentEnd: string;
    accentGlow: string;
  }
> = {
  voiceover: {
    accentStart: "rgba(149, 235, 228, 0.98)",
    accentEnd: "rgba(105, 220, 203, 0.9)",
    accentGlow: "rgba(101, 216, 217, 0.22)",
  },
  "voice-changer": {
    accentStart: "rgba(255, 196, 142, 0.98)",
    accentEnd: "rgba(255, 170, 116, 0.95)",
    accentGlow: "rgba(255, 178, 126, 0.22)",
  },
};

const extractDroppedPromptText = (transfer: DataTransfer): string | null => {
  const promptText = (
    transfer.getData("text/prompt") ||
    transfer.getData("text/plain") ||
    transfer.getData("text")
  ).trim();
  if (!promptText) return null;
  if (/^data:(image|video)\//i.test(promptText)) return null;
  if (droppedImageUrlPattern.test(promptText) || droppedVideoUrlPattern.test(promptText)) {
    return null;
  }
  return promptText.slice(0, maxVoiceScriptCharacters);
};

const isPromptTextDrag = (transfer: DataTransfer): boolean => {
  const normalizedTypes = Array.from(transfer.types ?? [], (type) => type.toLowerCase());
  if (
    normalizedTypes.some(
      (type) =>
        type.includes("text") ||
        type.includes("plain") ||
        type.includes("prompt") ||
        type.includes("utf8")
    )
  ) {
    return true;
  }
  return Boolean(extractDroppedPromptText(transfer));
};

const buildSliderState = (sliders: readonly VoicesSliderDefinition[]): Record<string, number> =>
  Object.fromEntries(sliders.map((slider) => [slider.id, slider.defaultValue]));

function VoicesSlider({
  label,
  helper,
  value,
  displayValue,
  onChange,
  theme,
  isModeTransitioning,
}: VoicesSliderProps) {
  const themeTokens = sliderThemeTokens[theme];
  const handleValueInput = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement> | React.FormEvent<HTMLInputElement>) => {
      onChange(Number((event.target as HTMLInputElement).value));
    },
    [onChange]
  );
  return (
    <label className="voices-properties-mode-slider">
      <span className="voices-properties-mode-slider-label-row">
        <span className="voices-properties-mode-slider-label">{label}</span>
        <output className="voices-properties-mode-slider-value" aria-live="polite">
          {displayValue}
        </output>
      </span>
      <span
        className={`voices-properties-mode-slider-control${
          isModeTransitioning ? " is-mode-transitioning" : ""
        }`}
        style={
          {
            "--voices-slider-progress": `${value}%`,
            "--voices-slider-accent-start": themeTokens.accentStart,
            "--voices-slider-accent-end": themeTokens.accentEnd,
            "--voices-slider-accent-glow": themeTokens.accentGlow,
          } as React.CSSProperties
        }
      >
        <span className="voices-properties-mode-slider-visual" aria-hidden="true">
          <span className="voices-properties-mode-slider-band" />
          <span className="voices-properties-mode-slider-knob" />
        </span>
        <input
          className="voices-properties-mode-slider-input"
          type="range"
          min={0}
          max={100}
          step={1}
          value={value}
          aria-label={label}
          onChange={handleValueInput}
          onInput={handleValueInput}
        />
      </span>
      <span className="voices-properties-mode-slider-helper">{helper}</span>
    </label>
  );
}

/**
 * Renders the dedicated Voices workflow panel.
 */
export const VoicesPropertiesPanel = React.memo(function VoicesPropertiesPanel() {
  const {
    voices: libraryVoices,
    selectedVoice: selectedLibraryVoice,
    setSelectedVoice: setSelectedLibraryVoice,
    saveVoice: saveSharedVoice,
  } = useSharedVoicesGrid();
  const [surfaceMode, setSurfaceMode] = React.useState<VoicesSurfaceMode>("create");
  const [isCreatePanelOpen, setIsCreatePanelOpen] = React.useState(false);
  const [voiceName, setVoiceName] = React.useState("Harbor Blueprint");
  const [voicePrompt, setVoicePrompt] = React.useState("");
  const [voiceScript, setVoiceScript] = React.useState("");
  const [voiceoverSliderValues, setVoiceoverSliderValues] = React.useState<Record<string, number>>(
    () => buildSliderState(voiceoverShapingSliders)
  );
  const [voiceChangerSliderValues, setVoiceChangerSliderValues] = React.useState<
    Record<string, number>
  >(() => buildSliderState(voiceChangerShapingSliders));
  const [selectedVoiceoverFormat, setSelectedVoiceoverFormat] = React.useState("mp3_44100_128");
  const [selectedVoiceChangerOutputFormat, setSelectedVoiceChangerOutputFormat] =
    React.useState("mp3_44100_128");
  const [voiceChangerBackgroundCleanupEnabled, setVoiceChangerBackgroundCleanupEnabled] =
    React.useState(false);
  const [voiceChangerSource, setVoiceChangerSource] = React.useState<VoiceChangerSource | null>(
    null
  );
  const [isModeSwitchAnimating, setIsModeSwitchAnimating] = React.useState(false);

  const voiceoverSplitContainerRef = React.useRef<HTMLDivElement | null>(null);
  const voiceChangerSplitContainerRef = React.useRef<HTMLDivElement | null>(null);
  const voiceNameInputRef = React.useRef<HTMLInputElement | null>(null);
  const voicePromptRef = React.useRef<HTMLTextAreaElement | null>(null);
  const voiceScriptRef = React.useRef<HTMLTextAreaElement | null>(null);
  const previousVoiceScriptRef = React.useRef(voiceScript);
  const previousSurfaceModeRef = React.useRef(surfaceMode);
  const modeSwitchTimeoutRef = React.useRef<number | null>(null);
  const shouldFocusCreateControlsRef = React.useRef(false);
  const isGenerateEnabled =
    selectedLibraryVoice.trim().length > 0 &&
    (surfaceMode === "create" ? voiceScript.trim().length > 0 : voiceChangerSource !== null);
  const isCreateVoiceEnabled = voiceName.trim().length > 0 && voicePrompt.trim().length > 0;
  const isSaveVoiceEnabled = voiceName.trim().length > 0 && voicePrompt.trim().length > 0;
  const activeSliderDefinitions =
    surfaceMode === "create" ? voiceoverShapingSliders : voiceChangerShapingSliders;
  const activeSliderValues =
    surfaceMode === "create" ? voiceoverSliderValues : voiceChangerSliderValues;
  const activeSliderTheme: VoicesSliderTheme =
    surfaceMode === "create" ? "voiceover" : "voice-changer";
  const voiceoverSplit = useReferenceGridHorizontalSplit({
    enabled: surfaceMode === "create",
    containerRef: voiceoverSplitContainerRef,
    defaultTopRatio: 0.995,
    minTopSectionHeightPx: minTopVoicesPaneHeightPx,
    minBottomSectionHeightPx: minBottomComposePaneHeightPx,
    ariaLabel: "Resize available voices and prompt sections",
  });
  const voiceChangerSplit = useReferenceGridHorizontalSplit({
    enabled: surfaceMode === "edit",
    containerRef: voiceChangerSplitContainerRef,
    defaultTopRatio: 0.995,
    minTopSectionHeightPx: minTopVoicesPaneHeightPx,
    minBottomSectionHeightPx: minBottomVoiceChangerPaneHeightPx,
    ariaLabel: "Resize available voices and voice changer sections",
  });
  const activeSplit = surfaceMode === "create" ? voiceoverSplit : voiceChangerSplit;
  const {
    topRatio,
    topSectionStyle,
    bottomSectionStyle,
    topSectionHeightPx,
    bottomSectionHeightPx,
    dividerProps,
  } = activeSplit;
  const { nudgeTopSectionHeightByPx: nudgeVoiceoverTopSectionHeightByPx } = voiceoverSplit;
  const isVoiceLibraryVisible =
    topSectionHeightPx > 0 ? topSectionHeightPx > minVisibleVoicesPaneHeightPx : topRatio > 0.2;

  React.useLayoutEffect(() => {
    const textarea = voicePromptRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "0px";
    const nextHeight = Math.min(Math.max(112, textarea.scrollHeight), maxVoicePromptHeightPx);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxVoicePromptHeightPx ? "auto" : "hidden";
  }, [voicePrompt]);

  React.useLayoutEffect(() => {
    const textarea = voiceScriptRef.current;
    if (!textarea) {
      return;
    }

    const scriptChanged =
      previousVoiceScriptRef.current !== voiceScript ||
      previousSurfaceModeRef.current !== surfaceMode;

    if (surfaceMode !== "create") {
      textarea.style.overflowY = "auto";
      previousVoiceScriptRef.current = voiceScript;
      previousSurfaceModeRef.current = surfaceMode;
      return;
    }

    const overflowPx = textarea.scrollHeight - textarea.clientHeight;
    if (overflowPx <= 1) {
      textarea.style.overflowY = "hidden";
      previousVoiceScriptRef.current = voiceScript;
      previousSurfaceModeRef.current = surfaceMode;
      return;
    }

    if (scriptChanged && topSectionHeightPx > minTopVoicesPaneHeightPx + 1) {
      const residualOverflowPx = nudgeVoiceoverTopSectionHeightByPx(-overflowPx);
      textarea.style.overflowY = Math.abs(residualOverflowPx) > 1 ? "auto" : "hidden";
      previousVoiceScriptRef.current = voiceScript;
      previousSurfaceModeRef.current = surfaceMode;
      return;
    }

    textarea.style.overflowY = "auto";
    previousVoiceScriptRef.current = voiceScript;
    previousSurfaceModeRef.current = surfaceMode;
  }, [
    bottomSectionHeightPx,
    nudgeVoiceoverTopSectionHeightByPx,
    surfaceMode,
    topSectionHeightPx,
    voiceScript,
  ]);

  React.useEffect(() => {
    if (surfaceMode !== "create" || !isCreatePanelOpen || !shouldFocusCreateControlsRef.current) {
      return;
    }

    voiceNameInputRef.current?.focus();
    shouldFocusCreateControlsRef.current = false;
  }, [isCreatePanelOpen, surfaceMode]);

  React.useEffect(() => {
    return () => {
      releaseVoiceChangerSource(voiceChangerSource);
    };
  }, [voiceChangerSource]);

  React.useEffect(() => {
    return () => {
      if (modeSwitchTimeoutRef.current !== null) {
        window.clearTimeout(modeSwitchTimeoutRef.current);
      }
    };
  }, []);

  const handleSurfaceModeChange = React.useCallback(
    (nextMode: VoicesSurfaceMode) => {
      if (surfaceMode !== nextMode) {
        if (modeSwitchTimeoutRef.current !== null) {
          window.clearTimeout(modeSwitchTimeoutRef.current);
        }
        setIsModeSwitchAnimating(true);
        modeSwitchTimeoutRef.current = window.setTimeout(() => {
          setIsModeSwitchAnimating(false);
          modeSwitchTimeoutRef.current = null;
        }, splitModeTransitionDurationMs);
      }

      setSurfaceMode(nextMode);
    },
    [surfaceMode]
  );

  const handleShapingSliderChange = React.useCallback(
    (sliderId: string, nextValue: number) => {
      if (surfaceMode === "create") {
        setVoiceoverSliderValues((currentValues) => ({
          ...currentValues,
          [sliderId]: nextValue,
        }));
        return;
      }

      setVoiceChangerSliderValues((currentValues) => ({
        ...currentValues,
        [sliderId]: nextValue,
      }));
    },
    [surfaceMode]
  );

  const handleSaveVoice = () => {
    const nextVoiceName = voiceName.trim();
    if (!nextVoiceName || voicePrompt.trim().length === 0) {
      return;
    }

    saveSharedVoice(nextVoiceName);
  };

  const handleVoicePromptDrop = (event: React.DragEvent<HTMLTextAreaElement>) => {
    const droppedPromptText = extractDroppedPromptText(event.dataTransfer);
    if (!droppedPromptText) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setVoicePrompt(droppedPromptText);
  };

  const handleVoiceScriptDrop = (event: React.DragEvent<HTMLTextAreaElement>) => {
    const droppedPromptText = extractDroppedPromptText(event.dataTransfer);
    if (!droppedPromptText) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setVoiceScript(droppedPromptText);
  };

  const handleVoicePromptDragOver = (event: React.DragEvent<HTMLTextAreaElement>) => {
    if (!isPromptTextDrag(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const handleCreateVoiceEntry = () => {
    shouldFocusCreateControlsRef.current = true;
    handleSurfaceModeChange("create");
    setIsCreatePanelOpen(true);
  };

  const handleCloseCreatePanel = () => {
    handleSaveVoice();
    setIsCreatePanelOpen(false);
  };

  return (
    <section className="voices-properties-panel tool-properties" aria-label="Voices properties">
      <div className="voices-properties-shell">
        <div className="voices-properties-column-shell">
          <div
            className={`voices-properties-main${isModeSwitchAnimating ? " is-mode-transitioning" : ""}`}
            ref={
              surfaceMode === "create" ? voiceoverSplitContainerRef : voiceChangerSplitContainerRef
            }
          >
            <section
              className="voices-properties-voice-library"
              aria-label="Available voices"
              style={topSectionStyle}
            >
              {isVoiceLibraryVisible ? (
                isCreatePanelOpen && surfaceMode === "create" ? (
                  <section className="voices-properties-create-panel" aria-label="Create new voice">
                    <div className="voices-properties-create-panel-header">
                      <button
                        type="button"
                        className="voices-properties-create-panel-close"
                        aria-label="Close and save voice"
                        onClick={handleCloseCreatePanel}
                      >
                        <span aria-hidden="true">×</span>
                      </button>
                    </div>

                    <div className="voices-properties-create-panel-body">
                      <label className="voices-properties-field">
                        <span className="voices-properties-field-label">Voice name</span>
                        <input
                          ref={voiceNameInputRef}
                          className="voices-properties-input"
                          value={voiceName}
                          onChange={(event) => setVoiceName(event.target.value)}
                          placeholder="Name your designed voice"
                        />
                      </label>

                      <label className="voices-properties-field">
                        <span className="voices-properties-field-label">Prompt</span>
                        <textarea
                          ref={voicePromptRef}
                          className="voices-properties-rail-textarea"
                          value={voicePrompt}
                          onChange={(event) => setVoicePrompt(event.target.value)}
                          onDrop={handleVoicePromptDrop}
                          onDragOver={handleVoicePromptDragOver}
                          maxLength={maxVoicePromptCharacters}
                          placeholder={voiceDescriptionPlaceholder}
                          aria-label="Voice generation prompt"
                        />
                        <span className="voices-properties-field-count" aria-live="polite">
                          {voicePrompt.length.toLocaleString()} /{" "}
                          {maxVoicePromptCharacters.toLocaleString()}
                        </span>
                      </label>

                      <button
                        type="button"
                        className="voices-properties-create-voice-btn"
                        disabled={!isCreateVoiceEnabled}
                        aria-label="Create Voice from prompt"
                      >
                        Create Voice
                      </button>

                      <section
                        className="voices-properties-generated-preview"
                        aria-label="Generated voice preview"
                      >
                        <button
                          type="button"
                          className="voices-properties-generated-preview-play"
                          aria-label="Play generated voice preview"
                        >
                          <span
                            className="voices-properties-generated-preview-play-icon"
                            aria-hidden="true"
                          >
                            ▶
                          </span>
                        </button>
                        <div
                          className="voices-properties-generated-preview-waveform"
                          aria-hidden="true"
                        >
                          {[
                            12, 18, 28, 21, 34, 25, 16, 30, 42, 26, 19, 33, 24, 38, 17, 29, 22, 14,
                          ].map((height, index) => (
                            <span
                              key={`voices-generated-preview-bar-${index}`}
                              className="voices-properties-generated-preview-bar"
                              style={
                                {
                                  "--voices-preview-bar-height": `${height}px`,
                                } as React.CSSProperties
                              }
                            />
                          ))}
                        </div>
                      </section>

                      <button
                        type="button"
                        className="voices-properties-save-btn"
                        onClick={handleSaveVoice}
                        disabled={!isSaveVoiceEnabled}
                      >
                        Save voice
                      </button>
                    </div>
                  </section>
                ) : (
                  <>
                    <div className="voices-properties-voice-library-header">
                      <h2 className="panel-title voices-properties-library-title">Voices</h2>
                      <button
                        type="button"
                        className="voices-properties-library-create-btn"
                        onClick={handleCreateVoiceEntry}
                        aria-label="+ Create New Voice"
                      >
                        <span
                          className="voices-properties-library-create-btn-icon"
                          aria-hidden="true"
                        >
                          +
                        </span>
                        <span>Create New Voice</span>
                      </button>
                    </div>
                    <ul className="voices-properties-voice-grid" aria-label="Available voices list">
                      {libraryVoices.map((voice) => {
                        const isSelected = voice === selectedLibraryVoice;
                        return (
                          <li key={voice} className="voices-properties-voice-item">
                            <div
                              className={`voices-properties-voice-chip ${isSelected ? "is-selected" : ""}`}
                            >
                              <button
                                type="button"
                                className="voices-properties-voice-chip-select"
                                aria-pressed={isSelected}
                                aria-label={`${voice} voice`}
                                onClick={() => setSelectedLibraryVoice(voice)}
                              >
                                <span
                                  className="voices-properties-voice-chip-avatar"
                                  aria-hidden="true"
                                >
                                  <Microphone size={14} weight="bold" />
                                </span>
                                <span className="voices-properties-voice-chip-copy">
                                  <span className="voices-properties-voice-chip-label">Voice</span>
                                  <span className="voices-properties-voice-chip-name">{voice}</span>
                                </span>
                              </button>

                              <button
                                type="button"
                                className="voices-properties-voice-chip-play"
                                aria-label={`Play ${voice} sample`}
                              >
                                <span
                                  className="voices-properties-voice-chip-play-icon"
                                  aria-hidden="true"
                                >
                                  ▶
                                </span>
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )
              ) : null}
            </section>

            <div className="voices-properties-horizontal-divider-wrap" {...dividerProps}>
              <div className="voices-properties-horizontal-divider" aria-hidden="true" />
            </div>

            <div className="voices-properties-compose-area" style={bottomSectionStyle}>
              {surfaceMode === "create" ? (
                <div className="voices-properties-script-input-shell">
                  <textarea
                    ref={voiceScriptRef}
                    className="voices-properties-script-input"
                    value={voiceScript}
                    onChange={(event) => setVoiceScript(event.target.value)}
                    onDrop={handleVoiceScriptDrop}
                    onDragOver={handleVoicePromptDragOver}
                    maxLength={maxVoiceScriptCharacters}
                    placeholder={voiceScriptPlaceholder}
                    aria-label="Voice script"
                  />
                </div>
              ) : (
                <VoiceChangerSourceDropzone
                  source={voiceChangerSource}
                  onSourceChange={setVoiceChangerSource}
                />
              )}

              <div className="voices-properties-script-divider" aria-hidden="true" />

              <div className="voices-properties-script-actions">
                {surfaceMode === "create" ? (
                  <p className="voices-properties-script-count" aria-live="polite">
                    {`${voiceScript.length.toLocaleString()} / ${maxVoiceScriptCharacters.toLocaleString()}`}
                  </p>
                ) : (
                  <span aria-hidden="true" />
                )}
                <button
                  type="button"
                  className="voices-properties-generate-btn"
                  disabled={!isGenerateEnabled}
                  aria-label="Generate"
                >
                  <span className="voices-properties-generate-label">Generate</span>
                  <span className="voices-properties-generate-pill" aria-hidden="true">
                    <span className="voices-properties-generate-cost-icon">✦</span>
                    <span className="voices-properties-generate-cost-value">
                      {voiceGenerateCost}
                      <span className="voices-properties-generate-cost-label">credits</span>
                    </span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="voices-properties-column-shell voices-properties-column-shell--aside">
          <aside className="voices-properties-aside">
            <section className="voices-properties-rail-section">
              <div className="voices-properties-mode-switcher">
                <span className="voices-properties-field-label">Voice mode</span>
                <div className="voices-properties-mode-tabs" role="tablist" aria-label="Voice mode">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={surfaceMode === "create"}
                    data-voice-mode="voiceover"
                    className={`voices-properties-mode-tab ${
                      surfaceMode === "create" ? "is-active" : ""
                    }`}
                    onClick={() => handleSurfaceModeChange("create")}
                  >
                    Voiceover
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={surfaceMode === "edit"}
                    data-voice-mode="voice-changer"
                    className={`voices-properties-mode-tab ${
                      surfaceMode === "edit" ? "is-active" : ""
                    }`}
                    onClick={() => {
                      handleSurfaceModeChange("edit");
                      setIsCreatePanelOpen(false);
                    }}
                  >
                    Voice Changer
                  </button>
                </div>
              </div>

              <section
                className={`voices-properties-shaping-card ${
                  activeSliderTheme === "voiceover" ? "is-voiceover" : "is-voice-changer"
                }`}
                aria-label={surfaceMode === "create" ? "Voice shaping" : "Voice changer shaping"}
              >
                <div className="voices-properties-shaping-card-heading-row">
                  <p className="voices-properties-shaping-card-kicker">Voice shaping</p>
                </div>

                <div className="voices-properties-mode-slider-stack">
                  {activeSliderDefinitions.map((slider, index) => (
                    <VoicesSlider
                      key={`voices-shaping-slider-${index}`}
                      label={slider.label}
                      helper={slider.helper}
                      value={activeSliderValues[slider.id] ?? slider.defaultValue}
                      displayValue={slider.formatValue(
                        activeSliderValues[slider.id] ?? slider.defaultValue
                      )}
                      onChange={(nextValue) => handleShapingSliderChange(slider.id, nextValue)}
                      theme={activeSliderTheme}
                      isModeTransitioning={isModeSwitchAnimating}
                    />
                  ))}
                </div>
              </section>

              {surfaceMode === "create" ? (
                <>
                  <section
                    className="voices-properties-voiceover-card"
                    aria-label="Voiceover settings"
                  >
                    {/* Eleven v3 voiceover request defaults: model_id is fixed, language_code stays null, style stays at 0, and Speaker Boost is omitted because v3 does not support it. */}
                    <div className="voices-properties-delivery-stack">
                      <label className="voices-properties-output-field">
                        <span className="voices-properties-selector-label">Format</span>
                        <span className="voices-properties-output-select-shell">
                          <select
                            className="voices-properties-output-select"
                            value={selectedVoiceoverFormat}
                            onChange={(event) => setSelectedVoiceoverFormat(event.target.value)}
                            aria-label="Voiceover output format"
                          >
                            {voiceoverFormatOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </span>
                      </label>
                    </div>
                  </section>
                </>
              ) : (
                <>
                  <section
                    className="voices-properties-voice-changer-card"
                    aria-label="Voice changer settings"
                  >
                    <div className="voices-properties-voice-changer-card-heading-row">
                      <p className="voices-properties-voice-changer-card-kicker">
                        Conversion settings
                      </p>
                    </div>

                    <div className="voices-properties-voice-changer-setting-stack">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={voiceChangerBackgroundCleanupEnabled}
                        className={`voices-properties-voice-changer-switch-row ${
                          voiceChangerBackgroundCleanupEnabled ? "is-active" : ""
                        }`}
                        onClick={() =>
                          setVoiceChangerBackgroundCleanupEnabled((currentValue) => !currentValue)
                        }
                      >
                        <span className="voices-properties-voice-changer-switch-copy">
                          <span className="voices-properties-voice-changer-switch-label">
                            Noise reduction
                          </span>
                        </span>
                        <span
                          className="voices-properties-voice-changer-switch-control"
                          aria-hidden="true"
                        >
                          <span className="voices-properties-voice-changer-switch-thumb" />
                        </span>
                      </button>

                      <input
                        type="hidden"
                        name="voiceChangerModel"
                        value={hardcodedVoiceChangerModel}
                        aria-hidden="true"
                      />
                      <input
                        type="hidden"
                        name="voiceChangerSpeakerBoostEnabled"
                        value={hardcodedVoiceChangerSpeakerBoostEnabled ? "true" : "false"}
                        aria-hidden="true"
                      />
                      <input
                        type="hidden"
                        name="voiceChangerInputFormat"
                        value={hardcodedVoiceChangerInputFormat}
                        aria-hidden="true"
                      />

                      <label className="voices-properties-voice-changer-field">
                        <span className="voices-properties-voice-changer-field-label">
                          Output format
                        </span>
                        <span className="voices-properties-voice-changer-select-shell">
                          <select
                            className="voices-properties-voice-changer-select"
                            value={selectedVoiceChangerOutputFormat}
                            onChange={(event) =>
                              setSelectedVoiceChangerOutputFormat(event.target.value)
                            }
                            aria-label="Voice changer output format"
                          >
                            {voiceChangerOutputFormatOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </span>
                      </label>
                    </div>
                  </section>
                </>
              )}
            </section>
          </aside>
        </div>
      </div>
    </section>
  );
});
