/**
 * Dedicated music workflow panel for AI Studio.
 * Keeps music composition UI isolated from generic Sound and Sound Effects panels.
 */
import React from "react";
import { ELEVENLABS_MUSIC_MODEL_ID } from "../../../lib/model-runtime/elevenLabsModels";
import { computeCostForModel } from "../../../lib/model-runtime/pricing";
import type { ModelPricingPolicyDocument } from "../../../lib/model-runtime/pricingPolicy";
import { useReferenceGridHorizontalSplit } from "../hooks/useReferenceGridHorizontalSplit";

export type MusicMode = "instrumental" | "vocal";
export type MusicStructure = "loop" | "full-track" | "cinematic";
export type MusicFormat = "mp3_44100_128" | "wav_48000";
export const hardcodedMusicModelId = ELEVENLABS_MUSIC_MODEL_ID;

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
  balanceCredits?: number | null;
  isGenerating?: boolean;
  onGenerate?: (request: MusicGenerateRequest) => Promise<void> | void;
  pricingPolicy?: ModelPricingPolicyDocument | null;
};

type MusicComposerMode = "simple" | "custom";

const musicPromptPlaceholder =
  "Describe the song you want to generate: genre, pacing, instrumentation, vocal style, and where the cue should land in the edit.";
const customMusicPromptPlaceholder =
  "Describe the song style, production direction, instrumentation, vocal feel, and emotional arc.";
const lyricsPromptPlaceholder =
  "Write lyrics, hooks, section ideas, ad-libs, or line-by-line structure here.";
const maxPromptCharacters = 800;
const minTopToggleHeightPx = 96;
const minBottomComposerHeightPx = 420;
const defaultMusicDurationSeconds = 30;
const defaultMusicBpm = 112;
const defaultMusicEnergyPercent = 58;
const defaultMusicMode: MusicMode = "instrumental";
const defaultMusicStructure: MusicStructure = "loop";
const defaultMusicFormat: MusicFormat = "mp3_44100_128";
const musicInspirationChips = [
  "passionate vocals",
  "gabber",
  "afro dance",
  "boastful",
  "electro techno",
  "crooner",
  "rich orchestra",
  "lofi hip hop",
  "uk garage",
  "drum and bass",
  "deep house",
  "cinematic trailer",
  "synthwave",
  "hyperpop",
  "reggaeton",
  "ambient drone",
  "jazz noir",
  "brazilian funk",
  "trance anthem",
  "indie folk",
  "trap soul",
  "neo soul",
  "phonk",
  "detroit techno",
  "afrobeats",
  "melodic house",
  "punk energy",
  "disco strings",
  "latin pop",
  "orchestral tension",
  "dream pop",
  "club banger",
  "acoustic ballad",
  "festival edm",
  "western twang",
] as const;
const inspirationScrollStepPx = 280;
const formatCreditValue = (value: number): string =>
  Number.isInteger(value) ? String(value) : value.toFixed(1);

export const MusicPropertiesPanel = React.memo(function MusicPropertiesPanel({
  balanceCredits = null,
  isGenerating = false,
  onGenerate,
  pricingPolicy = null,
}: MusicPropertiesPanelProps) {
  const splitContainerRef = React.useRef<HTMLDivElement | null>(null);
  const customSplitContainerRef = React.useRef<HTMLDivElement | null>(null);
  const inspirationScrollerRef = React.useRef<HTMLDivElement | null>(null);
  const inspirationDragPointerIdRef = React.useRef<number | null>(null);
  const inspirationDragStartXRef = React.useRef(0);
  const inspirationDragStartScrollLeftRef = React.useRef(0);
  const inspirationDidDragRef = React.useRef(false);
  const suppressChipClickRef = React.useRef(false);
  const [prompt, setPrompt] = React.useState("");
  const [lyrics, setLyrics] = React.useState("");
  const [composerMode, setComposerMode] = React.useState<MusicComposerMode>("simple");
  const [singerEnabled, setSingerEnabled] = React.useState(false);
  const [isDraggingInspiration, setIsDraggingInspiration] = React.useState(false);
  const [inspirationScrollState, setInspirationScrollState] = React.useState({
    canScrollBack: false,
    canScrollForward: false,
  });
  const composerModeToggleStyle = React.useMemo(
    () =>
      ({
        ["--music-composer-mode-index" as string]: composerMode === "custom" ? 1 : 0,
      }) as React.CSSProperties,
    [composerMode]
  );
  const isStandardMode = composerMode === "simple";

  const { topSectionStyle, bottomSectionStyle, dividerProps } = useReferenceGridHorizontalSplit({
    enabled: isStandardMode,
    containerRef: splitContainerRef,
    defaultTopRatio: 0.16,
    minTopSectionHeightPx: minTopToggleHeightPx,
    minBottomSectionHeightPx: minBottomComposerHeightPx,
    ariaLabel: "Resize music mode and composition sections",
  });
  const {
    topSectionStyle: customTopSectionStyle,
    bottomSectionStyle: customBottomSectionStyle,
    dividerProps: customDividerProps,
  } = useReferenceGridHorizontalSplit({
    enabled: !isStandardMode,
    containerRef: customSplitContainerRef,
    defaultTopRatio: 0.58,
    minTopSectionHeightPx: 300,
    minBottomSectionHeightPx: 188,
    ariaLabel: "Resize song style and lyrics sections",
  });

  const estimatedCredits =
    computeCostForModel(
      hardcodedMusicModelId,
      {
        durationSeconds: defaultMusicDurationSeconds,
      },
      pricingPolicy
    )?.credits ?? null;
  const isInsufficientCredits =
    balanceCredits != null && estimatedCredits != null ? balanceCredits < estimatedCredits : false;
  const isGenerateEnabled =
    Boolean(onGenerate) && prompt.trim().length > 0 && !isInsufficientCredits && !isGenerating;
  const promptPlaceholder =
    composerMode === "simple" ? musicPromptPlaceholder : customMusicPromptPlaceholder;

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
  }, [composerMode, syncInspirationScrollState]);

  const handleInspirationClick = React.useCallback((chip: string) => {
    if (suppressChipClickRef.current) return;
    setPrompt((current) => {
      const trimmed = current.trim();
      const nextPrompt = trimmed ? `${trimmed}, ${chip}` : chip;
      return nextPrompt.slice(0, maxPromptCharacters);
    });
  }, []);

  const scrollInspirationRail = React.useCallback(
    (direction: "backward" | "forward") => {
      const node = inspirationScrollerRef.current;
      if (!node) return;
      const nextLeft =
        node.scrollLeft +
        (direction === "forward" ? inspirationScrollStepPx : -inspirationScrollStepPx);
      if (typeof node.scrollTo === "function") {
        node.scrollTo({
          left: nextLeft,
          behavior: "smooth",
        });
      } else {
        node.scrollLeft = nextLeft;
      }
      window.requestAnimationFrame(() => {
        syncInspirationScrollState();
      });
    },
    [syncInspirationScrollState]
  );

  const endInspirationDrag = React.useCallback(() => {
    inspirationDragPointerIdRef.current = null;
    setIsDraggingInspiration(false);
    if (inspirationDidDragRef.current) {
      suppressChipClickRef.current = true;
      window.setTimeout(() => {
        suppressChipClickRef.current = false;
      }, 0);
    }
    inspirationDidDragRef.current = false;
    syncInspirationScrollState();
  }, [syncInspirationScrollState]);

  const handleInspirationPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const node = inspirationScrollerRef.current;
      if (!node) return;
      inspirationDragPointerIdRef.current = event.pointerId;
      inspirationDragStartXRef.current = event.clientX;
      inspirationDragStartScrollLeftRef.current = node.scrollLeft;
      inspirationDidDragRef.current = false;
      setIsDraggingInspiration(true);
      node.setPointerCapture?.(event.pointerId);
    },
    []
  );

  const handleInspirationPointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const node = inspirationScrollerRef.current;
      if (!node || inspirationDragPointerIdRef.current !== event.pointerId) return;
      const deltaX = event.clientX - inspirationDragStartXRef.current;
      if (Math.abs(deltaX) > 4) {
        inspirationDidDragRef.current = true;
      }
      node.scrollLeft = inspirationDragStartScrollLeftRef.current - deltaX;
      syncInspirationScrollState();
    },
    [syncInspirationScrollState]
  );

  const handleInspirationPointerUp = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const node = inspirationScrollerRef.current;
      if (inspirationDragPointerIdRef.current !== event.pointerId) return;
      node?.releasePointerCapture?.(event.pointerId);
      endInspirationDrag();
    },
    [endInspirationDrag]
  );

  const handleGenerate = React.useCallback(async () => {
    const text = prompt.trim();
    if (!onGenerate || !text || isGenerating) return;
    await onGenerate({
      text,
      durationSeconds: defaultMusicDurationSeconds,
      bpm: defaultMusicBpm,
      mode: singerEnabled ? "vocal" : defaultMusicMode,
      structure: defaultMusicStructure,
      energyPercent: defaultMusicEnergyPercent,
      outputFormat: defaultMusicFormat,
      modelId: hardcodedMusicModelId,
    });
  }, [isGenerating, onGenerate, prompt, singerEnabled]);

  const inspirationRail = (
    <section className="music-properties-inspiration" aria-label="Music inspiration">
      <div className="music-properties-inspiration-header">
        <p className="music-properties-inspiration-label">Inspiration</p>
        <div className="music-properties-inspiration-controls">
          <button
            type="button"
            className="music-properties-inspiration-scroll-btn"
            aria-label="Scroll inspiration left"
            disabled={!inspirationScrollState.canScrollBack}
            onClick={() => scrollInspirationRail("backward")}
          >
            <span aria-hidden="true">←</span>
          </button>
          <button
            type="button"
            className="music-properties-inspiration-scroll-btn"
            aria-label="Scroll inspiration right"
            disabled={!inspirationScrollState.canScrollForward}
            onClick={() => scrollInspirationRail("forward")}
          >
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
      <div
        ref={inspirationScrollerRef}
        className={`music-properties-inspiration-chips ${isDraggingInspiration ? "is-dragging" : ""}`}
        onScroll={syncInspirationScrollState}
        onPointerDown={handleInspirationPointerDown}
        onPointerMove={handleInspirationPointerMove}
        onPointerUp={handleInspirationPointerUp}
        onPointerCancel={endInspirationDrag}
      >
        {musicInspirationChips.map((chip) => (
          <button
            key={chip}
            type="button"
            className="music-properties-inspiration-chip"
            onClick={() => handleInspirationClick(chip)}
          >
            {chip}
          </button>
        ))}
      </div>
    </section>
  );

  return (
    <section
      className="music-properties-panel tool-properties"
      aria-label="Music properties"
      aria-busy={isGenerating}
    >
      <div className="music-properties-shell">
        <div ref={splitContainerRef} className="music-properties-main">
          <section
            className="music-properties-topbar"
            style={isStandardMode ? topSectionStyle : undefined}
            aria-label="Music composition mode"
          >
            <div className="music-properties-toggle-shell">
              <div
                className="music-properties-toggle-tabs"
                role="tablist"
                aria-label="Music composition modes"
                style={composerModeToggleStyle}
              >
                <span className="music-properties-toggle-indicator" aria-hidden="true" />
                {(["simple", "custom"] as const).map((mode) => {
                  const isSelected = composerMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      role="tab"
                      aria-selected={isSelected}
                      className={`music-properties-toggle-button ${isSelected ? "is-active" : ""}`}
                      onClick={() => setComposerMode(mode)}
                    >
                      {mode === "simple" ? "Standard" : "Custom"}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {isStandardMode ? (
            <div
              className="music-properties-divider-wrap reference-grid-horizontal-divider-wrap"
              {...dividerProps}
            >
              <div
                className="music-properties-divider reference-grid-horizontal-divider"
                aria-hidden="true"
              />
            </div>
          ) : null}

          <div
            className={`music-properties-compose-area music-properties-compose-area--${composerMode}`}
            style={isStandardMode ? bottomSectionStyle : undefined}
          >
            <div
              className={`music-properties-composer-card music-properties-composer-card--${composerMode}`}
            >
              {composerMode === "simple" ? (
                <>
                  <div className="music-properties-script-input-shell">
                    <textarea
                      className="music-properties-script-input"
                      value={prompt}
                      onChange={(event) =>
                        setPrompt(event.target.value.slice(0, maxPromptCharacters))
                      }
                      maxLength={maxPromptCharacters}
                      placeholder={promptPlaceholder}
                      aria-label="Music prompt"
                    />
                  </div>
                  {inspirationRail}
                </>
              ) : (
                <section
                  ref={customSplitContainerRef}
                  className="music-properties-custom-surface"
                  aria-label="Custom music composer"
                >
                  <div
                    className="music-properties-custom-pane music-properties-custom-pane--prompt"
                    style={customTopSectionStyle}
                  >
                    <p className="music-properties-custom-pane-title">Song style and vibe</p>
                    <div className="music-properties-script-input-shell music-properties-script-input-shell--custom-prompt">
                      <textarea
                        className="music-properties-script-input"
                        value={prompt}
                        onChange={(event) =>
                          setPrompt(event.target.value.slice(0, maxPromptCharacters))
                        }
                        maxLength={maxPromptCharacters}
                        placeholder={customMusicPromptPlaceholder}
                        aria-label="Music prompt"
                      />
                    </div>
                    {inspirationRail}
                  </div>
                  <div className="music-properties-custom-divider-wrap" {...customDividerProps}>
                    <div className="music-properties-custom-divider" aria-hidden="true" />
                  </div>
                  <div
                    className="music-properties-custom-pane music-properties-custom-pane--lyrics"
                    style={customBottomSectionStyle}
                  >
                    <p className="music-properties-custom-pane-title">Lyrics</p>
                    <div className="music-properties-script-input-shell music-properties-script-input-shell--custom-lyrics">
                      <textarea
                        className="music-properties-script-input music-properties-script-input--lyrics"
                        value={lyrics}
                        onChange={(event) =>
                          setLyrics(event.target.value.slice(0, maxPromptCharacters))
                        }
                        maxLength={maxPromptCharacters}
                        placeholder={lyricsPromptPlaceholder}
                        aria-label="Song lyrics"
                      />
                    </div>
                  </div>
                </section>
              )}
            </div>

            <div className="music-properties-script-divider" aria-hidden="true" />

            <div className="music-properties-script-actions">
              <div className="music-properties-script-meta">
                <p className="music-properties-script-count" aria-live="polite">
                  {`${prompt.length.toLocaleString()} / ${maxPromptCharacters.toLocaleString()}`}
                </p>
                {composerMode === "custom" ? (
                  <div
                    className="music-properties-custom-footer-controls"
                    aria-label="Music defaults"
                  >
                    <button
                      type="button"
                      role="switch"
                      aria-checked={singerEnabled}
                      aria-label="Singer"
                      className={`music-properties-singer-switch ${
                        singerEnabled ? "is-active" : ""
                      }`}
                      onClick={() => setSingerEnabled((current) => !current)}
                    >
                      <span className="music-properties-singer-switch-label">Singer</span>
                      <span className="music-properties-singer-switch-control" aria-hidden="true">
                        <span className="music-properties-singer-switch-thumb" />
                      </span>
                    </button>
                    <span className="music-properties-action-pill tts-properties-toggle-pill">
                      MP3
                    </span>
                    <span className="music-properties-action-pill tts-properties-toggle-pill">
                      Auto
                    </span>
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                className="music-properties-generate-btn"
                disabled={!isGenerateEnabled}
                aria-label={isGenerating ? "Generating music" : "Generate music"}
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
                    {formatCreditValue(estimatedCredits ?? 0)}
                  </span>
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});
