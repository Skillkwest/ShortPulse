import React from "react";
import { Pause, Play } from "phosphor-react";
import type { StudioAudioSourceMode } from "../../types";
import { MediaDurationBadge } from "../shared/MediaDurationBadge";
import {
  buildFallbackWaveformPeaks,
  extractAudioWaveformPeaksFromUrl,
  normalizeStoredWaveformPeaks,
} from "../../reference-grid/logic/referenceGridAudioWaveform";

const DETAIL_AUDIO_WAVEFORM_BAR_COUNT = 64;

const assignMediaRef = <ElementType extends HTMLElement>(
  targetRef: React.Ref<ElementType> | undefined,
  node: ElementType | null
) => {
  if (!targetRef) return;
  if (typeof targetRef === "function") {
    targetRef(node);
    return;
  }
  (targetRef as React.MutableRefObject<ElementType | null>).current = node;
};

type SharedMediaDetailAudioPreviewProps = {
  mediaUrl: string;
  audioId?: string;
  audioClassName?: string;
  audioRef?: React.Ref<HTMLAudioElement>;
  audioAutoPlay: boolean;
  audioPreload: "none" | "metadata" | "auto";
  audioSourceMode?: StudioAudioSourceMode | null;
  audioDurationMs?: number | null;
  audioWaveformPeaks?: number[] | null;
  playLabel?: string;
  pauseLabel?: string;
  onAudioPlay?: React.ReactEventHandler<HTMLAudioElement>;
  onAudioPause?: React.ReactEventHandler<HTMLAudioElement>;
  onAudioEnded?: React.ReactEventHandler<HTMLAudioElement>;
  onAudioError?: React.ReactEventHandler<HTMLAudioElement>;
  onAudioVolumeChange?: React.ReactEventHandler<HTMLAudioElement>;
};

type SharedMediaDetailPreviewMediaProps = {
  mediaUrl: string | null;
  mediaKind: "image" | "video" | "audio" | null;
  altText: string;
  isLoading?: boolean;
  loadingMessage?: string;
  unavailableMessage?: string;
  placeholderClassName?: string;
  imageClassName: string;
  videoClassName?: string;
  audioClassName?: string;
  videoPosterUrl?: string | null;
  imageStyle?: React.CSSProperties;
  videoStyle?: React.CSSProperties;
  videoRef?: React.Ref<HTMLVideoElement>;
  audioRef?: React.Ref<HTMLAudioElement>;
  videoControls?: boolean;
  videoAutoPlay?: boolean;
  videoLoop?: boolean;
  videoMuted?: boolean;
  videoPlaysInline?: boolean;
  audioControls?: boolean;
  audioAutoPlay?: boolean;
  audioPreload?: "none" | "metadata" | "auto";
  audioId?: string;
  audioSourceMode?: StudioAudioSourceMode | null;
  audioDurationMs?: number | null;
  audioWaveformPeaks?: number[] | null;
  audioPlayLabel?: string;
  audioPauseLabel?: string;
  imageDraggable?: boolean;
  onImageDragStart?: React.DragEventHandler<HTMLImageElement>;
  onImageLoad?: React.ReactEventHandler<HTMLImageElement>;
  onImageError?: React.ReactEventHandler<HTMLImageElement>;
  onVideoLoadedMetadata?: React.ReactEventHandler<HTMLVideoElement>;
  onVideoPlay?: React.ReactEventHandler<HTMLVideoElement>;
  onVideoPause?: React.ReactEventHandler<HTMLVideoElement>;
  onVideoEnded?: React.ReactEventHandler<HTMLVideoElement>;
  onVideoError?: React.ReactEventHandler<HTMLVideoElement>;
  onVideoVolumeChange?: React.ReactEventHandler<HTMLVideoElement>;
  onAudioPlay?: React.ReactEventHandler<HTMLAudioElement>;
  onAudioPause?: React.ReactEventHandler<HTMLAudioElement>;
  onAudioEnded?: React.ReactEventHandler<HTMLAudioElement>;
  onAudioError?: React.ReactEventHandler<HTMLAudioElement>;
  onAudioVolumeChange?: React.ReactEventHandler<HTMLAudioElement>;
};

function SharedMediaDetailAudioPreview({
  mediaUrl,
  audioId = "detail-audio",
  audioClassName,
  audioRef,
  audioAutoPlay,
  audioPreload,
  audioSourceMode = null,
  audioDurationMs = null,
  audioWaveformPeaks = null,
  playLabel = "Play audio preview",
  pauseLabel = "Pause audio preview",
  onAudioPlay,
  onAudioPause,
  onAudioEnded,
  onAudioError,
  onAudioVolumeChange,
}: SharedMediaDetailAudioPreviewProps) {
  const internalAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [progressRatio, setProgressRatio] = React.useState(0);
  const [resolvedDurationMs, setResolvedDurationMs] = React.useState<number | null>(
    audioDurationMs
  );
  const storedWaveformPeaks = React.useMemo(
    () => normalizeStoredWaveformPeaks(audioWaveformPeaks, DETAIL_AUDIO_WAVEFORM_BAR_COUNT),
    [audioWaveformPeaks]
  );
  const fallbackWaveformPeaks = React.useMemo(
    () =>
      buildFallbackWaveformPeaks(
        resolvedDurationMs ? resolvedDurationMs / 1000 : null,
        DETAIL_AUDIO_WAVEFORM_BAR_COUNT
      ),
    [resolvedDurationMs]
  );
  const [hasDecodedWaveform, setHasDecodedWaveform] = React.useState(
    storedWaveformPeaks.length > 0
  );
  const [waveformPeaks, setWaveformPeaks] = React.useState<number[]>(
    storedWaveformPeaks.length > 0 ? storedWaveformPeaks : fallbackWaveformPeaks
  );

  const resolvedAudioClassName = ["detail-modal-audio-native", audioClassName]
    .filter(Boolean)
    .join(" ");

  const waveformColumns = React.useMemo(
    () =>
      waveformPeaks.map((peak, index) => {
        const normalizedHeight = Math.max(0, Math.min(1, peak / 100));
        const columnStart = index / waveformPeaks.length;
        const columnEnd = (index + 1) / waveformPeaks.length;
        const progress =
          columnEnd <= columnStart
            ? 0
            : Math.max(0, Math.min(1, (progressRatio - columnStart) / (columnEnd - columnStart)));
        const progressState = progress >= 1 ? "played" : progress > 0 ? "playing" : "pending";

        return {
          key: `${audioId}-detail-wavebar-${index}`,
          height: normalizedHeight,
          progress,
          progressState,
        };
      }),
    [audioId, progressRatio, waveformPeaks]
  );

  React.useEffect(() => {
    setIsPlaying(false);
    setProgressRatio(0);
    setResolvedDurationMs(audioDurationMs ?? null);
    setHasDecodedWaveform(storedWaveformPeaks.length > 0);
    setWaveformPeaks(storedWaveformPeaks.length > 0 ? storedWaveformPeaks : fallbackWaveformPeaks);
  }, [audioDurationMs, fallbackWaveformPeaks, mediaUrl, storedWaveformPeaks]);

  React.useEffect(() => {
    if (storedWaveformPeaks.length > 0) {
      setHasDecodedWaveform(true);
      setWaveformPeaks(storedWaveformPeaks);
      return;
    }
    if (hasDecodedWaveform) return;
    setWaveformPeaks(fallbackWaveformPeaks);
  }, [fallbackWaveformPeaks, hasDecodedWaveform, storedWaveformPeaks]);

  React.useEffect(() => {
    if (!mediaUrl || storedWaveformPeaks.length > 0) return;
    let cancelled = false;
    setHasDecodedWaveform(false);

    const decodeWaveform = async () => {
      const nextPeaks = await extractAudioWaveformPeaksFromUrl(
        mediaUrl,
        DETAIL_AUDIO_WAVEFORM_BAR_COUNT
      );
      if (!cancelled && Array.isArray(nextPeaks) && nextPeaks.length > 0) {
        setWaveformPeaks(nextPeaks);
        setHasDecodedWaveform(true);
      }
    };

    void decodeWaveform();

    return () => {
      cancelled = true;
    };
  }, [mediaUrl, storedWaveformPeaks]);

  const setAudioNode = React.useCallback(
    (node: HTMLAudioElement | null) => {
      internalAudioRef.current = node;
      assignMediaRef(audioRef, node);
    },
    [audioRef]
  );

  const handleTogglePlayback = React.useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const node = internalAudioRef.current;
      if (!node) return;
      if (isPlaying) {
        node.pause();
        return;
      }
      if (
        node.ended ||
        (Number.isFinite(node.duration) && node.duration > 0 && node.currentTime >= node.duration)
      ) {
        node.currentTime = 0;
        setProgressRatio(0);
      }
      try {
        await node.play();
      } catch {
        setIsPlaying(false);
      }
    },
    [isPlaying]
  );

  const seekAudioToRatio = React.useCallback(
    (nextRatio: number) => {
      const node = internalAudioRef.current;
      if (!node) return;
      const durationSeconds = Number.isFinite(node.duration)
        ? node.duration
        : resolvedDurationMs
          ? resolvedDurationMs / 1000
          : 0;
      if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return;
      const clampedRatio = Math.max(0, Math.min(1, nextRatio));
      node.currentTime = clampedRatio * durationSeconds;
      setProgressRatio(clampedRatio);
    },
    [resolvedDurationMs]
  );

  const handleWaveformSeek = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const bounds = event.currentTarget.getBoundingClientRect();
      if (bounds.width <= 0) return;
      seekAudioToRatio((event.clientX - bounds.left) / bounds.width);
    },
    [seekAudioToRatio]
  );

  const handleWaveformKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Home") {
        seekAudioToRatio(0);
        return;
      }
      if (event.key === "End") {
        seekAudioToRatio(1);
        return;
      }
      seekAudioToRatio(progressRatio + (event.key === "ArrowRight" ? 0.05 : -0.05));
    },
    [progressRatio, seekAudioToRatio]
  );

  return (
    <div className="detail-modal-audio-preview">
      <button
        type="button"
        className={`detail-modal-audio-play ${isPlaying ? "is-playing" : ""}`}
        aria-label={isPlaying ? pauseLabel : playLabel}
        aria-pressed={isPlaying}
        onClick={(event) => {
          void handleTogglePlayback(event);
        }}
      >
        {isPlaying ? (
          <Pause size={28} weight="fill" aria-hidden="true" />
        ) : (
          <Play size={28} weight="fill" aria-hidden="true" />
        )}
      </button>
      <div className="detail-modal-audio-waveform-shell">
        <button
          type="button"
          className="detail-modal-audio-waveform"
          aria-label="Seek audio waveform"
          onClick={handleWaveformSeek}
          onKeyDown={handleWaveformKeyDown}
        >
          {waveformColumns.map((column) => (
            <span
              key={column.key}
              className="detail-modal-audio-wavebar"
              data-progress-state={column.progressState}
              style={
                {
                  "--detail-audio-waveform-height": column.height.toFixed(3),
                  "--detail-audio-waveform-progress": column.progress.toFixed(3),
                } as React.CSSProperties
              }
            >
              <span className="detail-modal-audio-wavebar-track" />
              <span className="detail-modal-audio-wavebar-fill" />
            </span>
          ))}
        </button>
        <div className="detail-modal-audio-duration-row">
          <MediaDurationBadge
            className="detail-modal-audio-duration-badge"
            durationMs={resolvedDurationMs ?? 0}
            mediaKind="audio"
            audioSourceMode={audioSourceMode}
          />
        </div>
      </div>
      <audio
        className={resolvedAudioClassName}
        src={mediaUrl}
        ref={setAudioNode}
        autoPlay={audioAutoPlay}
        preload={audioPreload}
        onLoadedMetadata={(event) => {
          const durationSeconds = event.currentTarget.duration;
          if (Number.isFinite(durationSeconds) && durationSeconds > 0) {
            setResolvedDurationMs(Math.round(durationSeconds * 1000));
          }
          setProgressRatio(0);
        }}
        onTimeUpdate={(event) => {
          const durationSeconds = event.currentTarget.duration;
          const currentTimeSeconds = event.currentTarget.currentTime;
          if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
            setProgressRatio(0);
            return;
          }
          setProgressRatio(Math.max(0, Math.min(1, currentTimeSeconds / durationSeconds)));
        }}
        onPlay={(event) => {
          setIsPlaying(true);
          onAudioPlay?.(event);
        }}
        onPause={(event) => {
          setIsPlaying(false);
          onAudioPause?.(event);
        }}
        onEnded={(event) => {
          setIsPlaying(false);
          setProgressRatio(1);
          onAudioEnded?.(event);
        }}
        onError={(event) => {
          setIsPlaying(false);
          onAudioError?.(event);
        }}
        onVolumeChange={onAudioVolumeChange}
      />
    </div>
  );
}

/**
 * Shared media renderer for AI Studio detail surfaces.
 * Keeps image/video/audio display logic aligned across modal implementations.
 */
export function SharedMediaDetailPreviewMedia({
  mediaUrl,
  mediaKind,
  altText,
  isLoading = false,
  loadingMessage = "Loading media...",
  unavailableMessage = "Media unavailable.",
  placeholderClassName = "art-text-placeholder",
  imageClassName,
  videoClassName,
  audioClassName,
  videoPosterUrl,
  imageStyle,
  videoStyle,
  videoRef,
  audioRef,
  videoControls = true,
  videoAutoPlay = true,
  videoLoop = false,
  videoMuted = false,
  videoPlaysInline = true,
  audioControls = true,
  audioAutoPlay = true,
  audioPreload = "metadata",
  audioId,
  audioSourceMode,
  audioDurationMs,
  audioWaveformPeaks,
  audioPlayLabel,
  audioPauseLabel,
  imageDraggable = false,
  onImageDragStart,
  onImageLoad,
  onImageError,
  onVideoLoadedMetadata,
  onVideoPlay,
  onVideoPause,
  onVideoEnded,
  onVideoError,
  onVideoVolumeChange,
  onAudioPlay,
  onAudioPause,
  onAudioEnded,
  onAudioError,
  onAudioVolumeChange,
}: SharedMediaDetailPreviewMediaProps) {
  if (!mediaUrl) {
    return (
      <div className={placeholderClassName}>
        <p>{isLoading ? loadingMessage : unavailableMessage}</p>
      </div>
    );
  }

  if (mediaKind === "video") {
    return (
      <video
        className={videoClassName ?? imageClassName}
        src={mediaUrl}
        poster={videoPosterUrl?.trim() || undefined}
        ref={videoRef}
        controls={videoControls}
        autoPlay={videoAutoPlay}
        loop={videoLoop}
        muted={videoMuted}
        playsInline={videoPlaysInline}
        style={videoStyle}
        onLoadedMetadata={onVideoLoadedMetadata}
        onPlay={onVideoPlay}
        onPause={onVideoPause}
        onEnded={onVideoEnded}
        onError={onVideoError}
        onVolumeChange={onVideoVolumeChange}
      />
    );
  }

  if (mediaKind === "audio") {
    return (
      <SharedMediaDetailAudioPreview
        mediaUrl={mediaUrl}
        audioId={audioId}
        audioClassName={audioClassName ?? imageClassName}
        audioRef={audioRef}
        audioAutoPlay={audioControls ? audioAutoPlay : false}
        audioPreload={audioPreload}
        audioSourceMode={audioSourceMode}
        audioDurationMs={audioDurationMs}
        audioWaveformPeaks={audioWaveformPeaks}
        playLabel={audioPlayLabel}
        pauseLabel={audioPauseLabel}
        onAudioPlay={onAudioPlay}
        onAudioPause={onAudioPause}
        onAudioEnded={onAudioEnded}
        onAudioError={onAudioError}
        onAudioVolumeChange={onAudioVolumeChange}
      />
    );
  }

  return (
    <>
      {/* Generated and signed media URLs can be provider-specific and not allowlisted. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={imageClassName}
        src={mediaUrl}
        alt={altText}
        style={imageStyle}
        draggable={imageDraggable}
        onDragStart={onImageDragStart}
        onLoad={onImageLoad}
        onError={onImageError}
      />
    </>
  );
}
