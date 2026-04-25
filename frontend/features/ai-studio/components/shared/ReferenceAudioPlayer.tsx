import React from "react";
import { Pause, Play } from "phosphor-react";
import {
  buildFallbackWaveformPeaks,
  extractAudioWaveformPeaksFromUrl,
  normalizeStoredWaveformPeaks,
} from "../../reference-grid/logic/referenceGridAudioWaveform";

const AUDIO_WAVEFORM_BAR_COUNT = 28;

const formatPlaybackClock = (valueMs: number | null): string => {
  if (!Number.isFinite(valueMs) || valueMs == null || valueMs <= 0) return "0:00";
  const totalSeconds = Math.max(0, Math.round(valueMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

export type ReferenceAudioPlayerProps = {
  audioId: string;
  audioUrl: string;
  durationMs?: number | null;
  waveformPeaks?: number[] | null;
  playLabel: string;
  pauseLabel: string;
  onActivate?: () => void;
  onReady?: () => void;
  onError?: () => void;
  eagerWaveformDecode?: boolean;
};

export function ReferenceAudioPlayer({
  audioId,
  audioUrl,
  durationMs = null,
  waveformPeaks = null,
  playLabel,
  pauseLabel,
  onActivate,
  onReady,
  onError,
  eagerWaveformDecode = true,
}: ReferenceAudioPlayerProps) {
  const audioNodeRef = React.useRef<HTMLAudioElement | null>(null);
  const readyNotifiedRef = React.useRef(false);
  const [isAudioPlaying, setIsAudioPlaying] = React.useState(false);
  const [audioProgressRatio, setAudioProgressRatio] = React.useState(0);
  const [currentAudioTimeMs, setCurrentAudioTimeMs] = React.useState(0);
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

  React.useEffect(() => {
    setResolvedAudioDurationMs(durationMs ?? null);
  }, [audioId, durationMs]);

  React.useEffect(() => {
    setIsAudioPlaying(false);
    setAudioProgressRatio(0);
    setCurrentAudioTimeMs(0);
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
      audioNodeRef.current?.pause();
    },
    []
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
        setCurrentAudioTimeMs(0);
      }
      try {
        await node.play();
      } catch {
        setIsAudioPlaying(false);
      }
    },
    [isAudioPlaying, onActivate, shouldDecodeWaveform]
  );

  return (
    <>
      <div className="reference-card-audio-shell">
        <div className="reference-card-audio-player">
          <div className="reference-card-audio-player-row">
            <button
              type="button"
              className={`reference-card-audio-play ${isAudioPlaying ? "is-playing" : ""}`}
              aria-label={isAudioPlaying ? pauseLabel : playLabel}
              aria-pressed={isAudioPlaying}
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
              <div className="reference-card-audio-waveform" aria-hidden="true">
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
              <div className="reference-card-audio-time-row">
                <span className="reference-card-audio-time-current">
                  {formatPlaybackClock(currentAudioTimeMs)}
                </span>
                <span className="reference-card-audio-time-total">
                  {formatPlaybackClock(resolvedAudioDurationMs)}
                </span>
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
            setCurrentAudioTimeMs(0);
            setAudioProgressRatio(0);
            notifyReady();
          }}
          onCanPlay={() => {
            notifyReady();
          }}
          onError={() => {
            onError?.();
          }}
          onPlay={() => setIsAudioPlaying(true)}
          onPause={() => setIsAudioPlaying(false)}
          onTimeUpdate={(event) => {
            const durationSeconds = event.currentTarget.duration;
            const currentTimeSeconds = event.currentTarget.currentTime;
            setCurrentAudioTimeMs(Math.round(Math.max(0, currentTimeSeconds) * 1000));
            if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
              setAudioProgressRatio(0);
              return;
            }
            const ratio = Math.min(1, Math.max(0, currentTimeSeconds / durationSeconds));
            setAudioProgressRatio(ratio);
          }}
          onEnded={() => {
            setIsAudioPlaying(false);
            setCurrentAudioTimeMs(resolvedAudioDurationMs ?? currentAudioTimeMs);
            setAudioProgressRatio(1);
          }}
        />
      </div>
    </>
  );
}
