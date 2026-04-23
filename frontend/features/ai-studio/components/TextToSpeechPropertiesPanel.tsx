/**
 * Text to Speech properties panel for AI Studio.
 * Presents a provider-aware TTS composition surface with a ShortPulse color palette.
 */
import React from "react";
import { CaretDown, Microphone } from "phosphor-react";
import { useReferenceGridHorizontalSplit } from "../hooks/useReferenceGridHorizontalSplit";
import { useSharedVoicesGrid } from "../hooks/useSharedVoicesGrid";
import { VOICE_LIBRARY_OPTIONS } from "../voiceLibrary";

type TtsSliderProps = {
  label: string;
  helper: string;
  value: number;
  displayValue: string;
};

type TtsOutputFormatOption = {
  value: string;
  label: string;
};

type TtsLanguageOption = {
  value: string;
  label: string;
};

const voiceSliders = [
  {
    label: "Speed",
    helper: "Values below 1.0 slow the read; values above 1.0 speed it up.",
    value: 66,
    displayValue: "1.00x",
  },
  {
    label: "Stability",
    helper: "Lower values add variation. Higher values keep delivery steady.",
    value: 54,
    displayValue: "0.54",
  },
  {
    label: "Similarity boost",
    helper: "Keeps the read closer to the selected voice.",
    value: 78,
    displayValue: "0.78",
  },
  {
    label: "Style",
    helper: "Raise only when the performance needs more character.",
    value: 28,
    displayValue: "0.28",
  },
] as const;

const outputFormatOptions: TtsOutputFormatOption[] = [
  { value: "mp3_22050_32", label: "MP3 · 22.05 kHz · 32 kbps" },
  { value: "mp3_24000_48", label: "MP3 · 24 kHz · 48 kbps" },
  { value: "mp3_44100_32", label: "MP3 · 44.1 kHz · 32 kbps" },
  { value: "mp3_44100_64", label: "MP3 · 44.1 kHz · 64 kbps" },
  { value: "mp3_44100_96", label: "MP3 · 44.1 kHz · 96 kbps" },
  { value: "mp3_44100_128", label: "MP3 · 44.1 kHz · 128 kbps (Default)" },
  { value: "mp3_44100_192", label: "MP3 · 44.1 kHz · 192 kbps (Creator+)" },
  { value: "pcm_8000", label: "PCM · 8 kHz" },
  { value: "pcm_16000", label: "PCM · 16 kHz" },
  { value: "pcm_22050", label: "PCM · 22.05 kHz" },
  { value: "pcm_24000", label: "PCM · 24 kHz" },
  { value: "pcm_32000", label: "PCM · 32 kHz" },
  { value: "pcm_44100", label: "PCM · 44.1 kHz (Pro+)" },
  { value: "pcm_48000", label: "PCM · 48 kHz" },
  { value: "ulaw_8000", label: "u-law · 8 kHz" },
  { value: "wav_8000", label: "WAV · 8 kHz" },
  { value: "wav_16000", label: "WAV · 16 kHz" },
  { value: "wav_22050", label: "WAV · 22.05 kHz" },
  { value: "wav_24000", label: "WAV · 24 kHz" },
  { value: "wav_32000", label: "WAV · 32 kHz" },
  { value: "wav_44100", label: "WAV · 44.1 kHz (Pro+)" },
  { value: "wav_48000", label: "WAV · 48 kHz" },
] as const;

const languageOptions: TtsLanguageOption[] = [
  { value: "auto", label: "Auto (Recommended)" },
  { value: "ARA", label: "Arabic" },
  { value: "BUL", label: "Bulgarian" },
  { value: "CMN", label: "Chinese" },
  { value: "HRV", label: "Croatian" },
  { value: "CES", label: "Czech" },
  { value: "DAN", label: "Danish" },
  { value: "NLD", label: "Dutch" },
  { value: "ENG", label: "English" },
  { value: "FIL", label: "Filipino" },
  { value: "FIN", label: "Finnish" },
  { value: "FRA", label: "French" },
  { value: "DEU", label: "German" },
  { value: "ELL", label: "Greek" },
  { value: "HIN", label: "Hindi" },
  { value: "HUN", label: "Hungarian" },
  { value: "IND", label: "Indonesian" },
  { value: "ITA", label: "Italian" },
  { value: "JPN", label: "Japanese" },
  { value: "KOR", label: "Korean" },
  { value: "MSA", label: "Malay" },
  { value: "NOR", label: "Norwegian" },
  { value: "POL", label: "Polish" },
  { value: "POR", label: "Portuguese" },
  { value: "RON", label: "Romanian" },
  { value: "RUS", label: "Russian" },
  { value: "SLK", label: "Slovak" },
  { value: "SPA", label: "Spanish" },
  { value: "SWE", label: "Swedish" },
  { value: "TAM", label: "Tamil" },
  { value: "TUR", label: "Turkish" },
  { value: "UKR", label: "Ukrainian" },
  { value: "VIE", label: "Vietnamese" },
] as const;

const ttsGenerateCost = 15;
const minTopPromptPaneHeightPx = 0;
const minBottomPromptPaneHeightPx = 500;

const getVoiceInitials = (value: string): string =>
  value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

/**
 * Renders a lightweight TTS slider row used throughout the settings panel.
 */
function TtsSlider({ label, helper, value, displayValue }: TtsSliderProps) {
  return (
    <label className="tts-slider">
      <span className="tts-slider-label-row">
        <span className="tts-slider-label">{label}</span>
        <output className="tts-slider-value" aria-live="polite">
          {displayValue}
        </output>
      </span>
      <input type="range" min={0} max={100} step={1} value={value} aria-label={label} readOnly />
      <span className="tts-slider-helper">{helper}</span>
    </label>
  );
}

function TtsVoiceAvatar({
  imageUrl,
  className,
  iconSize,
}: {
  imageUrl?: string | null;
  className: string;
  iconSize: number;
}) {
  return (
    <span className={className} aria-hidden="true">
      {imageUrl ? (
        <img src={imageUrl} alt="" className={`${className}-image`} />
      ) : (
        <Microphone size={iconSize} weight="bold" />
      )}
    </span>
  );
}

function TtsVoiceDropdown({
  value,
  options,
  onSelect,
}: {
  value: string;
  options: readonly (typeof VOICE_LIBRARY_OPTIONS)[number][];
  onSelect: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement | null>(null);
  const selectedVoice = options.find((option) => option.value === value) ?? options[0];

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

  return (
    <div className="tts-voice-dropdown" ref={dropdownRef}>
      <button
        type="button"
        className={`tts-voice-trigger${isOpen ? " is-open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Voice"
        onClick={() => setIsOpen((open) => !open)}
      >
        <TtsVoiceAvatar
          imageUrl={selectedVoice.imageUrl}
          className="tts-voice-trigger-icon"
          iconSize={14}
        />
        <span className="tts-voice-trigger-copy">
          <strong>{selectedVoice.title}</strong>
          <span>{selectedVoice.descriptor}</span>
        </span>
        <CaretDown size={15} weight="bold" aria-hidden="true" className="tts-voice-trigger-caret" />
      </button>
      {isOpen ? (
        <div className="tts-voice-menu" role="listbox" aria-label="Voice options">
          {options.map((option) => {
            const isActive = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isActive}
                className={`tts-voice-option${isActive ? " is-active" : ""}`}
                onClick={() => {
                  onSelect(option.value);
                  setIsOpen(false);
                }}
              >
                <TtsVoiceAvatar
                  imageUrl={option.imageUrl}
                  className="tts-voice-option-avatar"
                  iconSize={13}
                />
                <span className="tts-voice-option-copy">
                  <strong>{option.title}</strong>
                  <span>{option.descriptor}</span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Renders the Text to Speech panel shell.
 */
export const TextToSpeechPropertiesPanel = React.memo(function TextToSpeechPropertiesPanel() {
  const [scriptText, setScriptText] = React.useState("");
  const [selectedVoice, setSelectedVoice] = React.useState("darian");
  const [selectedLanguage, setSelectedLanguage] = React.useState("auto");
  const [outputFormat, setOutputFormat] = React.useState("mp3_44100_128");
  const {
    voices: sharedVoices,
    selectedVoice: selectedSharedVoice,
    setSelectedVoice: setSelectedSharedVoice,
  } = useSharedVoicesGrid();
  const isGenerateActive = scriptText.trim().length > 0;
  const scriptCharacterCount = scriptText.length;
  const maxScriptCharacters = 5000;
  const splitContainerRef = React.useRef<HTMLDivElement | null>(null);
  const { topSectionStyle, bottomSectionStyle, dividerProps } = useReferenceGridHorizontalSplit({
    enabled: true,
    containerRef: splitContainerRef,
    defaultTopRatio: 0.995,
    minTopSectionHeightPx: minTopPromptPaneHeightPx,
    minBottomSectionHeightPx: minBottomPromptPaneHeightPx,
    ariaLabel: "Resize text input and prompt sections",
  });

  return (
    <section
      className="tts-properties-panel tool-properties"
      aria-label="Text to speech properties"
    >
      <div className="tool-header tts-properties-header">
        <p className="eyebrow">Sound</p>
        <h2 className="panel-title tts-properties-title">Text to Speech</h2>
      </div>

      <div className="tts-properties-shell">
        <div className="tts-properties-main" ref={splitContainerRef}>
          <section
            className="tts-properties-voice-library"
            aria-label="Available voices"
            style={topSectionStyle}
          >
            <ul className="tts-properties-voice-grid" aria-label="Available voices list">
              {sharedVoices.map((voice) => {
                const isSelected = voice.id === selectedSharedVoice?.id;
                return (
                  <li key={voice.id} className="tts-properties-voice-item">
                    <div className={`tts-properties-voice-chip ${isSelected ? "is-selected" : ""}`}>
                      <button
                        type="button"
                        className="tts-properties-voice-chip-select"
                        aria-pressed={isSelected}
                        aria-label={`${voice.name} voice`}
                        onClick={() => setSelectedSharedVoice(voice.id)}
                      >
                        <span className="tts-properties-voice-chip-avatar" aria-hidden="true">
                          {getVoiceInitials(voice.name)}
                        </span>
                        <span className="tts-properties-voice-chip-copy">
                          <span className="tts-properties-voice-chip-label">Voice</span>
                          <span className="tts-properties-voice-chip-name">{voice.name}</span>
                        </span>
                      </button>

                      <button
                        type="button"
                        className="tts-properties-voice-chip-play"
                        aria-label={`Play ${voice.name} sample`}
                      >
                        <span className="tts-properties-voice-chip-play-icon" aria-hidden="true">
                          ▶
                        </span>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <div
            className="tts-properties-horizontal-divider-wrap reference-grid-horizontal-divider-wrap"
            {...dividerProps}
          >
            <div
              className="tts-properties-horizontal-divider reference-grid-horizontal-divider"
              aria-hidden="true"
            />
          </div>

          <div className="tts-properties-compose-area" style={bottomSectionStyle}>
            <div className="tts-properties-script-input-shell">
              <textarea
                className="tts-properties-script-input"
                value={scriptText}
                onChange={(event) => setScriptText(event.target.value)}
                maxLength={maxScriptCharacters}
                placeholder="Start typing here or paste any text you want to turn into lifelike speech..."
                aria-label="Text input"
              />
            </div>

            <div className="tts-properties-script-divider" aria-hidden="true" />

            <div className="tts-properties-script-actions">
              <p className="tts-properties-script-count" aria-live="polite">
                {scriptCharacterCount.toLocaleString()} / {maxScriptCharacters.toLocaleString()}
              </p>
              <button
                type="button"
                className="tts-properties-generate-btn"
                disabled={!isGenerateActive}
                aria-label="Generate"
              >
                <span className="tts-properties-generate-label">Generate</span>
                <span className="tts-properties-generate-pill" aria-hidden="true">
                  <span className="tts-properties-generate-cost-icon">✦</span>
                  <span className="tts-properties-generate-cost-value">
                    {ttsGenerateCost}
                    <span className="tts-properties-generate-cost-label">credits</span>
                  </span>
                </span>
              </button>
            </div>
          </div>
        </div>

        <div className="tts-properties-column-shell tts-properties-column-shell--aside">
          <aside className="tts-properties-aside">
            <section className="tts-properties-card tts-properties-card--panel-gray">
              <div className="tts-properties-card-heading-row">
                <p className="tts-properties-card-kicker">Voice</p>
              </div>

              <TtsVoiceDropdown
                value={selectedVoice}
                options={VOICE_LIBRARY_OPTIONS}
                onSelect={setSelectedVoice}
              />
            </section>

            <section className="tts-properties-card tts-properties-card--panel-gray">
              <div className="tts-properties-card-heading-row">
                <p className="tts-properties-card-kicker">Voice shaping</p>
              </div>

              <div className="tts-properties-slider-stack">
                {voiceSliders.map((slider) => (
                  <TtsSlider
                    key={slider.label}
                    label={slider.label}
                    helper={slider.helper}
                    value={slider.value}
                    displayValue={slider.displayValue}
                  />
                ))}
              </div>
            </section>

            <section className="tts-properties-card tts-properties-card--panel-gray">
              <div className="tts-properties-delivery-stack">
                <label className="tts-properties-output-field">
                  <span className="tts-properties-selector-label">Language</span>
                  <span className="tts-properties-output-select-shell">
                    <select
                      className="tts-properties-output-select"
                      value={selectedLanguage}
                      onChange={(event) => setSelectedLanguage(event.target.value)}
                      aria-label="Language override"
                    >
                      {languageOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <CaretDown size={14} weight="bold" aria-hidden="true" />
                  </span>
                </label>
                <label className="tts-properties-output-field">
                  <span className="tts-properties-selector-label">Format</span>
                  <span className="tts-properties-output-select-shell">
                    <select
                      className="tts-properties-output-select"
                      value={outputFormat}
                      onChange={(event) => setOutputFormat(event.target.value)}
                      aria-label="Output format"
                    >
                      {outputFormatOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <CaretDown size={14} weight="bold" aria-hidden="true" />
                  </span>
                </label>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </section>
  );
});
