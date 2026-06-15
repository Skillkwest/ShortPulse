/**
 * Dedicated Sound Effects properties panel for AI Studio.
 * Mirrors the simplified single-surface music composer while keeping SFX request shaping isolated.
 */
import React from "react";
import { AppMessage } from "../../../components/AppMessage";
import { ELEVENLABS_SOUND_EFFECT_DURATION_OPTIONS } from "../../../lib/model-runtime/elevenLabsAudioDurations";
import { resolveRequiredAudioSoundEffectsModelId } from "../../../lib/model-runtime/modelCatalog";
import { resolvePricingGridBilledCredits } from "../../../lib/model-runtime/pricingGridBilledCredits";
import type { ModelPricingPolicyDocument } from "../../../lib/model-runtime/pricingPolicy";
import { useAudioInspirationRail } from "../hooks/useAudioInspirationRail";
import { useReferenceGridHorizontalSplit } from "../hooks/useReferenceGridHorizontalSplit";

export type SoundEffectFormat = "mp3_44100_128" | "pcm_48000";
export const hardcodedSoundEffectsModelId = resolveRequiredAudioSoundEffectsModelId();

export type SoundEffectsGenerateRequest = {
  text: string;
  durationSeconds: number | null;
  loop: boolean;
  outputFormat: SoundEffectFormat;
  modelId: typeof hardcodedSoundEffectsModelId;
  displayedBilledCredits?: number | null;
  pricingPolicyReady?: boolean;
};

export type SoundEffectsPropertiesPanelProps = {
  balanceCredits?: number | null;
  durationSeconds?: number | null;
  isGenerating?: boolean;
  onDurationChange?: (value: number | null) => void;
  onGenerate?: (request: SoundEffectsGenerateRequest) => Promise<void> | void;
  onLoopEnabledChange?: (value: boolean) => void;
  onPromptChange?: (value: string) => void;
  pricingPolicy?: ModelPricingPolicyDocument | null;
  pricingPolicyReady?: boolean;
  loopEnabled?: boolean;
  prompt?: string;
};
type SoundEffectInspirationEntry = {
  label: string;
  prompt: string;
};

const soundEffectPromptPlaceholder =
  "Describe the sound effect you want to generate with detail, texture, space, and motion.";
const maxPromptCharacters = 450;
const defaultSoundEffectsFormat: SoundEffectFormat = "mp3_44100_128";
const minTopSpacerHeightPx = 112;
const minBottomComposerHeightPx = 360;
const soundEffectInspirationEntries = [
  {
    label: "cinematic boom",
    prompt:
      "Huge cinematic boom with a deep sub impact, long trailer-style decay, and a cavernous low-end tail that feels massive and dramatic.",
  },
  {
    label: "whoosh sweep",
    prompt:
      "Fast whoosh sweep with a clean airy rise, glossy stereo motion, and a tight finish for transitions, reveals, or logo moments.",
  },
  {
    label: "thunder crack",
    prompt:
      "Sharp thunder crack with a bright initial snap, rolling storm body, and a wide atmospheric tail that feels natural and powerful.",
  },
  {
    label: "vinyl crackle",
    prompt:
      "Warm vinyl crackle bed with soft dusty texture, subtle needle noise, and an intimate lo-fi character without harsh distortion.",
  },
  {
    label: "crowd cheer",
    prompt:
      "Big crowd cheer with layered audience voices, rising excitement, and a celebratory arena feel that sounds energetic and believable.",
  },
  {
    label: "glass shatter",
    prompt:
      "Detailed glass shatter with a sharp break, scattered fragments, and a crisp sparkling debris tail that feels realistic and high impact.",
  },
] satisfies readonly SoundEffectInspirationEntry[];
const inspirationScrollStepPx = 280;

const formatCreditValue = (value: number): string => {
  const roundedValue = Number(value.toFixed(1));
  return roundedValue % 1 === 0 ? roundedValue.toFixed(0) : roundedValue.toFixed(1);
};

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="8.25" />
    <path d="M12 7.6v4.85l3.2 1.95" />
  </svg>
);

export const SoundEffectsPropertiesPanel = React.memo(function SoundEffectsPropertiesPanel({
  balanceCredits: _balanceCredits = null,
  durationSeconds: controlledDurationSeconds,
  isGenerating = false,
  onDurationChange,
  onGenerate,
  onLoopEnabledChange,
  onPromptChange,
  pricingPolicy = null,
  pricingPolicyReady = true,
  loopEnabled: controlledLoopEnabled,
  prompt: controlledPrompt,
}: SoundEffectsPropertiesPanelProps) {
  void _balanceCredits;
  const splitContainerRef = React.useRef<HTMLDivElement | null>(null);
  const durationMenuRef = React.useRef<HTMLDivElement | null>(null);
  const [uncontrolledPrompt, setUncontrolledPrompt] = React.useState("");
  const [uncontrolledLoopEnabled, setUncontrolledLoopEnabled] = React.useState(false);
  const [uncontrolledDurationSeconds, setUncontrolledDurationSeconds] = React.useState<
    number | null
  >(null);
  const [isDurationMenuOpen, setIsDurationMenuOpen] = React.useState(false);
  const [inspirationInsertError, setInspirationInsertError] = React.useState<string | null>(null);
  const prompt = controlledPrompt ?? uncontrolledPrompt;
  const loopEnabled = controlledLoopEnabled ?? uncontrolledLoopEnabled;
  const durationSeconds = controlledDurationSeconds ?? uncontrolledDurationSeconds;
  const {
    scrollerRef: inspirationScrollerRef,
    isDragging: isDraggingInspiration,
    scrollState: inspirationScrollState,
    syncScrollState: syncInspirationScrollState,
    scrollByDirection: scrollInspirationBy,
    consumeSuppressedChipClick,
    handlePointerDown: handleInspirationPointerDown,
    handlePointerMove: handleInspirationPointerMove,
    handlePointerUp: handleInspirationPointerUp,
    handlePointerCancel: handleInspirationPointerCancel,
    handleChipPointerDown: handleInspirationChipPointerDown,
  } = useAudioInspirationRail({
    scrollStepPx: inspirationScrollStepPx,
    scrollStrategy: "scrollBy",
    scrollSyncDelayMs: 180,
  });
  const resolveTextAction = React.useCallback(
    (current: string, action: React.SetStateAction<string>) =>
      typeof action === "function" ? (action as (value: string) => string)(current) : action,
    []
  );
  const setPrompt = React.useCallback(
    (action: React.SetStateAction<string>) => {
      const nextPrompt = resolveTextAction(prompt, action).slice(0, maxPromptCharacters);
      setInspirationInsertError(null);
      if (onPromptChange) {
        onPromptChange(nextPrompt);
        return;
      }
      setUncontrolledPrompt(nextPrompt);
    },
    [onPromptChange, prompt, resolveTextAction]
  );
  const setDuration = React.useCallback(
    (value: number | null) => {
      if (onDurationChange) {
        onDurationChange(value);
        return;
      }
      setUncontrolledDurationSeconds(value);
    },
    [onDurationChange]
  );
  const setLoopEnabled = React.useCallback(
    (action: React.SetStateAction<boolean>) => {
      const value =
        typeof action === "function"
          ? (action as (current: boolean) => boolean)(loopEnabled)
          : action;
      if (onLoopEnabledChange) {
        onLoopEnabledChange(value);
        return;
      }
      setUncontrolledLoopEnabled(value);
    },
    [loopEnabled, onLoopEnabledChange]
  );

  React.useEffect(() => {
    setInspirationInsertError(null);
  }, [prompt]);

  React.useEffect(() => {
    if (!isDurationMenuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!durationMenuRef.current?.contains(event.target as Node)) {
        setIsDurationMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", handlePointerDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isDurationMenuOpen]);

  const generateCost =
    (pricingPolicyReady
      ? resolvePricingGridBilledCredits({
          modelId: hardcodedSoundEffectsModelId,
          params: {
            durationSeconds,
            generationCount: 1,
          },
          pricingPolicy,
        })
      : null) ?? null;
  const isGenerateEnabled = Boolean(onGenerate) && prompt.trim().length > 0;
  const selectedDurationOption =
    ELEVENLABS_SOUND_EFFECT_DURATION_OPTIONS.find((option) => option.value === durationSeconds) ??
    ELEVENLABS_SOUND_EFFECT_DURATION_OPTIONS[0];
  const { topSectionStyle, bottomSectionStyle, dividerProps } = useReferenceGridHorizontalSplit({
    enabled: true,
    containerRef: splitContainerRef,
    defaultTopRatio: 0.16,
    minTopSectionHeightPx: minTopSpacerHeightPx,
    minBottomSectionHeightPx: minBottomComposerHeightPx,
    ariaLabel: "Resize sound effects spacer and composition sections",
  });

  const appendInspirationChip = React.useCallback(
    (chip: SoundEffectInspirationEntry) => {
      const trimmedPrompt = prompt.trim();
      const nextPrompt = trimmedPrompt ? `${trimmedPrompt}\n\n${chip.prompt}` : chip.prompt;
      if (nextPrompt.length > maxPromptCharacters) {
        setInspirationInsertError(
          "This inspiration will not fit. Shorten the prompt and try again."
        );
        return;
      }
      setPrompt(nextPrompt);
    },
    [prompt, setPrompt]
  );

  const handleInspirationChipClick = React.useCallback(
    (chip: SoundEffectInspirationEntry) => {
      if (consumeSuppressedChipClick(true)) return;
      appendInspirationChip(chip);
    },
    [appendInspirationChip, consumeSuppressedChipClick]
  );

  const handleGenerate = React.useCallback(async () => {
    const text = prompt.trim();
    if (!onGenerate || !text) return;
    await onGenerate({
      text,
      durationSeconds,
      loop: loopEnabled,
      outputFormat: defaultSoundEffectsFormat,
      modelId: hardcodedSoundEffectsModelId,
      displayedBilledCredits: generateCost,
      pricingPolicyReady,
    });
  }, [durationSeconds, generateCost, loopEnabled, onGenerate, pricingPolicyReady, prompt]);

  return (
    <section className="sound-effects-properties-panel tool-properties" aria-busy={isGenerating}>
      <div className="sound-effects-properties-shell">
        <div ref={splitContainerRef} className="sound-effects-properties-main">
          <section
            className="sound-effects-properties-top-spacer"
            style={topSectionStyle}
          ></section>

          <div
            className="sound-effects-properties-divider-wrap reference-grid-horizontal-divider-wrap"
            {...dividerProps}
          >
            <div
              className="sound-effects-properties-divider reference-grid-horizontal-divider"
              aria-hidden="true"
            />
          </div>

          <div className="sound-effects-properties-compose-area" style={bottomSectionStyle}>
            <div className="sound-effects-properties-script-input-shell sound-effects-properties-script-input-shell--with-inspiration">
              <textarea
                className="sound-effects-properties-script-input"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value.slice(0, maxPromptCharacters))}
                maxLength={maxPromptCharacters}
                placeholder={soundEffectPromptPlaceholder}
                aria-label="Sound effect prompt"
              />

              <div
                className="sound-effects-properties-script-input-shell-divider"
                aria-hidden="true"
              />

              <div className="sound-effects-properties-inspiration-rail">
                <div className="sound-effects-properties-inspiration-header">
                  <p className="sound-effects-properties-inspiration-label">Inspiration</p>
                  <p className="sound-effects-properties-script-count" aria-live="polite">
                    {`${prompt.length.toLocaleString()} / ${maxPromptCharacters.toLocaleString()}`}
                  </p>
                </div>
                {inspirationInsertError ? (
                  <AppMessage
                    className="sound-effects-properties-inspiration-error"
                    tone="error"
                    mode="inline"
                    message={inspirationInsertError}
                  />
                ) : null}

                <div className="sound-effects-properties-inspiration-track">
                  <div
                    ref={inspirationScrollerRef}
                    className={`sound-effects-properties-inspiration-scroller ${
                      isDraggingInspiration ? "is-dragging" : ""
                    }`}
                    aria-label="Sound effect inspiration"
                    onScroll={syncInspirationScrollState}
                    onPointerDown={handleInspirationPointerDown}
                    onPointerMove={handleInspirationPointerMove}
                    onPointerUp={handleInspirationPointerUp}
                    onPointerCancel={handleInspirationPointerCancel}
                  >
                    {soundEffectInspirationEntries.map((chip) => (
                      <button
                        key={chip.label}
                        type="button"
                        className="sound-effects-properties-inspiration-chip"
                        onPointerDown={handleInspirationChipPointerDown}
                        onClick={() => handleInspirationChipClick(chip)}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>

                  <div className="sound-effects-properties-inspiration-controls">
                    <button
                      type="button"
                      className="sound-effects-properties-inspiration-arrow"
                      onClick={() => scrollInspirationBy("backward")}
                      disabled={!inspirationScrollState.canScrollBack}
                      aria-label="Scroll inspiration left"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      className="sound-effects-properties-inspiration-arrow"
                      onClick={() => scrollInspirationBy("forward")}
                      disabled={!inspirationScrollState.canScrollForward}
                      aria-label="Scroll inspiration right"
                    >
                      →
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="sound-effects-properties-script-actions">
              <div className="sound-effects-properties-script-actions-left">
                <h2 className="panel-title sound-effects-properties-title">Sound Effects</h2>
              </div>
              <div className="sound-effects-properties-script-actions-right">
                <div className="sound-effects-properties-footer-controls">
                  <button
                    type="button"
                    className="sound-effects-properties-loop-switch"
                    role="switch"
                    aria-checked={loopEnabled}
                    aria-label="Loop sound effect"
                    onClick={() => setLoopEnabled((currentValue) => !currentValue)}
                  >
                    <span className="sound-effects-properties-loop-switch-label">Loop</span>
                    <span
                      className={`sound-effects-properties-loop-switch-control audio-toggle ${
                        loopEnabled ? "is-active" : ""
                      }`}
                      aria-hidden="true"
                    >
                      <span className="audio-toggle-track" />
                      <span className="audio-toggle-dot" />
                    </span>
                  </button>

                  <div
                    ref={durationMenuRef}
                    className={`sound-effects-properties-footer-dropdown ${
                      isDurationMenuOpen ? "is-open" : ""
                    }`}
                  >
                    <button
                      type="button"
                      className="sound-effects-properties-footer-pill sound-effects-properties-footer-pill--dropdown"
                      aria-haspopup="menu"
                      aria-expanded={isDurationMenuOpen}
                      aria-label="Sound effect duration"
                      title={selectedDurationOption.title}
                      onClick={() => setIsDurationMenuOpen((currentValue) => !currentValue)}
                    >
                      <span className="sound-effects-properties-footer-pill-icon">
                        <ClockIcon />
                      </span>
                      <span className="sound-effects-properties-footer-pill-value">
                        {selectedDurationOption.label}
                      </span>
                    </button>
                    {isDurationMenuOpen ? (
                      <div className="sound-effects-properties-footer-dropdown-menu" role="menu">
                        {ELEVENLABS_SOUND_EFFECT_DURATION_OPTIONS.map((option) => (
                          <button
                            key={option.value ?? "auto"}
                            type="button"
                            role="menuitemradio"
                            aria-checked={durationSeconds === option.value}
                            className={`sound-effects-properties-footer-dropdown-option ${
                              durationSeconds === option.value ? "is-active" : ""
                            }`}
                            title={option.title}
                            onClick={() => {
                              setDuration(option.value);
                              setIsDurationMenuOpen(false);
                            }}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>

                <button
                  type="button"
                  className="sound-effects-properties-generate-btn"
                  disabled={!isGenerateEnabled}
                  onClick={() => {
                    void handleGenerate();
                  }}
                  aria-label="Generate"
                >
                  <span className="sound-effects-properties-generate-label">Generate</span>
                  <span className="sound-effects-properties-generate-pill" aria-hidden="true">
                    <span className="sound-effects-properties-generate-cost-icon">✦</span>
                    <span className="sound-effects-properties-generate-cost-value">
                      {generateCost != null ? formatCreditValue(generateCost) : "—"}
                    </span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});
