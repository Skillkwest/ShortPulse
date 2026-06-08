import React from "react";
import { Pause, Play } from "phosphor-react";
import {
  buildFallbackWaveformPeaks,
  extractAudioWaveformPeaksFromUrl,
  normalizeStoredWaveformPeaks,
} from "../../reference-grid/logic/referenceGridAudioWaveform";
import {
  clearExclusiveSoundPlayback,
  markExclusiveSoundPlaying,
  requestExclusiveSoundPlayback,
} from "./exclusiveSoundPlayback";
import { MediaDurationBadge } from "./MediaDurationBadge";
import type { StudioAudioSourceMode } from "../../types";

const AUDIO_WAVEFORM_BAR_COUNT = 28;
const AUDIO_SEEK_KEYBOARD_STEP_SECONDS = 5;

const clampAudioSeekRatio = (value: number): number => Math.min(1, Math.max(0, value));

export type ReferenceAudioPlayerProps = {
  audioId: string;
  audioUrl: string;
  audioInstanceKey?: string;
  backgroundImageUrl?: string | null;
  audioSourceMode?: StudioAudioSourceMode | null;
  durationMs?: number | null;
  waveformPeaks?: number[] | null;
  playLabel: string;
  pauseLabel: string;
  onActivate?: () => void;
  onReady?: () => void;
  onError?: () => void;
  eagerWaveformDecode?: boolean;
  onRequestPlay?: (player: { instanceKey: string; pause: () => void }) => void;
  onPlaybackStarted?: (player: { instanceKey: string; pause: () => void }) => void;
  onPlaybackStopped?: (instanceKey: string) => void;
};

export function ReferenceAudioPlayer({
  audioId,
  audioUrl,
  audioInstanceKey,
  backgroundImageUrl = null,
  audioSourceMode = null,
  durationMs = null,
  waveformPeaks = null,
  playLabel,
  pauseLabel,
  onActivate,
  onReady,
  onError,
  eagerWaveformDecode = true,
  onRequestPlay,
  onPlaybackStarted,
  onPlaybackStopped,
}: ReferenceAudioPlayerProps) {
  const audioNodeRef = React.useRef<HTMLAudioElement | null>(null);
  const readyNotifiedRef = React.useRef(false);
  const isWaveformSeekingRef = React.useRef(false);
  const resolvedAudioInstanceKey = audioInstanceKey ?? audioId;
  const requestPlayback = onRequestPlay ?? requestExclusiveSoundPlayback;
  const markPlaybackStarted = onPlaybackStarted ?? markExclusiveSoundPlaying;
  const clearPlayback = onPlaybackStopped ?? clearExclusiveSoundPlayback;
  const [isAudioPlaying, setIsAudioPlaying] = React.useState(false);
  const [audioProgressRatio, setAudioProgressRatio] = React.useState(0);
  const [resolvedAudioDurationMs, setResolvedAudioDurationMs] = React.useState<number | null>(
    durationMs
  );
  const storedAudioWaveformPeaks = React.useMemo(
    () => normalizeStoredWaveformPeaks(waveformPeaks, AUDIO_WAVEFORM_BAR_COUNT),
    [waveformPeaks]
  );
  const fallbackAudioWaveformBars = React.useMemo(
    () =>
      buildFallbackWaveformPeaks(
        resolvedAudioDurationMs ? resolvedAudioDurationMs / 1000 : null,
        AUDIO_WAVEFORM_BAR_COUNT
      ),
    [resolvedAudioDurationMs]
  );
  const [hasDecodedWaveform, setHasDecodedWaveform] = React.useState(
    storedAudioWaveformPeaks.length > 0
  );
  const [shouldDecodeWaveform, setShouldDecodeWaveform] = React.useState(eagerWaveformDecode);
  const [audioWaveformBars, setAudioWaveformBars] = React.useState<number[]>(
    storedAudioWaveformPeaks.length > 0 ? storedAudioWaveformPeaks : fallbackAudioWaveformBars
  );
  const audioShellStyle = React.useMemo<React.CSSProperties | undefined>(() => {
    const normalizedBackgroundImageUrl = backgroundImageUrl?.trim();
    if (!normalizedBackgroundImageUrl) return undefined;
    return {
      backgroundImage: [
        "linear-gradient(180deg, rgba(9, 13, 18, 0.48), rgba(9, 13, 18, 0.82))",
        "radial-gradient(circle at top, rgba(108, 205, 255, 0.2), transparent 58%)",
        `url("${normalizedBackgroundImageUrl}")`,
      ].join(", "),
      backgroundSize: "auto, auto, cover",
      backgroundPosition: "center center, center top, center center",
    };
  }, [backgroundImageUrl]);

  const audioWaveformColumns = React.useMemo(
    () =>
      audioWaveformBars.map((peak, index) => {
        const normalizedHeight = Math.max(0, Math.min(1, peak / 100));
        const barStart = index / audioWaveformBars.length;
        const barEnd = (index + 1) / audioWaveformBars.length;
        const progress =
          barEnd <= barStart
            ? 0
            : Math.max(0, Math.min(1, (audioProgressRatio - barStart) / (barEnd - barStart)));
        const progressState = progress >= 1 ? "played" : progress > 0 ? "playing" : "pending";

        return {
          key: `${audioId}-wavebar-${index}`,
          height: normalizedHeight,
          progress,
          progressState,
        };
      }),
    [audioId, audioProgressRatio, audioWaveformBars]
  );
  const audioProgressPercent = Math.round(audioProgressRatio * 100);
  const resolvedAudioDurationSeconds = React.useMemo(() => {
    if (resolvedAudioDurationMs != null && resolvedAudioDurationMs > 0) {
      return resolvedAudioDurationMs / 1000;
    }
    return null;
  }, [resolvedAudioDurationMs]);

  React.useEffect(() => {
    setResolvedAudioDurationMs(durationMs ?? null);
  }, [audioId, durationMs]);

  React.useEffect(() => {
    setIsAudioPlaying(false);
    setAudioProgressRatio(0);
    setShouldDecodeWaveform(eagerWaveformDecode);
    readyNotifiedRef.current = false;
    audioNodeRef.current?.pause();
  }, [audioId, eagerWaveformDecode]);

  React.useEffect(() => {
    if (storedAudioWaveformPeaks.length > 0) {
      setHasDecodedWaveform(true);
      setAudioWaveformBars(storedAudioWaveformPeaks);
      return;
    }
    if (hasDecodedWaveform) return;
    setAudioWaveformBars(fallbackAudioWaveformBars);
  }, [fallbackAudioWaveformBars, hasDecodedWaveform, storedAudioWaveformPeaks]);

  React.useEffect(() => {
    if (!audioUrl) return;
    if (storedAudioWaveformPeaks.length > 0) {
      setHasDecodedWaveform(true);
      return;
    }
    if (!shouldDecodeWaveform) return;
    let cancelled = false;
    setHasDecodedWaveform(false);

    const decodeWaveform = async () => {
      const nextBars = await extractAudioWaveformPeaksFromUrl(audioUrl, AUDIO_WAVEFORM_BAR_COUNT);
      if (!cancelled && Array.isArray(nextBars) && nextBars.length > 0) {
        setAudioWaveformBars(nextBars);
        setHasDecodedWaveform(true);
      }
    };

    void decodeWaveform();

    return () => {
      cancelled = true;
    };
  }, [audioUrl, shouldDecodeWaveform, storedAudioWaveformPeaks]);

  React.useEffect(
    () => () => {
      clearPlayback(resolvedAudioInstanceKey);
      audioNodeRef.current?.pause();
    },
    [clearPlayback, resolvedAudioInstanceKey]
  );

  const notifyReady = React.useCallback(() => {
    if (readyNotifiedRef.current) return;
    readyNotifiedRef.current = true;
    onReady?.();
  }, [onReady]);

  const handleAudioToggle = React.useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      onActivate?.();
      if (!shouldDecodeWaveform) setShouldDecodeWaveform(true);
      const node = audioNodeRef.current;
      if (!node) return;
      if (isAudioPlaying) {
        node.pause();
        setIsAudioPlaying(false);
        return;
      }
      if (
        node.ended ||
        (Number.isFinite(node.duration) && node.duration > 0 && node.currentTime >= node.duration)
      ) {
        node.currentTime = 0;
        setAudioProgressRatio(0);
      }
      try {
        requestPlayback({
          instanceKey: resolvedAudioInstanceKey,
          pause: () => {
            audioNodeRef.current?.pause();
          },
        });
        await node.play();
      } catch {
        clearPlayback(resolvedAudioInstanceKey);
        setIsAudioPlaying(false);
      }
    },
    [
      clearPlayback,
      isAudioPlaying,
      onActivate,
      requestPlayback,
      resolvedAudioInstanceKey,
      shouldDecodeWaveform,
    ]
  );

  const resolveAudioSeekDurationSeconds = React.useCallback((): number | null => {
    const nodeDuration = audioNodeRef.current?.duration;
    if (Number.isFinite(nodeDuration) && nodeDuration != null && nodeDuration > 0) {
      return nodeDuration;
    }
    return resolvedAudioDurationSeconds;
  }, [resolvedAudioDurationSeconds]);

  const seekAudioToRatio = React.useCallback(
    (nextRatio: number) => {
      const durationSeconds = resolveAudioSeekDurationSeconds();
      if (durationSeconds == null || durationSeconds <= 0) return;
      if (!shouldDecodeWaveform) setShouldDecodeWaveform(true);
      const clampedRatio = clampAudioSeekRatio(nextRatio);
      const node = audioNodeRef.current;
      if (node) {
        try {
          node.currentTime = durationSeconds * clampedRatio;
        } catch {
          return;
        }
      }
      setAudioProgressRatio(clampedRatio);
    },
    [resolveAudioSeekDurationSeconds, shouldDecodeWaveform]
  );

  const seekAudioFromPointerEvent = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const bounds = event.currentTarget.getBoundingClientRect();
      if (bounds.width <= 0) return;
      seekAudioToRatio((event.clientX - bounds.left) / bounds.width);
    },
    [seekAudioToRatio]
  );

  const handleWaveformPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.focus();
      isWaveformSeekingRef.current = true;
      try {
        event.currentTarget.setPointerCapture?.(event.pointerId);
      } catch {
        // Pointer capture may be unavailable for synthetic or unsupported pointer streams.
      }
      seekAudioFromPointerEvent(event);
    },
    [seekAudioFromPointerEvent]
  );

  const handleWaveformPointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isWaveformSeekingRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      seekAudioFromPointerEvent(event);
    },
    [seekAudioFromPointerEvent]
  );

  const handleWaveformPointerEnd = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isWaveformSeekingRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      isWaveformSeekingRef.current = false;
      try {
        event.currentTarget.releasePointerCapture?.(event.pointerId);
      } catch {
        // Pointer capture may already be released by the browser on cancellation.
      }
    },
    []
  );

  const handleWaveformKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const durationSeconds = resolveAudioSeekDurationSeconds();
      if (durationSeconds == null || durationSeconds <= 0) return;
      const node = audioNodeRef.current;
      const currentSeconds =
        node && Number.isFinite(node.currentTime)
          ? node.currentTime
          : durationSeconds * audioProgressRatio;
      let nextSeconds: number | null = null;

      if (event.key === "ArrowLeft") {
        nextSeconds = currentSeconds - AUDIO_SEEK_KEYBOARD_STEP_SECONDS;
      } else if (event.key === "ArrowRight") {
        nextSeconds = currentSeconds + AUDIO_SEEK_KEYBOARD_STEP_SECONDS;
      } else if (event.key === "Home") {
        nextSeconds = 0;
      } else if (event.key === "End") {
        nextSeconds = durationSeconds;
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (nextSeconds == null) return;
      event.preventDefault();
      event.stopPropagation();
      seekAudioToRatio(nextSeconds / durationSeconds);
    },
    [audioProgressRatio, resolveAudioSeekDurationSeconds, seekAudioToRatio]
  );

  return (
    <>
      <div className="reference-card-audio-shell" style={audioShellStyle}>
        <div className="reference-card-audio-player">
          <div className="reference-card-audio-player-row">
            <button
              type="button"
              className={`reference-card-audio-play ${isAudioPlaying ? "is-playing" : ""}`}
              aria-label={isAudioPlaying ? pauseLabel : playLabel}
              aria-pressed={isAudioPlaying}
              onDoubleClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onClick={(event) => {
                void handleAudioToggle(event);
              }}
            >
              {isAudioPlaying ? (
                <Pause size={24} weight="fill" aria-hidden="true" />
              ) : (
                <Play size={24} weight="fill" aria-hidden="true" />
              )}
            </button>
            <div className="reference-card-audio-waveform-shell">
              <div
                className="reference-card-audio-waveform reference-card-audio-waveform-control"
                role="slider"
                tabIndex={0}
                aria-label="Audio seek position"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={audioProgressPercent}
                aria-valuetext={`${audioProgressPercent}%`}
                onPointerDown={handleWaveformPointerDown}
                onPointerMove={handleWaveformPointerMove}
                onPointerUp={handleWaveformPointerEnd}
                onPointerCancel={handleWaveformPointerEnd}
                onLostPointerCapture={handleWaveformPointerEnd}
                onKeyDown={handleWaveformKeyDown}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onDoubleClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
              >
                {audioWaveformColumns.map((column) => (
                  <span
                    key={column.key}
                    className="reference-card-audio-wavebar"
                    data-progress-state={column.progressState}
                    style={
                      {
                        "--audio-waveform-height": column.height.toFixed(3),
                        "--audio-waveform-progress": column.progress.toFixed(3),
                      } as React.CSSProperties
                    }
                  >
                    <span className="reference-card-audio-wavebar-track" />
                    <span className="reference-card-audio-wavebar-fill" />
                  </span>
                ))}
              </div>
              <div className="reference-card-audio-time-row reference-card-audio-time-row--duration-only">
                <MediaDurationBadge
                  className="reference-card-audio-duration-badge"
                  durationMs={resolvedAudioDurationMs ?? 0}
                  mediaKind="audio"
                  audioSourceMode={audioSourceMode}
                />
              </div>
            </div>
          </div>
        </div>
        <audio
          className="reference-card-audio"
          preload="metadata"
          ref={audioNodeRef}
          src={audioUrl}
          onLoadedMetadata={(event) => {
            const durationSeconds = event.currentTarget.duration;
            if (Number.isFinite(durationSeconds) && durationSeconds > 0) {
              setResolvedAudioDurationMs(Math.round(durationSeconds * 1000));
            }
            setAudioProgressRatio(0);
            notifyReady();
          }}
          onCanPlay={() => {
            notifyReady();
          }}
          onError={() => {
            clearPlayback(resolvedAudioInstanceKey);
            setIsAudioPlaying(false);
            onError?.();
          }}
          onPlay={() => {
            markPlaybackStarted({
              instanceKey: resolvedAudioInstanceKey,
              pause: () => {
                audioNodeRef.current?.pause();
              },
            });
            setIsAudioPlaying(true);
          }}
          onPause={() => {
            clearPlayback(resolvedAudioInstanceKey);
            setIsAudioPlaying(false);
          }}
          onTimeUpdate={(event) => {
            const durationSeconds = event.currentTarget.duration;
            const currentTimeSeconds = event.currentTarget.currentTime;
            if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
              setAudioProgressRatio(0);
              return;
            }
            const ratio = Math.min(1, Math.max(0, currentTimeSeconds / durationSeconds));
            setAudioProgressRatio(ratio);
          }}
          onEnded={() => {
            clearPlayback(resolvedAudioInstanceKey);
            setIsAudioPlaying(false);
            setAudioProgressRatio(1);
          }}
        />
      </div>
    </>
  );
}
