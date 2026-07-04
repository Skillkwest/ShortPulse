/**
 * Voice changer audio source preview.
 * Renders playable source-audio waveform feedback for loaded voice changer audio clips.
 */
import React from "react";
import { Pause, Play } from "phosphor-react";

import {
  buildFallbackWaveformPeaks,
  extractAudioWaveformPeaksFromUrl,
} from "../reference-grid/logic/referenceGridAudioWaveform";
import { useExclusiveSoundMediaElement } from "./shared/exclusiveSoundPlayback";

type VoiceChangerAudioSourcePreviewProps = {
  audioUrl: string;
  onDurationResolved?: (durationMs: number) => void;
};

const formatPlaybackClock = (valueMs: number | null): string => {
  if (!Number.isFinite(valueMs) || valueMs == null || valueMs <= 0) return "0:00";
  const totalSeconds = Math.max(0, Math.round(valueMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

/**
 * Shows one interactive waveform preview for a loaded audio source clip.
 */
export const VoiceChangerAudioSourcePreview = React.memo(function VoiceChangerAudioSourcePreview({
  audioUrl,
  onDurationResolved,
}: VoiceChangerAudioSourcePreviewProps) {
  const audioNodeRef = React.useRef<HTMLAudioElement | null>(null);
  const exclusiveSound = useExclusiveSoundMediaElement(
    `voice-changer-source:${audioUrl}`,
    audioNodeRef
  );
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [audioProgressRatio, setAudioProgressRatio] = React.useState(0);
  const [currentTimeMs, setCurrentTimeMs] = React.useState(0);
  const [resolvedDurationMs, setResolvedDurationMs] = React.useState<number | null>(null);
  const [hasDecodedWaveform, setHasDecodedWaveform] = React.useState(false);
  const [shouldDecodeWaveform, setShouldDecodeWaveform] = React.useState(false);
  const fallbackWaveformBars = React.useMemo(
    () => buildFallbackWaveformPeaks(resolvedDurationMs ? resolvedDurationMs / 1000 : null),
    [resolvedDurationMs]
  );
  const [audioWaveformBars, setAudioWaveformBars] = React.useState<number[]>(fallbackWaveformBars);

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
          key: `voice-changer-audio-wavebar-${index}`,
          height: normalizedHeight,
          progress,
          progressState,
        };
      }),
    [audioProgressRatio, audioWaveformBars]
  );

  React.useEffect(() => {
    setHasDecodedWaveform(false);
    setShouldDecodeWaveform(false);
  }, [audioUrl]);

  React.useEffect(() => {
    if (hasDecodedWaveform) return;
    setAudioWaveformBars(fallbackWaveformBars);
  }, [fallbackWaveformBars, hasDecodedWaveform]);

  React.useEffect(() => {
    if (!shouldDecodeWaveform) return;
    let cancelled = false;
    setHasDecodedWaveform(false);

    const decodeWaveform = async () => {
      const nextBars = await extractAudioWaveformPeaksFromUrl(audioUrl);
      if (!cancelled && Array.isArray(nextBars) && nextBars.length > 0) {
        setAudioWaveformBars(nextBars);
        setHasDecodedWaveform(true);
      }
    };

    void decodeWaveform();

    return () => {
      cancelled = true;
    };
  }, [audioUrl, shouldDecodeWaveform]);

  React.useEffect(
    () => () => {
      audioNodeRef.current?.pause();
    },
    []
  );

  const handleAudioToggle = React.useCallback(async () => {
    const node = audioNodeRef.current;
    if (!node) return;
    if (isPlaying) {
      node.pause();
      setIsPlaying(false);
      return;
    }
    if (
      node.ended ||
      (Number.isFinite(node.duration) && node.duration > 0 && node.currentTime >= node.duration)
    ) {
      node.currentTime = 0;
      setCurrentTimeMs(0);
      setAudioProgressRatio(0);
    }
    setShouldDecodeWaveform(true);
    try {
      exclusiveSound.requestPlayback();
      await node.play();
    } catch {
      setIsPlaying(false);
    }
  }, [exclusiveSound, isPlaying]);

  return (
    <div className="voices-properties-voice-changer-audio-player">
      <div className="voices-properties-voice-changer-audio-player-row">
        <button
          type="button"
          className={`voices-properties-voice-changer-audio-play${isPlaying ? " is-playing" : ""}`}
          aria-label={isPlaying ? "Pause source audio preview" : "Play source audio preview"}
          aria-pressed={isPlaying}
          onClick={() => {
            void handleAudioToggle();
          }}
        >
          {isPlaying ? (
            <Pause size={18} weight="fill" aria-hidden="true" />
          ) : (
            <Play size={18} weight="fill" aria-hidden="true" />
          )}
        </button>

        <div className="voices-properties-voice-changer-audio-waveform-shell">
          <div className="voices-properties-voice-changer-audio-waveform" aria-hidden="true">
            {audioWaveformColumns.map((column) => (
              <span
                key={column.key}
                className="voices-properties-voice-changer-audio-wavebar"
                data-progress-state={column.progressState}
                style={
                  {
                    "--voice-changer-audio-waveform-height": column.height.toFixed(3),
                    "--voice-changer-audio-waveform-progress": column.progress.toFixed(3),
                  } as React.CSSProperties
                }
              >
                <span className="voices-properties-voice-changer-audio-wavebar-track" />
                <span className="voices-properties-voice-changer-audio-wavebar-fill" />
              </span>
            ))}
          </div>

          <div className="voices-properties-voice-changer-audio-time-row">
            <span className="voices-properties-voice-changer-audio-time-current">
              {formatPlaybackClock(currentTimeMs)}
            </span>
            <span className="voices-properties-voice-changer-audio-time-total">
              {formatPlaybackClock(resolvedDurationMs)}
            </span>
          </div>
        </div>
      </div>

      <audio
        ref={audioNodeRef}
        className="voices-properties-voice-changer-audio-element"
        preload="metadata"
        src={audioUrl}
        onLoadedMetadata={(event) => {
          const durationSeconds = event.currentTarget.duration;
          if (Number.isFinite(durationSeconds) && durationSeconds > 0) {
            const durationMs = Math.round(durationSeconds * 1000);
            setResolvedDurationMs(durationMs);
            onDurationResolved?.(durationMs);
          }
          setCurrentTimeMs(0);
          setAudioProgressRatio(0);
        }}
        onPlay={() => {
          exclusiveSound.handlePlay();
          setShouldDecodeWaveform(true);
          setIsPlaying(true);
        }}
        onPause={() => {
          exclusiveSound.handlePause();
          setIsPlaying(false);
        }}
        onEnded={() => {
          exclusiveSound.handleEnded();
          setIsPlaying(false);
          setCurrentTimeMs(resolvedDurationMs ?? currentTimeMs);
          setAudioProgressRatio(1);
        }}
        onError={() => {
          exclusiveSound.handleError();
          setIsPlaying(false);
        }}
        onVolumeChange={exclusiveSound.handleVolumeChange}
        onTimeUpdate={(event) => {
          const durationSeconds = event.currentTarget.duration;
          const currentTimeSeconds = event.currentTarget.currentTime;
          setCurrentTimeMs(Math.round(Math.max(0, currentTimeSeconds) * 1000));
          if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
            setAudioProgressRatio(0);
            return;
          }
          const ratio = Math.min(1, Math.max(0, currentTimeSeconds / durationSeconds));
          setAudioProgressRatio(ratio);
        }}
      />
    </div>
  );
});
