/**
 * Dedicated Sound Effects properties panel for AI Studio.
 * Mirrors the Voices workflow feel while keeping all panel logic local to Sound Effects.
 */
import React from "react";

export type SoundEffectFormat = "mp3_44100_128" | "pcm_48000";
export const hardcodedSoundEffectsModelId = "eleven_text_to_sound_v2";

export type SoundEffectsGenerateRequest = {
  text: string;
  durationSeconds: number | null;
  loop: boolean;
  outputFormat: SoundEffectFormat;
  modelId: typeof hardcodedSoundEffectsModelId;
};

export type SoundEffectsPropertiesPanelProps = {
  isGenerating?: boolean;
  onGenerate?: (request: SoundEffectsGenerateRequest) => Promise<void> | void;
};

const soundEffectPromptPlaceholder =
  "Describe the sound effect you want to generate with detail, texture, space, and motion.";
const maxPromptCharacters = 450;
const autoDurationCredits = 100;
const defaultTopPanePercent = 58;
const minBottomPaneHeightPx = 264;
const splitStepPercent = 6;

const soundEffectFormatOptions = [
  { value: "mp3_44100_128", label: "MP3 (44.1kHz)" },
  { value: "pcm_48000", label: "WAV (48kHz)" },
] as const satisfies readonly { value: SoundEffectFormat; label: string }[];

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

const formatCreditValue = (value: number): string => {
  const roundedValue = Number(value.toFixed(1));
  return roundedValue % 1 === 0 ? roundedValue.toFixed(0) : roundedValue.toFixed(1);
};

export const SoundEffectsPropertiesPanel = React.memo(function SoundEffectsPropertiesPanel({
  isGenerating = false,
  onGenerate,
}: SoundEffectsPropertiesPanelProps) {
  const splitContainerRef = React.useRef<HTMLDivElement | null>(null);
  const [prompt, setPrompt] = React.useState("");
  const [loopEnabled, setLoopEnabled] = React.useState(false);
  const [selectedFormat, setSelectedFormat] = React.useState<SoundEffectFormat>("mp3_44100_128");
  const [topPanePercent, setTopPanePercent] = React.useState(defaultTopPanePercent);
  const hasInitializedDefaultSplitRef = React.useRef(false);

  const durationSeconds = null;
  const generateCost = autoDurationCredits;
  const isGenerateEnabled = Boolean(onGenerate) && prompt.trim().length > 0 && !isGenerating;
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

  const handleLoopToggle = React.useCallback(() => {
    setLoopEnabled((currentValue) => {
      const nextValue = !currentValue;
      if (nextValue && selectedFormat === "pcm_48000") {
        setSelectedFormat("mp3_44100_128");
      }
      return nextValue;
    });
  }, [selectedFormat]);

  const handleGenerate = React.useCallback(async () => {
    const text = prompt.trim();
    if (!onGenerate || !text || isGenerating) return;
    await onGenerate({
      text,
      durationSeconds,
      loop: loopEnabled,
      outputFormat: selectedFormat,
      modelId: hardcodedSoundEffectsModelId,
    });
  }, [durationSeconds, isGenerating, loopEnabled, onGenerate, prompt, selectedFormat]);

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
                  </div>
                  <div className="sound-effects-properties-library-empty" aria-live="polite">
                    <p className="sound-effects-properties-library-empty-title">
                      No sound effects yet
                    </p>
                    <p className="sound-effects-properties-library-empty-copy">
                      Generated sound effects will appear here.
                    </p>
                  </div>
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
                  onClick={() => {
                    void handleGenerate();
                  }}
                  aria-label="Generate"
                >
                  <span className="sound-effects-properties-generate-label">
                    {isGenerating ? "Generating…" : "Generate"}
                  </span>
                  <span className="sound-effects-properties-generate-pill" aria-hidden="true">
                    <span className="sound-effects-properties-generate-cost-icon">✦</span>
                    <span className="sound-effects-properties-generate-cost-value">
                      {formatCreditValue(generateCost)}
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
                  </span>
                  <span className="sound-effects-properties-switch-control" aria-hidden="true">
                    <span className="sound-effects-properties-switch-thumb" />
                  </span>
                </button>
              </div>
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
                        disabled={loopEnabled && option.value === "pcm_48000"}
                      >
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
