/**
 * Dedicated Sound Effects properties panel for AI Studio.
 * Mirrors the simplified single-surface music composer while keeping SFX request shaping isolated.
 */
import React from "react";
import { resolveRequiredAudioSoundEffectsModelId } from "../../../lib/model-runtime/modelCatalog";
import type { ModelPricingPolicyDocument } from "../../../lib/model-runtime/pricingPolicy";
import { resolveClientBilledCredits } from "../logic/clientPricingDisplay";

export type SoundEffectFormat = "mp3_44100_128" | "pcm_48000";
export const hardcodedSoundEffectsModelId = resolveRequiredAudioSoundEffectsModelId();

export type SoundEffectsGenerateRequest = {
  text: string;
  durationSeconds: number | null;
  loop: boolean;
  outputFormat: SoundEffectFormat;
  modelId: typeof hardcodedSoundEffectsModelId;
  displayedBilledCredits?: number | null;
};

export type SoundEffectsPropertiesPanelProps = {
  balanceCredits?: number | null;
  isGenerating?: boolean;
  onGenerate?: (request: SoundEffectsGenerateRequest) => Promise<void> | void;
  pricingPolicy?: ModelPricingPolicyDocument | null;
  pricingPolicyReady?: boolean;
};

const soundEffectPromptPlaceholder =
  "Describe the sound effect you want to generate with detail, texture, space, and motion.";
const maxPromptCharacters = 450;
const defaultSoundEffectsFormat: SoundEffectFormat = "mp3_44100_128";

const formatCreditValue = (value: number): string => {
  const roundedValue = Number(value.toFixed(1));
  return roundedValue % 1 === 0 ? roundedValue.toFixed(0) : roundedValue.toFixed(1);
};

const StackIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="m12 4.25 8.15 4.6L12 13.45 3.85 8.85 12 4.25Z" />
    <path d="m3.85 14.35 8.15 4.6 8.15-4.6" />
  </svg>
);

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="8.25" />
    <path d="M12 7.6v4.85l3.2 1.95" />
  </svg>
);

export const SoundEffectsPropertiesPanel = React.memo(function SoundEffectsPropertiesPanel({
  balanceCredits = null,
  isGenerating = false,
  onGenerate,
  pricingPolicy = null,
  pricingPolicyReady = true,
}: SoundEffectsPropertiesPanelProps) {
  const [prompt, setPrompt] = React.useState("");
  const [loopEnabled, setLoopEnabled] = React.useState(false);

  const durationSeconds = null;
  const generateCost =
    resolveClientBilledCredits({
      modelId: hardcodedSoundEffectsModelId,
      params: {
        durationSeconds,
        generationCount: 1,
      },
      pricingPolicy,
      pricingPolicyReady,
    }) ?? null;
  const isInsufficientCredits =
    balanceCredits != null && generateCost != null ? balanceCredits < generateCost : false;
  const isGenerateEnabled =
    Boolean(onGenerate) && pricingPolicyReady && prompt.trim().length > 0 && !isInsufficientCredits;

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
    });
  }, [durationSeconds, generateCost, loopEnabled, onGenerate, prompt]);

  return (
    <section className="sound-effects-properties-panel tool-properties">
      <div className="sound-effects-properties-shell">
        <div className="sound-effects-properties-main">
          <div className="sound-effects-properties-compose-area">
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

            <div className="sound-effects-properties-script-actions">
              <p className="sound-effects-properties-script-count" aria-live="polite">
                {`${prompt.length.toLocaleString()} / ${maxPromptCharacters.toLocaleString()}`}
              </p>

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

                  <span className="sound-effects-properties-footer-pill sound-effects-properties-footer-pill--static">
                    <span className="sound-effects-properties-footer-pill-icon">
                      <StackIcon />
                    </span>
                    <span className="sound-effects-properties-footer-pill-value">MP3</span>
                  </span>

                  <span className="sound-effects-properties-footer-pill sound-effects-properties-footer-pill--static">
                    <span className="sound-effects-properties-footer-pill-icon">
                      <ClockIcon />
                    </span>
                    <span className="sound-effects-properties-footer-pill-value">Auto</span>
                  </span>
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
                  <span className="sound-effects-properties-generate-label">
                    {isGenerating ? "Generating..." : "Generate"}
                  </span>
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
