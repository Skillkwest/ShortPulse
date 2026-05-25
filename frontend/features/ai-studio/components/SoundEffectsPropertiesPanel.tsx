/**
 * Dedicated Sound Effects properties panel for AI Studio.
 * Mirrors the simplified single-surface music composer while keeping SFX request shaping isolated.
 */
import React from "react";
import { resolveRequiredAudioSoundEffectsModelId } from "../../../lib/model-runtime/modelCatalog";
import type { ModelPricingPolicyDocument } from "../../../lib/model-runtime/pricingPolicy";
import { useReferenceGridHorizontalSplit } from "../hooks/useReferenceGridHorizontalSplit";
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
  onPromptChange?: (value: string) => void;
  pricingPolicy?: ModelPricingPolicyDocument | null;
  pricingPolicyReady?: boolean;
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
  isGenerating = false,
  onGenerate,
  onPromptChange,
  pricingPolicy = null,
  pricingPolicyReady = true,
  prompt: controlledPrompt,
}: SoundEffectsPropertiesPanelProps) {
  void _balanceCredits;
  const splitContainerRef = React.useRef<HTMLDivElement | null>(null);
  const inspirationScrollerRef = React.useRef<HTMLDivElement | null>(null);
  const inspirationDragPointerIdRef = React.useRef<number | null>(null);
  const inspirationDragStartXRef = React.useRef(0);
  const inspirationDragStartScrollLeftRef = React.useRef(0);
  const inspirationDidDragRef = React.useRef(false);
  const suppressChipClickRef = React.useRef(false);
  const [uncontrolledPrompt, setUncontrolledPrompt] = React.useState("");
  const [loopEnabled, setLoopEnabled] = React.useState(false);
  const [isDraggingInspiration, setIsDraggingInspiration] = React.useState(false);
  const [inspirationInsertError, setInspirationInsertError] = React.useState<string | null>(null);
  const [inspirationScrollState, setInspirationScrollState] = React.useState({
    canScrollBack: false,
    canScrollForward: false,
  });
  const prompt = controlledPrompt ?? uncontrolledPrompt;
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

  React.useEffect(() => {
    setInspirationInsertError(null);
  }, [prompt]);

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
  const isGenerateEnabled = Boolean(onGenerate) && prompt.trim().length > 0;
  const { topSectionStyle, bottomSectionStyle, dividerProps } = useReferenceGridHorizontalSplit({
    enabled: true,
    containerRef: splitContainerRef,
    defaultTopRatio: 0.16,
    minTopSectionHeightPx: minTopSpacerHeightPx,
    minBottomSectionHeightPx: minBottomComposerHeightPx,
    ariaLabel: "Resize sound effects spacer and composition sections",
  });

  const syncInspirationScrollState = React.useCallback(() => {
    const node = inspirationScrollerRef.current;
    if (!node) {
      setInspirationScrollState({
        canScrollBack: false,
        canScrollForward: false,
      });
      return;
    }
    const maxScrollLeft = Math.max(0, node.scrollWidth - node.clientWidth);
    setInspirationScrollState({
      canScrollBack: node.scrollLeft > 4,
      canScrollForward: node.scrollLeft < maxScrollLeft - 4,
    });
  }, []);

  React.useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      syncInspirationScrollState();
    });
    const handleResize = () => {
      syncInspirationScrollState();
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleResize);
    };
  }, [syncInspirationScrollState]);

  const scrollInspirationBy = React.useCallback(
    (offset: number) => {
      const node = inspirationScrollerRef.current;
      if (!node) return;
      node.scrollBy({
        left: offset,
        behavior: "smooth",
      });
      window.setTimeout(syncInspirationScrollState, 180);
    },
    [syncInspirationScrollState]
  );

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
      if (suppressChipClickRef.current) {
        suppressChipClickRef.current = false;
        return;
      }
      appendInspirationChip(chip);
    },
    [appendInspirationChip]
  );

  const handleInspirationChipPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      event.stopPropagation();
    },
    []
  );

  const handleInspirationPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isGenerating) return;
      const node = inspirationScrollerRef.current;
      if (!node) return;
      inspirationDragPointerIdRef.current = event.pointerId;
      inspirationDragStartXRef.current = event.clientX;
      inspirationDragStartScrollLeftRef.current = node.scrollLeft;
      inspirationDidDragRef.current = false;
      suppressChipClickRef.current = false;
      setIsDraggingInspiration(false);
      node.setPointerCapture(event.pointerId);
    },
    [isGenerating]
  );

  const handleInspirationPointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isGenerating) return;
      const node = inspirationScrollerRef.current;
      if (!node || inspirationDragPointerIdRef.current !== event.pointerId) return;
      const deltaX = event.clientX - inspirationDragStartXRef.current;
      if (!inspirationDidDragRef.current && Math.abs(deltaX) > 4) {
        inspirationDidDragRef.current = true;
        suppressChipClickRef.current = true;
        setIsDraggingInspiration(true);
      }
      if (!inspirationDidDragRef.current) return;
      node.scrollLeft = inspirationDragStartScrollLeftRef.current - deltaX;
      syncInspirationScrollState();
    },
    [isGenerating, syncInspirationScrollState]
  );

  const endInspirationDrag = React.useCallback(
    (pointerId?: number) => {
      const node = inspirationScrollerRef.current;
      if (node && pointerId != null && node.hasPointerCapture?.(pointerId)) {
        node.releasePointerCapture(pointerId);
      }
      inspirationDragPointerIdRef.current = null;
      window.setTimeout(() => {
        suppressChipClickRef.current = false;
      }, 0);
      inspirationDidDragRef.current = false;
      setIsDraggingInspiration(false);
      syncInspirationScrollState();
    },
    [syncInspirationScrollState]
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
    });
  }, [durationSeconds, generateCost, loopEnabled, onGenerate, prompt]);

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
                readOnly={isGenerating}
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
                  <p className="sound-effects-properties-inspiration-error" role="alert">
                    {inspirationInsertError}
                  </p>
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
                    onPointerUp={(event) => endInspirationDrag(event.pointerId)}
                    onPointerCancel={(event) => endInspirationDrag(event.pointerId)}
                  >
                    {soundEffectInspirationEntries.map((chip) => (
                      <button
                        key={chip.label}
                        type="button"
                        className="sound-effects-properties-inspiration-chip"
                        disabled={isGenerating}
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
                      onClick={() => scrollInspirationBy(-inspirationScrollStepPx)}
                      disabled={isGenerating || !inspirationScrollState.canScrollBack}
                      aria-label="Scroll inspiration left"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      className="sound-effects-properties-inspiration-arrow"
                      onClick={() => scrollInspirationBy(inspirationScrollStepPx)}
                      disabled={isGenerating || !inspirationScrollState.canScrollForward}
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
                    disabled={isGenerating}
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
