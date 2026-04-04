/**
 * Sound properties panel for AI Studio.
 * Provides the contextual inspector shell for music, voice, and SFX audio objects.
 */
import React from "react";
import { LockKeyOpen, Play, Repeat, SpeakerHigh, WaveSine } from "phosphor-react";

type SoundMode = "track" | "voice" | "sfx";

type SoundModeConfig = {
  title: string;
  summary: string;
  accentLabel: string;
  primaryLabel: string;
  secondaryLabel: string;
  tertiaryLabel: string;
};

type SoundSliderProps = {
  label: string;
  helper: string;
  value: number;
  onChange: (value: number) => void;
};

const soundModes: Record<SoundMode, SoundModeConfig> = {
  track: {
    title: "Track",
    summary: "Shape a full music layer with mix, feel, and section controls.",
    accentLabel: "Music bed",
    primaryLabel: "Energy",
    secondaryLabel: "Warmth",
    tertiaryLabel: "Width",
  },
  voice: {
    title: "Voice",
    summary: "Tune the delivery, presence, and performance of a reusable voice asset.",
    accentLabel: "Voice asset",
    primaryLabel: "Stability",
    secondaryLabel: "Expressiveness",
    tertiaryLabel: "Pitch",
  },
  sfx: {
    title: "SFX",
    summary: "Dial in impact, texture, and timing for a sound effect or accent.",
    accentLabel: "Sound effect",
    primaryLabel: "Impact",
    secondaryLabel: "Texture",
    tertiaryLabel: "Decay",
  },
};

const soundPresetMap: Record<SoundMode, Array<{ id: string; label: string }>> = {
  track: [
    { id: "cinematic", label: "Cinematic" },
    { id: "ambient", label: "Ambient" },
    { id: "pulse", label: "Driving Pulse" },
    { id: "clean", label: "Clean Mix" },
  ],
  voice: [
    { id: "warm", label: "Warm" },
    { id: "broadcast", label: "Broadcast" },
    { id: "intimate", label: "Intimate" },
    { id: "character", label: "Character" },
  ],
  sfx: [
    { id: "impact", label: "Impact" },
    { id: "whoosh", label: "Whoosh" },
    { id: "texture", label: "Texture" },
    { id: "loop", label: "Loop Ready" },
  ],
};

const takeHistory = [
  {
    id: "take-a",
    label: "Take A",
    summary: "Balanced mix with tighter low end.",
  },
  {
    id: "take-b",
    label: "Take B",
    summary: "Slightly brighter and more aggressive.",
  },
  {
    id: "take-c",
    label: "Take C",
    summary: "Softened dynamics with a wider stereo image.",
  },
];

const waveformBars = [26, 42, 31, 58, 49, 63, 45, 78, 52, 65, 37, 54, 83, 61, 48, 72, 58, 39];

const formatPercent = (value: number): string => `${value}%`;

/**
 * Renders a labeled slider row with a value readout.
 */
function SoundSlider({ label, helper, value, onChange }: SoundSliderProps) {
  return (
    <label className="sound-slider">
      <span className="sound-slider-label-row">
        <span className="sound-slider-label">{label}</span>
        <output className="sound-slider-value" aria-live="polite">
          {formatPercent(value)}
        </output>
      </span>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        aria-label={label}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
      <span className="sound-slider-helper">{helper}</span>
    </label>
  );
}

/**
 * Renders the contextual Sound inspector shell.
 */
export const SoundPropertiesPanel = React.memo(function SoundPropertiesPanel() {
  const [mode, setMode] = React.useState<SoundMode>("track");
  const [energy, setEnergy] = React.useState(66);
  const [warmth, setWarmth] = React.useState(58);
  const [width, setWidth] = React.useState(74);
  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  const [selectedPresetId, setSelectedPresetId] = React.useState<string>("cinematic");
  const modeConfig = soundModes[mode];
  const presets = soundPresetMap[mode];

  React.useEffect(() => {
    setSelectedPresetId(presets[0]?.id ?? "cinematic");
  }, [presets]);

  return (
    <section className="sound-properties-panel tool-properties" aria-label="Sound properties">
      <div className="tool-header sound-properties-header">
        <div>
          <p className="eyebrow">Sound</p>
          <h2 className="panel-title">Sound Properties</h2>
          <p className="tiny subdued sound-properties-subtitle">
            Contextual controls for tracks, voices, and sound effects.
          </p>
        </div>
        <div className="sound-properties-header-actions">
          <span className="sound-properties-status-pill">{modeConfig.accentLabel}</span>
          <button type="button" className="sound-properties-icon-btn" aria-label="Preview sound">
            <Play size={16} weight="bold" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="sound-properties-shell">
        <div className="sound-properties-main">
          <section className="sound-properties-card sound-properties-overview-card">
            <div className="sound-properties-overview-copy">
              <p className="sound-properties-card-kicker">Inspector</p>
              <h3 className="sound-properties-card-title">{modeConfig.title} focus</h3>
              <p className="sound-properties-card-text">{modeConfig.summary}</p>
            </div>
            <div className="sound-properties-mini-preview" aria-hidden="true">
              <div className="sound-properties-waveform">
                {waveformBars.map((bar, index) => (
                  <span
                    key={`${mode}-${index}`}
                    className="sound-properties-wavebar"
                    style={{ height: `${bar}%` }}
                  />
                ))}
              </div>
              <div className="sound-properties-mini-transport">
                <button type="button" className="sound-properties-secondary-btn">
                  <SpeakerHigh size={15} weight="bold" aria-hidden="true" />
                  Audition
                </button>
                <button type="button" className="sound-properties-secondary-btn">
                  <Repeat size={15} weight="bold" aria-hidden="true" />
                  Compare takes
                </button>
              </div>
            </div>
          </section>

          <section className="sound-properties-card">
            <div className="sound-properties-card-heading-row">
              <div>
                <p className="sound-properties-card-kicker">Creative shape</p>
                <h3 className="sound-properties-card-title">Mode and presets</h3>
              </div>
              <button
                type="button"
                className="sound-properties-text-btn"
                onClick={() => setAdvancedOpen((current) => !current)}
              >
                {advancedOpen ? "Hide advanced" : "Show advanced"}
              </button>
            </div>
            <div className="sound-properties-mode-switch" role="tablist" aria-label="Sound modes">
              {Object.entries(soundModes).map(([value, config]) => {
                const isActive = mode === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-label={config.title}
                    className={`sound-properties-mode-button ${isActive ? "is-active" : ""}`}
                    onClick={() => setMode(value as SoundMode)}
                  >
                    <span className="sound-properties-mode-label">{config.title}</span>
                    <span className="sound-properties-mode-note">{config.accentLabel}</span>
                  </button>
                );
              })}
            </div>
            <div className="sound-properties-chip-row" aria-label="Recommended presets">
              {presets.map((preset) => {
                const isActive = selectedPresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    className={`sound-properties-chip ${isActive ? "is-active" : ""}`}
                    aria-pressed={isActive}
                    onClick={() => setSelectedPresetId(preset.id)}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="sound-properties-card">
            <div className="sound-properties-card-heading-row">
              <div>
                <p className="sound-properties-card-kicker">Mix and feel</p>
                <h3 className="sound-properties-card-title">Primary controls</h3>
              </div>
              <span className="sound-properties-card-badge">Preview live</span>
            </div>
            <div className="sound-properties-slider-grid">
              <SoundSlider
                label={modeConfig.primaryLabel}
                helper={`Tighten or soften the ${modeConfig.title.toLowerCase()} response.`}
                value={energy}
                onChange={setEnergy}
              />
              <SoundSlider
                label={modeConfig.secondaryLabel}
                helper={`Adjust tonal character for a more polished output.`}
                value={warmth}
                onChange={setWarmth}
              />
              <SoundSlider
                label={modeConfig.tertiaryLabel}
                helper={`Spread the output across the stereo field.`}
                value={width}
                onChange={setWidth}
              />
            </div>
          </section>

          <section className={`sound-properties-card ${advancedOpen ? "is-expanded" : ""}`}>
            <div className="sound-properties-card-heading-row">
              <div>
                <p className="sound-properties-card-kicker">Advanced</p>
                <h3 className="sound-properties-card-title">Control surface</h3>
              </div>
              <button
                type="button"
                className="sound-properties-text-btn"
                onClick={() => setAdvancedOpen((current) => !current)}
              >
                {advancedOpen ? "Collapse" : "Expand"}
              </button>
            </div>
            <p className="tiny subdued sound-properties-advanced-copy">
              {advancedOpen
                ? "Expanded controls are visible for source, visibility, and export routing."
                : "Expand this section for source, visibility, and export routing."}
            </p>
            <div className="sound-properties-advanced-grid">
              <div className="sound-properties-meta-card">
                <span className="sound-properties-meta-label">Source</span>
                <span className="sound-properties-meta-value">Generated audio</span>
              </div>
              <div className="sound-properties-meta-card">
                <span className="sound-properties-meta-label">Visibility</span>
                <span className="sound-properties-meta-value">Private draft</span>
              </div>
              <div className="sound-properties-meta-card">
                <span className="sound-properties-meta-label">Duration</span>
                <span className="sound-properties-meta-value">0:18</span>
              </div>
              <div className="sound-properties-meta-card">
                <span className="sound-properties-meta-label">Format</span>
                <span className="sound-properties-meta-value">WAV / stems ready</span>
              </div>
            </div>
          </section>
        </div>

        <aside className="sound-properties-aside">
          <section className="sound-properties-card">
            <div className="sound-properties-card-heading-row">
              <div>
                <p className="sound-properties-card-kicker">Take history</p>
                <h3 className="sound-properties-card-title">Version log</h3>
              </div>
              <button type="button" className="sound-properties-text-btn">
                Restore
              </button>
            </div>
            <div className="sound-properties-history-list">
              {takeHistory.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  className={`sound-properties-history-item ${index === 0 ? "is-active" : ""}`}
                >
                  <span className="sound-properties-history-label">{item.label}</span>
                  <span className="sound-properties-history-summary">{item.summary}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="sound-properties-card">
            <div className="sound-properties-card-heading-row">
              <div>
                <p className="sound-properties-card-kicker">Quick actions</p>
                <h3 className="sound-properties-card-title">Ready to ship</h3>
              </div>
            </div>
            <div className="sound-properties-action-row">
              <button type="button" className="sound-properties-primary-btn">
                <WaveSine size={16} weight="bold" aria-hidden="true" />
                Preview changes
              </button>
              <button type="button" className="sound-properties-secondary-btn">
                <LockKeyOpen size={16} weight="bold" aria-hidden="true" />
                Lock take
              </button>
            </div>
            <p className="tiny subdued sound-properties-footer-copy">
              Use this panel to refine the selected audio object without leaving the workspace.
            </p>
          </section>
        </aside>
      </div>
    </section>
  );
});
