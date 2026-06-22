import React from "react";
import { DownloadSimple, Pause, Play } from "phosphor-react";
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
  audioUrl?: string | null;
  audioInstanceKey?: string;
  title?: string | null;
  backgroundImageUrl?: string | null;
  audioSourceMode?: StudioAudioSourceMode | null;
  durationMs?: number | null;
  showDurationBadge?: boolean;
  waveformPeaks?: number[] | null;
  playLabel: string;
  pauseLabel: string;
  downloadLabel?: string;
  onActivate?: () => void;
  onDownload?: () => void;
  onResolveAudioUrl?: () => Promise<string | null>;
  resolveAudioUrlOnMount?: boolean;
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
  title = null,
  backgroundImageUrl = null,
  audioSourceMode = null,
  durationMs = null,
  showDurationBadge = true,
  waveformPeaks = null,
  playLabel,
  pauseLabel,
  downloadLabel = "Download audio",
  onActivate,
  onDownload,
  onResolveAudioUrl,
  resolveAudioUrlOnMount = false,
  onReady,
  onError,
  eagerWaveformDecode = false,
  onRequestPlay,
  onPlaybackStarted,
  onPlaybackStopped,
}: ReferenceAudioPlayerProps) {
  const audioNodeRef = React.useRef<HTMLAudioElement | null>(null);
  const readyNotifiedRef = React.useRef(false);
  const isWaveformSeekingRef = React.useRef(false);
  const suppressNextAudioClickRef = React.useRef(false);
  const resolvedAudioInstanceKey = audioInstanceKey ?? audioId;
  const requestPlayback = onRequestPlay ?? requestExclusiveSoundPlayback;
  const markPlaybackStarted = onPlaybackStarted ?? markExclusiveSoundPlaying;
  const clearPlayback = onPlaybackStopped ?? clearExclusiveSoundPlayback;
  const [activeAudioUrl, setActiveAudioUrl] = React.useState(() =>
    onResolveAudioUrl ? "" : (audioUrl?.trim() ?? "")
  );
  const activeAudioUrlRef = React.useRef(activeAudioUrl);
  const fallbackAudioUrlRef = React.useRef(audioUrl?.trim() ?? "");
  const onResolveAudioUrlRef = React.useRef(onResolveAudioUrl);
  const audioUrlResolutionPromiseRef = React.useRef<Promise<string> | null>(null);
  const waveformDecodeInFlightKeyRef = React.useRef<string | null>(null);
  const [isResolvingAudioUrl, setIsResolvingAudioUrl] = React.useState(false);
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
  const hasAudioUrlResolver = Boolean(onResolveAudioUrl);
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
  const audioShellClassName = ["reference-card-audio-shell", onDownload ? "has-audio-download" : ""]
    .filter(Boolean)
    .join(" ");

  React.useEffect(() => {
    onResolveAudioUrlRef.current = onResolveAudioUrl;
  }, [onResolveAudioUrl]);

  React.useEffect(() => {
    fallbackAudioUrlRef.current = audioUrl?.trim() ?? "";
  }, [audioUrl]);

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
  const normalizedTitle = title?.trim() || null;
  const resolvedAudioDurationSeconds = React.useMemo(() => {
    if (resolvedAudioDurationMs != null && resolvedAudioDurationMs > 0) {
      return resolvedAudioDurationMs / 1000;
    }
    return null;
  }, [resolvedAudioDurationMs]);

  const applyResolvedAudioUrl = React.useCallback((nextAudioUrl: string) => {
    const normalizedNextAudioUrl = nextAudioUrl.trim();
    if (!normalizedNextAudioUrl || normalizedNextAudioUrl === activeAudioUrlRef.current) {
      return normalizedNextAudioUrl;
    }
    activeAudioUrlRef.current = normalizedNextAudioUrl;
    setActiveAudioUrl(normalizedNextAudioUrl);
    const node = audioNodeRef.current;
    if (node) {
      node.src = normalizedNextAudioUrl;
      try {
        node.load();
      } catch {
        // Some test/browser environments do not expose a useful load implementation.
      }
    }
    return normalizedNextAudioUrl;
  }, []);

  const resolveFreshAudioUrl = React.useCallback(async () => {
    const resolveAudioUrl = onResolveAudioUrlRef.current;
    if (!resolveAudioUrl) {
      return activeAudioUrlRef.current;
    }
    if (audioUrlResolutionPromiseRef.current) {
      return audioUrlResolutionPromiseRef.current;
    }
    const resolutionPromise = (async () => {
      const applyFallbackAudioUrl = () => {
        const fallbackAudioUrl = fallbackAudioUrlRef.current;
        if (fallbackAudioUrl) {
          applyResolvedAudioUrl(fallbackAudioUrl);
        }
        return fallbackAudioUrl;
      };
      try {
        const resolvedUrl = await resolveAudioUrl();
        const normalizedResolvedUrl = resolvedUrl?.trim() ?? "";
        if (normalizedResolvedUrl) {
          applyResolvedAudioUrl(normalizedResolvedUrl);
          return normalizedResolvedUrl;
        }
        return applyFallbackAudioUrl();
      } catch {
        return applyFallbackAudioUrl();
      }
    })();
    audioUrlResolutionPromiseRef.current = resolutionPromise;
    void resolutionPromise.finally(() => {
      if (audioUrlResolutionPromiseRef.current === resolutionPromise) {
        audioUrlResolutionPromiseRef.current = null;
      }
    });
    return resolutionPromise;
  }, [applyResolvedAudioUrl]);

  React.useEffect(() => {
    setResolvedAudioDurationMs(durationMs ?? null);
  }, [audioId, durationMs]);

  React.useEffect(() => {
    if (onResolveAudioUrlRef.current) return;
    const nextAudioUrl = audioUrl?.trim() ?? "";
    activeAudioUrlRef.current = nextAudioUrl;
    setActiveAudioUrl(nextAudioUrl);
  }, [audioUrl]);

  React.useEffect(() => {
    setIsAudioPlaying(false);
    setAudioProgressRatio(0);
    setShouldDecodeWaveform(eagerWaveformDecode);
    waveformDecodeInFlightKeyRef.current = null;
    audioUrlResolutionPromiseRef.current = null;
    readyNotifiedRef.current = false;
    audioNodeRef.current?.pause();
    if (onResolveAudioUrlRef.current) {
      activeAudioUrlRef.current = "";
      setActiveAudioUrl("");
    }
  }, [audioId, eagerWaveformDecode]);

  React.useEffect(() => {
    if (!resolveAudioUrlOnMount || !onResolveAudioUrlRef.current || activeAudioUrlRef.current)
      return;
    let cancelled = false;
    setIsResolvingAudioUrl(true);
    void resolveFreshAudioUrl().finally(() => {
      if (!cancelled) setIsResolvingAudioUrl(false);
    });
    return () => {
      cancelled = true;
    };
  }, [audioId, resolveAudioUrlOnMount, resolveFreshAudioUrl]);

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
    if (!activeAudioUrl && !hasAudioUrlResolver) return;
    if (storedAudioWaveformPeaks.length > 0) {
      setHasDecodedWaveform(true);
      return;
    }
    if (hasDecodedWaveform) return;
    if (!shouldDecodeWaveform) return;
    const decodeKey = hasAudioUrlResolver ? `${audioId}:resolved` : `${audioId}:${activeAudioUrl}`;
    if (waveformDecodeInFlightKeyRef.current === decodeKey) return;
    waveformDecodeInFlightKeyRef.current = decodeKey;
    let cancelled = false;
    setHasDecodedWaveform(false);

    const decodeWaveform = async () => {
      let decodeUrl = activeAudioUrlRef.current || activeAudioUrl;
      if (hasAudioUrlResolver && !decodeUrl) {
        decodeUrl = await resolveFreshAudioUrl();
        if (!decodeUrl) {
          if (!cancelled) waveformDecodeInFlightKeyRef.current = null;
          return;
        }
      }
      try {
        const nextBars = await extractAudioWaveformPeaksFromUrl(
          decodeUrl,
          AUDIO_WAVEFORM_BAR_COUNT
        );
        if (!cancelled && Array.isArray(nextBars) && nextBars.length > 0) {
          setAudioWaveformBars(nextBars);
          setHasDecodedWaveform(true);
        } else if (!cancelled) {
          waveformDecodeInFlightKeyRef.current = null;
        }
      } catch {
        if (!cancelled) waveformDecodeInFlightKeyRef.current = null;
      }
    };

    void decodeWaveform();

    return () => {
      cancelled = true;
    };
  }, [
    activeAudioUrl,
    audioId,
    hasDecodedWaveform,
    hasAudioUrlResolver,
    resolveFreshAudioUrl,
    shouldDecodeWaveform,
    storedAudioWaveformPeaks,
  ]);

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

  const toggleAudioPlayback = React.useCallback(async () => {
    onActivate?.();
    if (!shouldDecodeWaveform) setShouldDecodeWaveform(true);
    const node = audioNodeRef.current;
    if (!node) return;
    if (isAudioPlaying) {
      node.pause();
      setIsAudioPlaying(false);
      return;
    }
    let playbackUrl = activeAudioUrlRef.current;
    if (hasAudioUrlResolver && !playbackUrl) {
      if (isResolvingAudioUrl) return;
      setIsResolvingAudioUrl(true);
      try {
        playbackUrl = await resolveFreshAudioUrl();
      } finally {
        setIsResolvingAudioUrl(false);
      }
      if (!playbackUrl) {
        onError?.();
        return;
      }
    } else if (!playbackUrl) {
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
  }, [
    clearPlayback,
    isAudioPlaying,
    isResolvingAudioUrl,
    onActivate,
    onError,
    hasAudioUrlResolver,
    requestPlayback,
    resolveFreshAudioUrl,
    resolvedAudioInstanceKey,
    shouldDecodeWaveform,
  ]);

  const handleAudioPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      suppressNextAudioClickRef.current = true;
      void toggleAudioPlayback();
    },
    [toggleAudioPlayback]
  );

  const handleAudioToggle = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (suppressNextAudioClickRef.current) {
        suppressNextAudioClickRef.current = false;
        return;
      }
      void toggleAudioPlayback();
    },
    [toggleAudioPlayback]
  );

  const handleAudioDownload = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      onActivate?.();
      onDownload?.();
    },
    [onActivate, onDownload]
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
      <div className={audioShellClassName} style={audioShellStyle}>
        {onDownload ? (
          <button
            type="button"
            className="reference-card-action-btn reference-card-audio-download"
            aria-label={downloadLabel}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onDoubleClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onClick={handleAudioDownload}
          >
            <DownloadSimple size={15} weight="bold" aria-hidden />
          </button>
        ) : null}
        {normalizedTitle ? (
          <div className="reference-card-audio-title" title={normalizedTitle}>
            {normalizedTitle}
          </div>
        ) : null}
        <div className="reference-card-audio-player">
          <div className="reference-card-audio-player-row">
            <button
              type="button"
              className={`reference-card-audio-play ${isAudioPlaying ? "is-playing" : ""}`}
              aria-label={
                isResolvingAudioUrl
                  ? `Loading ${playLabel}`
                  : isAudioPlaying
                    ? pauseLabel
                    : playLabel
              }
              aria-pressed={isAudioPlaying}
              disabled={isResolvingAudioUrl}
              onPointerDown={handleAudioPointerDown}
              onDoubleClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onClick={handleAudioToggle}
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
              {showDurationBadge ? (
                <div className="reference-card-audio-time-row reference-card-audio-time-row--duration-only">
                  <MediaDurationBadge
                    className="reference-card-audio-duration-badge"
                    durationMs={resolvedAudioDurationMs}
                    mediaKind="audio"
                    audioSourceMode={audioSourceMode}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <audio
          className="reference-card-audio"
          preload={
            resolvedAudioDurationMs != null && resolvedAudioDurationMs > 0 ? "none" : "metadata"
          }
          ref={audioNodeRef}
          src={activeAudioUrl || undefined}
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
