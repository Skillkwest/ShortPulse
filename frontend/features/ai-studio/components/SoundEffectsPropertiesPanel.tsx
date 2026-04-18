/**
 * Dedicated Sound Effects properties panel for AI Studio.
 * Mirrors the Voices workflow feel while keeping all panel logic local to Sound Effects.
 */
import React from "react";
import { Play } from "phosphor-react";

type SoundEffectFormat = "mp3_44100_128" | "wav_48000";

type SoundEffectLibraryItem = {
  id: string;
  name: string;
  summary: string;
  waveform: number[];
  prompt: string;
  durationSeconds: number | null;
  loop: boolean;
  promptInfluence: number;
  format: SoundEffectFormat;
};

type SliderProps = {
  label: string;
  helper: string;
  value: number;
  displayValue: string;
  onChange: (nextValue: number) => void;
};

const soundEffectPromptPlaceholder =
  "Describe the sound effect you want to generate with detail, texture, space, and motion.";
const maxPromptCharacters = 450;
const autoDurationCredits = 100;
const perSecondDurationCredits = 20;
const defaultPromptInfluencePercent = 30;
const minDurationSeconds = 0.5;
const maxDurationSeconds = 30;
const defaultTopPanePercent = 58;
const minBottomPaneHeightPx = 240;
const splitStepPercent = 6;

const soundEffectFormatOptions = [
  { value: "mp3_44100_128", label: "MP3 (44.1kHz)" },
  { value: "wav_48000", label: "WAV (48kHz)" },
] as const satisfies readonly { value: SoundEffectFormat; label: string }[];

const starterSoundEffects = [
  {
    id: "cathedral-boom",
    name: "Cathedral Boom",
    summary: "Large cinematic impact with a long stone tail.",
    waveform: [8, 12, 18, 10, 14, 24, 16, 28, 20, 13, 17, 9],
    prompt:
      "Huge cinematic boom inside a vaulted cathedral, with a deep sub hit, airy reverb bloom, and a long decaying tail.",
    durationSeconds: 4,
    loop: false,
    promptInfluence: 0.36,
    format: "wav_48000",
  },
  {
    id: "neon-alarm-loop",
    name: "Neon Alarm Loop",
    summary: "Rhythmic sci-fi warning pulse designed to repeat cleanly.",
    waveform: [10, 16, 9, 20, 11, 18, 10, 22, 12, 17, 9, 15],
    prompt:
      "Seamless futuristic alarm pulse with a neon synth bite, short metallic tick, and a steady loop-friendly rhythm.",
    durationSeconds: 2.5,
    loop: true,
    promptInfluence: 0.54,
    format: "mp3_44100_128",
  },
  {
    id: "desert-wind-bed",
    name: "Desert Wind Bed",
    summary: "Soft moving wind with dusty high-end texture.",
    waveform: [6, 8, 10, 12, 14, 11, 9, 13, 15, 12, 10, 8],
    prompt:
      "Dry desert wind moving across an open plain with a gentle sandy hiss, distant gust swells, and a calm ambient bed.",
    durationSeconds: 8,
    loop: false,
    promptInfluence: 0.28,
    format: "mp3_44100_128",
  },
  {
    id: "servo-lock",
    name: "Servo Lock",
    summary: "Short mechanical latch with a precise sci-fi click.",
    waveform: [5, 7, 18, 8, 6, 22, 10, 7, 19, 8, 6, 5],
    prompt:
      "Compact servo motor winding into a sharp magnetic lock click, detailed mechanical texture, very clean transient, no ambience.",
    durationSeconds: 1,
    loop: false,
    promptInfluence: 0.48,
    format: "mp3_44100_128",
  },
  {
    id: "vinyl-crowd-riser",
    name: "Vinyl Crowd Riser",
    summary: "Analog wash that swells into a warm noisy lift.",
    waveform: [7, 9, 11, 13, 15, 17, 20, 18, 16, 14, 12, 10],
    prompt:
      "A warm vinyl crackle bed rising into a crowd-like swell with dusty analog texture, subtle distortion, and a smooth build.",
    durationSeconds: 6,
    loop: false,
    promptInfluence: 0.42,
    format: "wav_48000",
  },
  {
    id: "arcade-coin-hit",
    name: "Arcade Coin Hit",
    summary: "Bright retro pickup chime with playful punch.",
    waveform: [6, 10, 20, 12, 8, 16, 9, 7, 14, 10, 8, 6],
    prompt:
      "Retro arcade coin pickup with a punchy attack, bright digital shimmer, and a short celebratory sparkle tail.",
    durationSeconds: 0.5,
    loop: false,
    promptInfluence: 0.6,
    format: "mp3_44100_128",
  },
] satisfies readonly SoundEffectLibraryItem[];

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

const clampDuration = (value: number): number =>
  clamp(Math.round(value * 2) / 2, minDurationSeconds, maxDurationSeconds);

const formatDurationLabel = (value: number | null): string =>
  value === null ? "Auto" : `${value.toFixed(value % 1 === 0 ? 0 : 1)}s`;

const formatCreditValue = (value: number): string => {
  const roundedValue = Number(value.toFixed(1));
  return roundedValue % 1 === 0 ? roundedValue.toFixed(0) : roundedValue.toFixed(1);
};

const parseDurationInput = (value: string): number | null => {
  if (!value.trim()) return null;
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) return null;
  return clampDuration(parsedValue);
};

const toPromptInfluencePercent = (value: number): number => clamp(Math.round(value * 100), 0, 100);

function SoundEffectsSlider({ label, helper, value, displayValue, onChange }: SliderProps) {
  const handleValueInput = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement> | React.FormEvent<HTMLInputElement>) => {
      onChange(Number((event.target as HTMLInputElement).value));
    },
    [onChange]
  );

  return (
    <label className="sound-effects-properties-slider">
      <span className="sound-effects-properties-slider-label-row">
        <span className="sound-effects-properties-slider-label">{label}</span>
        <output className="sound-effects-properties-slider-value" aria-live="polite">
          {displayValue}
        </output>
      </span>
      <span
        className="sound-effects-properties-slider-track"
        style={
          {
            "--sound-effects-slider-progress": `${value}%`,
          } as React.CSSProperties
        }
      >
        <input
          className="sound-effects-properties-slider-input"
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
      <span className="sound-effects-properties-slider-helper">{helper}</span>
    </label>
  );
}

export const SoundEffectsPropertiesPanel = React.memo(function SoundEffectsPropertiesPanel() {
  const splitContainerRef = React.useRef<HTMLDivElement | null>(null);
  const promptInputRef = React.useRef<HTMLTextAreaElement | null>(null);
  const [selectedLibraryItemId, setSelectedLibraryItemId] = React.useState<string | null>(null);
  const [prompt, setPrompt] = React.useState("");
  const [durationInput, setDurationInput] = React.useState("");
  const [loopEnabled, setLoopEnabled] = React.useState(false);
  const [promptInfluencePercent, setPromptInfluencePercent] = React.useState(
    defaultPromptInfluencePercent
  );
  const [selectedFormat, setSelectedFormat] = React.useState<SoundEffectFormat>("mp3_44100_128");
  const [topPanePercent, setTopPanePercent] = React.useState(defaultTopPanePercent);
  const hasInitializedDefaultSplitRef = React.useRef(false);

  const selectedLibraryItem = React.useMemo(
    () =>
      starterSoundEffects.find((soundEffect) => soundEffect.id === selectedLibraryItemId) ?? null,
    [selectedLibraryItemId]
  );

  const durationSeconds = React.useMemo(() => parseDurationInput(durationInput), [durationInput]);
  const promptInfluenceValue = React.useMemo(
    () => Number((promptInfluencePercent / 100).toFixed(2)),
    [promptInfluencePercent]
  );
  const generateCost = React.useMemo(
    () =>
      durationSeconds === null
        ? autoDurationCredits
        : Number((durationSeconds * perSecondDurationCredits).toFixed(1)),
    [durationSeconds]
  );
  const isGenerateEnabled = prompt.trim().length > 0;
  const isLibraryVisible = topPanePercent > 0;
  const minTopPanePercent = 0;

  const resolveMaxTopPanePercent = React.useCallback((): number => {
    const rect = splitContainerRef.current?.getBoundingClientRect();
    if (!rect || rect.height <= 0) return 68;
    const minBottomPanePercent = (minBottomPaneHeightPx / rect.height) * 100;
    return clamp(100 - minBottomPanePercent, 16, 84);
  }, []);

  const commitTopPanePercent = React.useCallback(
    (nextValue: number) => {
      setTopPanePercent(
        Number(clamp(nextValue, minTopPanePercent, resolveMaxTopPanePercent()).toFixed(1))
      );
    },
    [resolveMaxTopPanePercent]
  );

  React.useLayoutEffect(() => {
    if (hasInitializedDefaultSplitRef.current) return;
    hasInitializedDefaultSplitRef.current = true;
    commitTopPanePercent(resolveMaxTopPanePercent());
  }, [commitTopPanePercent, resolveMaxTopPanePercent]);

  const handleCreateNewSoundEffect = React.useCallback(() => {
    setSelectedLibraryItemId(null);
    setPrompt("");
    setDurationInput("");
    setLoopEnabled(false);
    setPromptInfluencePercent(defaultPromptInfluencePercent);
    setSelectedFormat("mp3_44100_128");
    promptInputRef.current?.focus();
  }, []);

  const handleSelectLibraryItem = React.useCallback((item: SoundEffectLibraryItem) => {
    setSelectedLibraryItemId(item.id);
    setPrompt(item.prompt);
    setDurationInput(item.durationSeconds === null ? "" : String(item.durationSeconds));
    setLoopEnabled(item.loop);
    setPromptInfluencePercent(toPromptInfluencePercent(item.promptInfluence));
    setSelectedFormat(item.loop ? "mp3_44100_128" : item.format);
  }, []);

  const handleDurationBlur = React.useCallback(() => {
    if (!durationInput.trim()) {
      setDurationInput("");
      return;
    }
    const nextDuration = parseDurationInput(durationInput);
    setDurationInput(nextDuration === null ? "" : String(nextDuration));
  }, [durationInput]);

  const handleLoopToggle = React.useCallback(() => {
    setLoopEnabled((currentValue) => {
      const nextValue = !currentValue;
      if (nextValue && selectedFormat === "wav_48000") {
        setSelectedFormat("mp3_44100_128");
      }
      return nextValue;
    });
  }, [selectedFormat]);

  const updateTopPaneFromClientY = React.useCallback(
    (clientY: number) => {
      const rect = splitContainerRef.current?.getBoundingClientRect();
      if (!rect || rect.height <= 0) return;
      const rawPercent = ((clientY - rect.top) / rect.height) * 100;
      commitTopPanePercent(rawPercent);
    },
    [commitTopPanePercent]
  );

  const handleDividerPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();

      const handlePointerMove = (pointerEvent: PointerEvent) => {
        updateTopPaneFromClientY(pointerEvent.clientY);
      };

      const handlePointerUp = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    },
    [updateTopPaneFromClientY]
  );

  const handleDividerKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Home") {
        event.preventDefault();
        commitTopPanePercent(0);
        return;
      }
      if (event.key === "End") {
        event.preventDefault();
        commitTopPanePercent(resolveMaxTopPanePercent());
        return;
      }
      if (event.key === "ArrowUp" || event.key === "PageUp") {
        event.preventDefault();
        commitTopPanePercent(topPanePercent - splitStepPercent);
        return;
      }
      if (event.key === "ArrowDown" || event.key === "PageDown") {
        event.preventDefault();
        commitTopPanePercent(topPanePercent + splitStepPercent);
      }
    },
    [commitTopPanePercent, resolveMaxTopPanePercent, topPanePercent]
  );

  const topSectionStyle = React.useMemo(
    () => ({
      flexBasis: `${topPanePercent}%`,
    }),
    [topPanePercent]
  );

  const bottomSectionStyle = React.useMemo(
    () => ({
      flexBasis: `${100 - topPanePercent}%`,
    }),
    [topPanePercent]
  );

  return (
    <section className="sound-effects-properties-panel tool-properties">
      <div className="sound-effects-properties-shell">
        <div className="sound-effects-properties-column sound-effects-properties-column--main">
          <div ref={splitContainerRef} className="sound-effects-properties-main">
            <section
              className="sound-effects-properties-library"
              style={topSectionStyle}
              aria-label="Available sound effects"
            >
              {isLibraryVisible ? (
                <>
                  <div className="sound-effects-properties-library-header">
                    <h2 className="panel-title sound-effects-properties-library-title">
                      Sound Effects
                    </h2>
                    <button
                      type="button"
                      className="sound-effects-properties-library-create-btn"
                      aria-label="+ Create New Sound Effect"
                      onClick={handleCreateNewSoundEffect}
                    >
                      <span
                        className="sound-effects-properties-library-create-btn-icon"
                        aria-hidden="true"
                      >
                        +
                      </span>
                      <span>Create New Sound Effect</span>
                    </button>
                  </div>

                  <ul
                    className="sound-effects-properties-library-grid"
                    aria-label="Available sound effects list"
                  >
                    {starterSoundEffects.map((item) => {
                      const isSelected = item.id === selectedLibraryItem?.id;
                      return (
                        <li key={item.id} className="sound-effects-properties-library-item">
                          <div
                            className={`sound-effects-properties-card ${
                              isSelected ? "is-selected" : ""
                            }`}
                          >
                            <button
                              type="button"
                              className="sound-effects-properties-card-play"
                              aria-label={`Play ${item.name} preview`}
                            >
                              <Play size={11} weight="fill" />
                            </button>

                            <button
                              type="button"
                              className="sound-effects-properties-card-select"
                              aria-label={`${item.name} sound effect`}
                              aria-pressed={isSelected}
                              onClick={() => handleSelectLibraryItem(item)}
                            >
                              <span className="sound-effects-properties-card-copy">
                                <span className="sound-effects-properties-card-mainline">
                                  <span className="sound-effects-properties-card-name">
                                    {item.name}
                                  </span>
                                  <span
                                    className="sound-effects-properties-card-waveform"
                                    aria-hidden="true"
                                  >
                                    {item.waveform.map((height, index) => (
                                      <span
                                        key={`${item.id}-waveform-bar-${index}`}
                                        className="sound-effects-properties-card-waveform-bar"
                                        style={
                                          {
                                            "--sound-effects-waveform-bar-height": `${height}px`,
                                          } as React.CSSProperties
                                        }
                                      />
                                    ))}
                                  </span>
                                </span>
                              </span>
                            </button>

                            <div className="sound-effects-properties-card-meta" aria-hidden="true">
                              <span className="sound-effects-properties-card-duration">
                                {formatDurationLabel(item.durationSeconds)}
                              </span>
                              <span className="sound-effects-properties-card-loop">
                                {item.loop ? "Looping" : "One-shot"}
                              </span>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : null}
            </section>

            <div
              className="sound-effects-properties-divider-wrap reference-grid-horizontal-divider-wrap"
              role="separator"
              tabIndex={0}
              aria-label="Resize available sound effects and prompt sections"
              aria-orientation="horizontal"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(topPanePercent)}
              onPointerDown={handleDividerPointerDown}
              onKeyDown={handleDividerKeyDown}
            >
              <div
                className="sound-effects-properties-divider reference-grid-horizontal-divider"
                aria-hidden="true"
              />
            </div>

            <div className="sound-effects-properties-compose-area" style={bottomSectionStyle}>
              <div className="sound-effects-properties-script-input-shell">
                <textarea
                  ref={promptInputRef}
                  className="sound-effects-properties-script-input"
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value.slice(0, maxPromptCharacters))}
                  maxLength={maxPromptCharacters}
                  placeholder={soundEffectPromptPlaceholder}
                  aria-label="Sound effect prompt"
                />
              </div>

              <div className="sound-effects-properties-script-divider" aria-hidden="true" />

              <div className="sound-effects-properties-script-actions">
                <p className="sound-effects-properties-script-count" aria-live="polite">
                  {`${prompt.length.toLocaleString()} / ${maxPromptCharacters.toLocaleString()}`}
                </p>
                <button
                  type="button"
                  className="sound-effects-properties-generate-btn"
                  disabled={!isGenerateEnabled}
                  aria-label="Generate"
                >
                  <span className="sound-effects-properties-generate-label">Generate</span>
                  <span className="sound-effects-properties-generate-pill" aria-hidden="true">
                    <span className="sound-effects-properties-generate-cost-icon">✦</span>
                    <span className="sound-effects-properties-generate-cost-value">
                      {formatCreditValue(generateCost)}
                      <span className="sound-effects-properties-generate-cost-label">credits</span>
                    </span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="sound-effects-properties-column sound-effects-properties-column--aside">
          <aside className="sound-effects-properties-aside">
            <section className="sound-effects-properties-rail-card">
              <div className="sound-effects-properties-rail-heading-row">
                <p className="sound-effects-properties-rail-kicker">Generation settings</p>
              </div>

              <div className="sound-effects-properties-control-stack">
                <label className="sound-effects-properties-field">
                  <span className="sound-effects-properties-field-label-row">
                    <span className="sound-effects-properties-field-label">Duration</span>
                    <span className="sound-effects-properties-field-value">
                      {formatDurationLabel(durationSeconds)}
                    </span>
                  </span>
                  <input
                    className="sound-effects-properties-number-input"
                    type="number"
                    min={minDurationSeconds}
                    max={maxDurationSeconds}
                    step={0.5}
                    value={durationInput}
                    placeholder="Auto"
                    aria-label="Duration in seconds"
                    onChange={(event) => setDurationInput(event.target.value)}
                    onBlur={handleDurationBlur}
                  />
                  <span className="sound-effects-properties-field-helper">
                    Leave blank for auto duration. Manual duration supports {minDurationSeconds}s to{" "}
                    {maxDurationSeconds}s.
                  </span>
                </label>

                <button
                  type="button"
                  role="switch"
                  aria-checked={loopEnabled}
                  aria-label="Loop sound effect"
                  className={`sound-effects-properties-switch-row ${
                    loopEnabled ? "is-active" : ""
                  }`}
                  onClick={handleLoopToggle}
                >
                  <span className="sound-effects-properties-switch-copy">
                    <span className="sound-effects-properties-switch-label">Loop</span>
                    <span className="sound-effects-properties-switch-helper">
                      Generates a repeatable effect bed when enabled.
                    </span>
                  </span>
                  <span className="sound-effects-properties-switch-control" aria-hidden="true">
                    <span className="sound-effects-properties-switch-thumb" />
                  </span>
                </button>
              </div>
            </section>

            <section className="sound-effects-properties-rail-card">
              <div className="sound-effects-properties-rail-heading-row">
                <p className="sound-effects-properties-rail-kicker">Prompt guidance</p>
              </div>

              <SoundEffectsSlider
                label="Prompt influence"
                helper="Higher values push the result closer to the written prompt."
                value={promptInfluencePercent}
                displayValue={promptInfluenceValue.toFixed(2)}
                onChange={setPromptInfluencePercent}
              />
            </section>

            <section className="sound-effects-properties-rail-card">
              <div className="sound-effects-properties-rail-heading-row">
                <p className="sound-effects-properties-rail-kicker">Output</p>
              </div>

              <label className="sound-effects-properties-field">
                <span className="sound-effects-properties-field-label">Format</span>
                <span className="sound-effects-properties-select-shell">
                  <select
                    className="sound-effects-properties-select"
                    value={selectedFormat}
                    onChange={(event) => setSelectedFormat(event.target.value as SoundEffectFormat)}
                    aria-label="Sound effect output format"
                  >
                    {soundEffectFormatOptions.map((option) => (
                      <option
                        key={option.value}
                        value={option.value}
                        disabled={loopEnabled && option.value === "wav_48000"}
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
                </span>
                <span className="sound-effects-properties-field-helper">
                  WAV export stays available for non-looping effects only.
                </span>
              </label>
            </section>
          </aside>
        </div>
      </div>
    </section>
  );
});
