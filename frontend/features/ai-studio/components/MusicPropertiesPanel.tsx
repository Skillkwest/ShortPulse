/**
 * Dedicated music workflow panel for AI Studio.
 * Keeps music composition UI isolated from generic Sound and Sound Effects panels.
 */
import React from "react";
import { resolveRequiredAudioMusicModelId } from "../../../lib/model-runtime/modelCatalog";
import type { ModelPricingPolicyDocument } from "../../../lib/model-runtime/pricingPolicy";
import { useReferenceGridHorizontalSplit } from "../hooks/useReferenceGridHorizontalSplit";
import { resolveClientBilledCredits } from "../logic/clientPricingDisplay";

export type MusicMode = "instrumental" | "vocal";
export type MusicStructure = "loop" | "full-track" | "cinematic";
export type MusicFormat = "mp3_44100_128" | "wav_48000";
export const hardcodedMusicModelId = resolveRequiredAudioMusicModelId();

export type MusicGenerateRequest = {
  text: string;
  durationSeconds: number | null;
  bpm: number;
  mode: MusicMode;
  structure: MusicStructure;
  energyPercent: number;
  outputFormat: MusicFormat;
  modelId: typeof hardcodedMusicModelId;
  displayedBilledCredits?: number | null;
};

export type MusicPropertiesPanelProps = {
  balanceCredits?: number | null;
  isGenerating?: boolean;
  onGenerate?: (request: MusicGenerateRequest) => Promise<boolean | void> | boolean | void;
  onLyricsChange?: (value: string) => void;
  onPromptChange?: (value: string) => void;
  pricingPolicy?: ModelPricingPolicyDocument | null;
  pricingPolicyReady?: boolean;
  lyrics?: string;
  prompt?: string;
};

type MusicComposerMode = "simple" | "custom";
type MusicSongBatchCount = 1 | 2 | 3 | 4;
type MusicInspirationEntry = {
  label: string;
  prompt: string;
};

const musicPromptPlaceholder =
  "Describe the song you want to generate: genre, pacing, instrumentation, vocal style, and where the cue should land in the edit.";
const customMusicPromptPlaceholder =
  "Describe the song style, production direction, instrumentation, vocal feel, and emotional arc.";
const lyricsPromptPlaceholder =
  "Write lyrics, hooks, section ideas, ad-libs, or line-by-line structure here.";
const customLyricsBudgetNote = "Prompt and lyrics share one 2,000-character generation budget.";
const maxPromptCharacters = 2000;
const minTopToggleHeightPx = 96;
const minBottomComposerHeightPx = 420;
const defaultMusicBpm = 112;
const defaultMusicEnergyPercent = 58;
const defaultMusicMode: MusicMode = "instrumental";
const defaultMusicStructure: MusicStructure = "loop";
const defaultMusicFormat: MusicFormat = "mp3_44100_128";
const musicInspirationEntries = [
  {
    label: "indie folk",
    prompt:
      "Warm indie folk cue with intimate acoustic guitar, brushed percussion, soft handclaps, earthy bass, and a reflective cinematic build that feels human, hopeful, and organic.",
  },
  {
    label: "riddim",
    prompt:
      "Heavy riddim drop with aggressive bass growls, sharp syncopation, stripped-down tension builds, festival-scale energy, and a dark modern sound design focus built for impact.",
  },
  {
    label: "dub techno",
    prompt:
      "Deep dub techno atmosphere with pulsing sub bass, hazy chords, spacious delay, minimal percussion, and a hypnotic late-night groove that feels immersive and restrained.",
  },
  {
    label: "trip hop",
    prompt:
      "Moody trip hop track with dusty drums, smoky bass, melancholic textures, subtle vocal ambience, and a slow confident groove that feels noir, stylish, and cinematic.",
  },
  {
    label: "west coast rap",
    prompt:
      "West coast rap production with laid-back swing, warm synth leads, deep cruising bass, crisp drums, and a sun-faded confident energy that feels smooth, expensive, and cool.",
  },
  {
    label: "drum and bass",
    prompt:
      "High-energy drum and bass cue with rapid breakbeats, driving sub bass, sharp transitions, futuristic textures, and a clean adrenaline-forward momentum built for motion.",
  },
] satisfies readonly MusicInspirationEntry[];

const buildMusicSubmissionText = ({
  composerMode,
  lyrics,
  prompt,
}: {
  composerMode: MusicComposerMode;
  lyrics: string;
  prompt: string;
}): string => {
  const basePrompt = prompt.trim();
  if (!basePrompt) return "";
  if (composerMode !== "custom") return basePrompt;
  const lyricSheet = lyrics.trim();
  if (!lyricSheet) return basePrompt;
  return `${basePrompt}\n\nLyrics:\n${lyricSheet}`;
};

const shuffleChipOrder = <T,>(chips: readonly T[]): T[] => {
  const next = [...chips];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex]!, next[index]!];
  }
  return next;
};
const inspirationScrollStepPx = 280;
const songBatchCountOptions: MusicSongBatchCount[] = [1, 2, 3, 4];
const formatCreditValue = (value: number): string =>
  Number.isInteger(value) ? String(value) : value.toFixed(1);

export const MusicPropertiesPanel = React.memo(function MusicPropertiesPanel({
  balanceCredits: _balanceCredits = null,
  isGenerating = false,
  onGenerate,
  onLyricsChange,
  onPromptChange,
  pricingPolicy = null,
  pricingPolicyReady = true,
  lyrics: controlledLyrics,
  prompt: controlledPrompt,
}: MusicPropertiesPanelProps) {
  void _balanceCredits;
  const splitContainerRef = React.useRef<HTMLDivElement | null>(null);
  const inspirationScrollerRef = React.useRef<HTMLDivElement | null>(null);
  const inspirationDragPointerIdRef = React.useRef<number | null>(null);
  const inspirationDragStartXRef = React.useRef(0);
  const inspirationDragStartScrollLeftRef = React.useRef(0);
  const inspirationDidDragRef = React.useRef(false);
  const suppressChipClickRef = React.useRef(false);
  const songBatchMenuRef = React.useRef<HTMLDivElement | null>(null);
  const [uncontrolledPrompt, setUncontrolledPrompt] = React.useState("");
  const [uncontrolledLyrics, setUncontrolledLyrics] = React.useState("");
  const [composerMode, setComposerMode] = React.useState<MusicComposerMode>("simple");
  const [singerEnabled, setSingerEnabled] = React.useState(false);
  const [songBatchCount, setSongBatchCount] = React.useState<MusicSongBatchCount>(2);
  const [isSongBatchMenuOpen, setIsSongBatchMenuOpen] = React.useState(false);
  const [isDraggingInspiration, setIsDraggingInspiration] = React.useState(false);
  const [inspirationInsertError, setInspirationInsertError] = React.useState<string | null>(null);
  const [inspirationScrollState, setInspirationScrollState] = React.useState({
    canScrollBack: false,
    canScrollForward: false,
  });
  const prompt = controlledPrompt ?? uncontrolledPrompt;
  const lyrics = controlledLyrics ?? uncontrolledLyrics;
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
  const setLyrics = React.useCallback(
    (action: React.SetStateAction<string>) => {
      const nextLyrics = resolveTextAction(lyrics, action).slice(0, maxPromptCharacters);
      setInspirationInsertError(null);
      if (onLyricsChange) {
        onLyricsChange(nextLyrics);
        return;
      }
      setUncontrolledLyrics(nextLyrics);
    },
    [lyrics, onLyricsChange, resolveTextAction]
  );
  const inspirationChips = React.useMemo(() => shuffleChipOrder(musicInspirationEntries), []);
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

  const estimatedCreditsPerSong =
    resolveClientBilledCredits({
      modelId: hardcodedMusicModelId,
      params: {
        durationSeconds: null,
      },
      pricingPolicy,
      pricingPolicyReady,
    }) ?? null;
  const estimatedCredits =
    estimatedCreditsPerSong != null ? estimatedCreditsPerSong * songBatchCount : null;
  const promptPlaceholder =
    composerMode === "simple" ? musicPromptPlaceholder : customMusicPromptPlaceholder;
  const buildSubmissionText = React.useCallback(
    (): string =>
      buildMusicSubmissionText({
        composerMode,
        lyrics,
        prompt,
      }),
    [composerMode, lyrics, prompt]
  );
  const submissionText = buildSubmissionText();
  const hasLyrics = composerMode === "custom" && lyrics.trim().length > 0;
  const requestedMusicMode: MusicMode = singerEnabled || hasLyrics ? "vocal" : defaultMusicMode;
  const submissionLength = submissionText.length;
  const overflowCharacterCount = Math.max(0, submissionLength - maxPromptCharacters);
  const displayedCharacterCount = composerMode === "custom" ? submissionLength : prompt.length;
  const isWithinPromptLimit = submissionLength <= maxPromptCharacters;
  const isGenerateEnabled = Boolean(onGenerate) && submissionLength > 0 && isWithinPromptLimit;

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

  React.useEffect(() => {
    setInspirationInsertError(null);
  }, [composerMode, lyrics, prompt]);

  React.useEffect(() => {
    if (!isSongBatchMenuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!songBatchMenuRef.current?.contains(event.target as Node)) {
        setIsSongBatchMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", handlePointerDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isSongBatchMenuOpen]);

  const handleInspirationClick = React.useCallback(
    (chip: MusicInspirationEntry) => {
      if (suppressChipClickRef.current) return;
      const trimmedPrompt = prompt.trim();
      const nextPrompt = trimmedPrompt ? `${trimmedPrompt}\n\n${chip.prompt}` : chip.prompt;
      const nextSubmissionText = buildMusicSubmissionText({
        composerMode,
        lyrics,
        prompt: nextPrompt,
      });
      const canInsertPrompt =
        nextPrompt.length <= maxPromptCharacters &&
        nextSubmissionText.length <= maxPromptCharacters;

      if (!canInsertPrompt) {
        setInspirationInsertError(
          composerMode === "custom"
            ? "This inspiration will not fit. Shorten the prompt or lyrics and try again."
            : "This inspiration will not fit. Shorten the prompt and try again."
        );
        return;
      }

      setPrompt(nextPrompt);
    },
    [composerMode, lyrics, prompt, setPrompt]
  );

  const handleInspirationChipPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      event.stopPropagation();
    },
    []
  );

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
      suppressChipClickRef.current = false;
      setIsDraggingInspiration(false);
      node.setPointerCapture?.(event.pointerId);
    },
    []
  );

  const handleInspirationPointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
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

  const handleGenerate = React.useCallback(() => {
    if (!onGenerate || !submissionText || !isWithinPromptLimit) return;
    const request = {
      text: submissionText,
      durationSeconds: null,
      bpm: defaultMusicBpm,
      mode: requestedMusicMode,
      structure: defaultMusicStructure,
      energyPercent: defaultMusicEnergyPercent,
      outputFormat: defaultMusicFormat,
      modelId: hardcodedMusicModelId,
      displayedBilledCredits: estimatedCreditsPerSong,
    } satisfies MusicGenerateRequest;

    void Promise.allSettled(Array.from({ length: songBatchCount }, () => onGenerate(request)));
  }, [
    estimatedCreditsPerSong,
    requestedMusicMode,
    isWithinPromptLimit,
    onGenerate,
    songBatchCount,
    submissionText,
  ]);

  const renderInspirationRail = (variant: "standard" | "embedded" = "standard") => (
    <section
      className={`music-properties-inspiration music-properties-inspiration--${variant}`}
      aria-label="Music inspiration"
    >
      <div className="music-properties-inspiration-header">
        <p className="music-properties-inspiration-label">Inspiration</p>
        <p className="music-properties-script-count" aria-live="polite">
          {`${displayedCharacterCount.toLocaleString()} / ${maxPromptCharacters.toLocaleString()}`}
        </p>
      </div>
      {inspirationInsertError ? (
        <p className="music-properties-inspiration-error" role="alert">
          {inspirationInsertError}
        </p>
      ) : null}
      <div className="music-properties-inspiration-rail">
        <div
          ref={inspirationScrollerRef}
          className={`music-properties-inspiration-chips ${isDraggingInspiration ? "is-dragging" : ""}`}
          onScroll={syncInspirationScrollState}
          onPointerDown={handleInspirationPointerDown}
          onPointerMove={handleInspirationPointerMove}
          onPointerUp={handleInspirationPointerUp}
          onPointerCancel={endInspirationDrag}
        >
          {inspirationChips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              className="music-properties-inspiration-chip"
              onPointerDown={handleInspirationChipPointerDown}
              onClick={() => handleInspirationClick(chip)}
            >
              {chip.label}
            </button>
          ))}
        </div>
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
            className={`music-properties-topbar ${
              isStandardMode
                ? "music-properties-topbar--standard"
                : "music-properties-topbar--custom"
            }`}
            style={isStandardMode ? topSectionStyle : undefined}
            aria-label="Music composition mode"
          >
            <h2 className="panel-title music-properties-title">Music</h2>

            <div className="music-properties-topbar-center">
              <div className="music-properties-toggle-shell">
                <span className="music-properties-toggle-label">Music Mode</span>
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
                  <div className="music-properties-script-input-shell music-properties-script-input-shell--with-inspiration">
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
                    <div
                      className="music-properties-script-input-shell-divider"
                      aria-hidden="true"
                    />
                    {renderInspirationRail("embedded")}
                  </div>
                </>
              ) : (
                <section
                  className="music-properties-custom-surface"
                  aria-label="Custom music composer"
                >
                  <div className="music-properties-custom-pane music-properties-custom-pane--prompt">
                    <p className="music-properties-custom-pane-title">Song style and vibe</p>
                    <div className="music-properties-script-input-shell music-properties-script-input-shell--custom-prompt">
                      <textarea
                        className="music-properties-script-input music-properties-script-input--custom-prompt"
                        value={prompt}
                        onChange={(event) =>
                          setPrompt(event.target.value.slice(0, maxPromptCharacters))
                        }
                        maxLength={maxPromptCharacters}
                        placeholder={customMusicPromptPlaceholder}
                        aria-label="Music prompt"
                      />
                      <div
                        className="music-properties-script-input-shell-divider"
                        aria-hidden="true"
                      />
                      {renderInspirationRail("embedded")}
                    </div>
                  </div>
                  <div className="music-properties-custom-pane music-properties-custom-pane--lyrics">
                    <div className="music-properties-custom-pane-heading">
                      <p className="music-properties-custom-pane-title">Lyrics</p>
                      <p className="music-properties-custom-pane-note">{customLyricsBudgetNote}</p>
                      {!isWithinPromptLimit ? (
                        <p className="music-properties-custom-pane-error" role="alert">
                          Shorten the prompt or lyrics by {overflowCharacterCount.toLocaleString()}{" "}
                          {overflowCharacterCount === 1 ? "character" : "characters"}.
                        </p>
                      ) : null}
                    </div>
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
              <div className="music-properties-script-actions-right">
                <div className="music-properties-script-actions-top">
                  <div
                    className="music-properties-custom-footer-controls"
                    aria-label="Music defaults"
                  >
                    {composerMode === "custom" ? (
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
                        <span
                          className={`music-properties-singer-switch-control audio-toggle ${
                            singerEnabled ? "is-active" : ""
                          }`}
                          aria-hidden="true"
                        >
                          <span className="audio-toggle-track">
                            <span className="music-properties-singer-switch-thumb audio-toggle-dot" />
                          </span>
                        </span>
                      </button>
                    ) : null}
                    <div
                      ref={songBatchMenuRef}
                      className={`music-properties-footer-dropdown ${
                        isSongBatchMenuOpen ? "is-open" : ""
                      }`}
                    >
                      <button
                        type="button"
                        className="music-properties-footer-pill music-properties-footer-pill--dropdown"
                        aria-haspopup="menu"
                        aria-expanded={isSongBatchMenuOpen}
                        aria-label="Songs per generate"
                        title="How many songs to generate in this run."
                        onClick={() => setIsSongBatchMenuOpen((current) => !current)}
                      >
                        <span className="music-properties-footer-pill-icon" aria-hidden="true">
                          <svg viewBox="0 0 24 24" focusable="false">
                            <path d="M12 2.5 3.5 7 12 11.5 20.5 7 12 2.5Z" />
                            <path d="M3.5 12 12 16.5 20.5 12" />
                            <path d="M3.5 17 12 21.5 20.5 17" />
                          </svg>
                        </span>
                        <span className="music-properties-footer-pill-value">{songBatchCount}</span>
                      </button>
                      {isSongBatchMenuOpen ? (
                        <div className="music-properties-footer-dropdown-menu" role="menu">
                          {songBatchCountOptions.map((option) => (
                            <button
                              key={option}
                              type="button"
                              role="menuitemradio"
                              aria-checked={songBatchCount === option}
                              className={`music-properties-footer-dropdown-option ${
                                songBatchCount === option ? "is-active" : ""
                              }`}
                              onClick={() => {
                                setSongBatchCount(option);
                                setIsSongBatchMenuOpen(false);
                              }}
                            >
                              {option} {option === 1 ? "song" : "songs"}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <span
                      className="music-properties-footer-pill music-properties-footer-pill--static"
                      aria-label="Duration auto"
                      role="note"
                      title="Auto duration is chosen by the music model."
                    >
                      <span className="music-properties-footer-pill-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" focusable="false">
                          <circle cx="12" cy="12" r="8.5" />
                          <path d="M12 7v5l3 2" />
                        </svg>
                      </span>
                      <span className="music-properties-footer-pill-value">Auto</span>
                    </span>
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
                        {estimatedCredits != null ? formatCreditValue(estimatedCredits) : "—"}
                      </span>
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});
