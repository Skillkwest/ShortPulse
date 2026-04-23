/**
 * Dedicated music workflow panel for AI Studio.
 * Keeps music composition UI isolated from generic Sound and Sound Effects panels.
 */
import React from "react";
import { useReferenceGridHorizontalSplit } from "../hooks/useReferenceGridHorizontalSplit";

export type MusicMode = "instrumental" | "vocal";
export type MusicStructure = "loop" | "full-track" | "cinematic";
export type MusicFormat = "mp3_44100_128" | "wav_48000";
export const hardcodedMusicModelId = "music_v1";

export type MusicGenerateRequest = {
  text: string;
  durationSeconds: number;
  bpm: number;
  mode: MusicMode;
  structure: MusicStructure;
  energyPercent: number;
  outputFormat: MusicFormat;
  modelId: typeof hardcodedMusicModelId;
};

export type MusicPropertiesPanelProps = {
  isGenerating?: boolean;
  onGenerate?: (request: MusicGenerateRequest) => Promise<void> | void;
};

type MusicSliderProps = {
  label: string;
  helper?: string;
  value: number;
  displayValue: string;
  onChange: (nextValue: number) => void;
};

const musicPromptPlaceholder =
  "Describe the song you want to generate: genre, pacing, instrumentation, vocal style, and where the cue should land in the edit.";
const maxPromptCharacters = 800;
const minDurationSeconds = 8;
const maxDurationSeconds = 180;
const minBpm = 60;
const maxBpm = 180;
const musicBaseCredits = 90;
const musicPerSecondCredits = 4;
const minTopLibraryHeightPx = 0;
const minBottomComposerHeightPx = 480;
const minVisibleLibraryHeightPx = 76;

const musicModeOptions: readonly { value: MusicMode; label: string; helper: string }[] = [
  {
    value: "instrumental",
    label: "Instrumental",
    helper: "No lead vocal. Best for tutorials, product beats, and underscoring.",
  },
  {
    value: "vocal",
    label: "Vocal",
    helper: "Include topline or hook-led direction for lyrical cue generation.",
  },
];

const musicStructureOptions: readonly { value: MusicStructure; label: string }[] = [
  { value: "loop", label: "Loop" },
  { value: "full-track", label: "Full Track" },
  { value: "cinematic", label: "Cinematic" },
];

const musicFormatOptions: readonly { value: MusicFormat; label: string }[] = [
  {
    value: "mp3_44100_128",
    label: "MP3 (44.1 kHz)",
  },
  {
    value: "wav_48000",
    label: "WAV (48 kHz)",
  },
];

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

const formatDurationLabel = (value: number): string => `${value}s`;
const formatCreditValue = (value: number): string =>
  Number.isInteger(value) ? String(value) : value.toFixed(1);

function MusicSlider({ label, helper, value, displayValue, onChange }: MusicSliderProps) {
  return (
    <label className="music-properties-slider">
      <span className="music-properties-slider-label-row">
        <span className="music-properties-slider-label">{label}</span>
        <output className="music-properties-slider-value" aria-live="polite">
          {displayValue}
        </output>
      </span>
      <span
        className="music-properties-slider-track"
        style={
          {
            "--music-slider-progress": `${value}%`,
          } as React.CSSProperties
        }
      >
        <input
          className="music-properties-slider-input"
          type="range"
          min={0}
          max={100}
          step={1}
          value={value}
          aria-label={label}
          onChange={(event) => onChange(Number(event.target.value))}
          onInput={(event) => onChange(Number((event.target as HTMLInputElement).value))}
        />
      </span>
      {helper ? <span className="music-properties-slider-helper">{helper}</span> : null}
    </label>
  );
}

export const MusicPropertiesPanel = React.memo(function MusicPropertiesPanel({
  isGenerating = false,
  onGenerate,
}: MusicPropertiesPanelProps) {
  const splitContainerRef = React.useRef<HTMLDivElement | null>(null);
  const [prompt, setPrompt] = React.useState("");
  const [durationSeconds, setDurationSeconds] = React.useState(30);
  const [bpm, setBpm] = React.useState(112);
  const [energyPercent, setEnergyPercent] = React.useState(58);
  const [selectedMode, setSelectedMode] = React.useState<MusicMode>("instrumental");
  const [selectedStructure, setSelectedStructure] = React.useState<MusicStructure>("loop");
  const [selectedFormat, setSelectedFormat] = React.useState<MusicFormat>("mp3_44100_128");

  const { topRatio, topSectionStyle, topSectionHeightPx, bottomSectionStyle, dividerProps } =
    useReferenceGridHorizontalSplit({
      enabled: true,
      containerRef: splitContainerRef,
      defaultTopRatio: 0.995,
      minTopSectionHeightPx: minTopLibraryHeightPx,
      minBottomSectionHeightPx: minBottomComposerHeightPx,
      ariaLabel: "Resize available music and composition sections",
    });

  const isLibraryVisible =
    topSectionHeightPx > 0 ? topSectionHeightPx > minVisibleLibraryHeightPx : topRatio > 0.2;
  const isGenerateEnabled = Boolean(onGenerate) && prompt.trim().length > 0 && !isGenerating;
  const estimatedCredits = musicBaseCredits + durationSeconds * musicPerSecondCredits;

  const handleGenerate = React.useCallback(async () => {
    const text = prompt.trim();
    if (!onGenerate || !text || isGenerating) return;
    await onGenerate({
      text,
      durationSeconds,
      bpm,
      mode: selectedMode,
      structure: selectedStructure,
      energyPercent,
      outputFormat: selectedFormat,
      modelId: hardcodedMusicModelId,
    });
  }, [
    bpm,
    durationSeconds,
    energyPercent,
    isGenerating,
    onGenerate,
    prompt,
    selectedFormat,
    selectedMode,
    selectedStructure,
  ]);

  return (
    <section className="music-properties-panel tool-properties" aria-label="Music properties">
      <div className="music-properties-shell">
        <div className="music-properties-column music-properties-column--main">
          <div ref={splitContainerRef} className="music-properties-main">
            <section
              className="music-properties-library"
              style={topSectionStyle}
              aria-label="Available music"
            >
              {isLibraryVisible ? (
                <>
                  <div className="music-properties-library-header">
                    <h2 className="panel-title music-properties-library-title">Music</h2>
                  </div>
                  <div className="music-properties-library-empty" aria-live="polite">
                    <p className="music-properties-library-empty-title">No music previews yet</p>
                    <p className="music-properties-library-empty-copy">
                      Generated tracks land in the Reference Grid first. Panel history is a
                      follow-up pass.
                    </p>
                  </div>
                </>
              ) : null}
            </section>

            <div
              className="music-properties-divider-wrap reference-grid-horizontal-divider-wrap"
              {...dividerProps}
            >
              <div
                className="music-properties-divider reference-grid-horizontal-divider"
                aria-hidden="true"
              />
            </div>

            <div className="music-properties-compose-area" style={bottomSectionStyle}>
              <div className="music-properties-script-input-shell">
                <textarea
                  className="music-properties-script-input"
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value.slice(0, maxPromptCharacters))}
                  maxLength={maxPromptCharacters}
                  placeholder={musicPromptPlaceholder}
                  aria-label="Music prompt"
                />
              </div>

              <div className="music-properties-script-divider" aria-hidden="true" />

              <div className="music-properties-script-actions">
                <p className="music-properties-script-count" aria-live="polite">
                  {`${prompt.length.toLocaleString()} / ${maxPromptCharacters.toLocaleString()}`}
                </p>
                <button
                  type="button"
                  className="music-properties-generate-btn"
                  disabled={!isGenerateEnabled}
                  aria-label="Generate"
                  onClick={() => {
                    void handleGenerate();
                  }}
                >
                  <span className="music-properties-generate-label">
                    {isGenerating ? "Generating..." : "Generate"}
                  </span>
                  <span className="music-properties-generate-pill" aria-hidden="true">
                    <span className="music-properties-generate-cost-icon">✦</span>
                    <span className="music-properties-generate-cost-value">
                      {formatCreditValue(estimatedCredits)}
                    </span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="music-properties-column music-properties-column--aside">
          <aside className="music-properties-aside">
            <section className="music-properties-rail-card">
              <div className="music-properties-rail-heading-row">
                <p className="music-properties-rail-kicker">Composition</p>
              </div>
              <div className="music-properties-control-stack">
                <label className="music-properties-field">
                  <span className="music-properties-field-label-row">
                    <span className="music-properties-field-label">Duration</span>
                    <span className="music-properties-field-value">
                      {formatDurationLabel(durationSeconds)}
                    </span>
                  </span>
                  <input
                    className="music-properties-number-input"
                    type="number"
                    min={minDurationSeconds}
                    max={maxDurationSeconds}
                    step={1}
                    value={durationSeconds}
                    aria-label="Music duration in seconds"
                    onChange={(event) =>
                      setDurationSeconds(
                        clamp(
                          Number(event.target.value) || minDurationSeconds,
                          minDurationSeconds,
                          maxDurationSeconds
                        )
                      )
                    }
                  />
                </label>
                <label className="music-properties-field">
                  <span className="music-properties-field-label-row">
                    <span className="music-properties-field-label">Tempo</span>
                    <span className="music-properties-field-value">{bpm} BPM</span>
                  </span>
                  <input
                    className="music-properties-number-input"
                    type="number"
                    min={minBpm}
                    max={maxBpm}
                    step={1}
                    value={bpm}
                    aria-label="Music tempo in BPM"
                    onChange={(event) =>
                      setBpm(clamp(Number(event.target.value) || minBpm, minBpm, maxBpm))
                    }
                  />
                </label>
              </div>
            </section>

            <section className="music-properties-rail-card">
              <div className="music-properties-rail-heading-row">
                <p className="music-properties-rail-kicker">Direction</p>
              </div>
              <div className="music-properties-mode-grid" role="tablist" aria-label="Music mode">
                {musicModeOptions.map((option) => {
                  const isSelected = selectedMode === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="tab"
                      aria-label={option.label}
                      aria-selected={isSelected}
                      className={`music-properties-mode-button ${isSelected ? "is-active" : ""}`}
                      onClick={() => setSelectedMode(option.value)}
                    >
                      <span className="music-properties-mode-label">{option.label}</span>
                      <span className="music-properties-mode-helper">{option.helper}</span>
                    </button>
                  );
                })}
              </div>
              <label className="music-properties-field">
                <span className="music-properties-field-label">Arrangement</span>
                <span className="music-properties-structure-row">
                  {musicStructureOptions.map((option) => {
                    const isSelected = selectedStructure === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={`music-properties-choice-chip ${isSelected ? "is-active" : ""}`}
                        aria-pressed={isSelected}
                        onClick={() => setSelectedStructure(option.value)}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </span>
              </label>
              <MusicSlider
                label="Energy"
                value={energyPercent}
                displayValue={`${energyPercent}%`}
                onChange={setEnergyPercent}
              />
            </section>

            <section className="music-properties-rail-card">
              <div className="music-properties-rail-heading-row">
                <p className="music-properties-rail-kicker">Output</p>
              </div>
              <label className="music-properties-field">
                <span className="music-properties-field-label">Format</span>
                <span className="music-properties-select-shell">
                  <select
                    className="music-properties-select"
                    value={selectedFormat}
                    onChange={(event) => setSelectedFormat(event.target.value as MusicFormat)}
                    aria-label="Music output format"
                  >
                    {musicFormatOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </span>
              </label>
            </section>
          </aside>
        </div>
      </div>
    </section>
  );
});
