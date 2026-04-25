/**
 * Presentational card for a single reference-grid item.
 * Keeps render and card-level interaction wiring isolated from ReferenceGrid orchestration.
 */
import React from "react";
import {
  ArrowClockwise,
  CheckCircle,
  DownloadSimple,
  FloppyDisk,
  Pause,
  Play,
  X,
} from "phosphor-react";
import { isVideoUrl } from "../../logic/stateParsers";
import { canRerollOutput } from "../../logic/generationReplay";
import { canDragReferenceOutput } from "../../logic/referenceOutputAuthority";
import {
  canDownloadReferenceOutput,
  canSaveReferenceOutput,
} from "../../logic/referenceActionAvailability";
import type { ReferenceGridMediaAuthorityTier } from "../../logic/referenceGridMedia";
import {
  EXPLICIT_CONTENT_FAILURE_DETAIL,
  EXPLICIT_CONTENT_FAILURE_TITLE,
} from "../../../../lib/explicitContentFailure";
import { isProviderSafetyBlockedOutput } from "../../hooks/taskPolling/providerStatusPolicy";
import {
  buildFallbackWaveformPeaks,
  extractAudioWaveformPeaksFromUrl,
  normalizeStoredWaveformPeaks,
} from "../logic/referenceGridAudioWaveform";
import type { ReferenceDragSourceSurface } from "../../utils/dragDrop";
import type { StudioOutput } from "../../types";

const HYDRATION_FALLBACK_LOADED_MS = 1500;
const REFERENCE_GRID_AUDIO_WAVEFORM_BAR_COUNT = 28;

const formatPlaybackClock = (valueMs: number | null): string => {
  if (!Number.isFinite(valueMs) || valueMs == null || valueMs <= 0) return "0:00";
  const totalSeconds = Math.max(0, Math.round(valueMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

export type ReferenceGridCardProps = {
  item: StudioOutput;
  authorityTier: ReferenceGridMediaAuthorityTier;
  dragSourceSurface: ReferenceDragSourceSurface;
  videoNodeKey: string;
  activeOutputId: string | null;
  isLoading: boolean;
  loadingVisual: "none" | "spinner" | "hydrating";
  cardPreviewUrl: string | null;
  videoPosterUrl?: string | null;
  hoverVideoUrl?: string | null;
  isVideoPreview: boolean;
  isImagePreview: boolean;
  isAudioPreview?: boolean;
  canAutoplayVideo: boolean;
  videoPreload: "metadata" | "none";
  isPromptOnly: boolean;
  isLinkedPromptReference: boolean;
  canRetryStatus: boolean;
  imageSrc: string | undefined;
  imageLoading: "eager" | "lazy";
  imageFetchPriority: "high" | "low";
  onSelectOutput: (id: string) => void;
  onOpenDetails: (id: string) => void;
  onCardDragStart: (
    event: React.DragEvent<HTMLElement>,
    item: StudioOutput,
    sourceSurface: ReferenceDragSourceSurface
  ) => void;
  onCardDragEnd: (event: React.DragEvent<HTMLElement>) => void;
  onCardDragOver?: (event: React.DragEvent<HTMLElement>, item: StudioOutput) => void;
  onCardDrop?: (event: React.DragEvent<HTMLElement>, item: StudioOutput) => void;
  onCardDragEnter?: (event: React.DragEvent<HTMLElement>, item: StudioOutput) => void;
  onCardDragLeave?: (event: React.DragEvent<HTMLElement>, item: StudioOutput) => void;
  onKeyboardReorderCurated?: (id: string, direction: "up" | "down") => void;
  registerVideoNode: (nodeKey: string, outputId: string, node: HTMLVideoElement | null) => void;
  markLoaded: (id: string, options?: { notifyAutoSave?: boolean }) => void;
  onAutoplayStarted: (id: string) => void;
  onAutoplayStopped: (id: string) => void;
  onRetryStatus?: (output: StudioOutput) => void;
  onRerollOutput?: (output: StudioOutput) => void;
  onDeleteOutput?: (id: string) => void;
  onRemoveCuratedReference?: (id: string) => void;
  showCuratedRemoveAction?: boolean;
  onSaveToLibrary?: (output: StudioOutput) => void;
  onDownload?: (output: StudioOutput) => void;
  hideReferenceActions?: boolean;
};

const renderSaveChip = (item: StudioOutput, isSelected: boolean) => {
  if (!item.saveState || item.saveState === "idle") return null;
  const label =
    item.saveState === "saving"
      ? "Saving..."
      : item.saveState === "saved"
        ? "Saved"
        : "Save failed";
  if (item.saveState === "saved") {
    if (!isSelected) return null;
    return (
      <div className={`reference-save-chip is-${item.saveState}`} aria-label="Saved">
        <CheckCircle size={16} weight="fill" aria-hidden />
      </div>
    );
  }
  return (
    <div className={`reference-save-chip is-${item.saveState}`}>
      <span>{label}</span>
    </div>
  );
};

/**
 * Renders one reference item card and forwards interaction events to parent handlers.
 */
export const ReferenceGridCard = React.memo(function ReferenceGridCard({
  item,
  authorityTier,
  dragSourceSurface,
  videoNodeKey,
  activeOutputId,
  isLoading,
  loadingVisual,
  cardPreviewUrl,
  videoPosterUrl,
  hoverVideoUrl,
  isVideoPreview,
  isImagePreview,
  isAudioPreview = false,
  canAutoplayVideo,
  videoPreload,
  isPromptOnly,
  isLinkedPromptReference,
  canRetryStatus,
  imageSrc,
  imageLoading,
  imageFetchPriority,
  onSelectOutput,
  onOpenDetails,
  onCardDragStart,
  onCardDragEnd,
  onCardDragOver,
  onCardDrop,
  onCardDragEnter,
  onCardDragLeave,
  onKeyboardReorderCurated,
  registerVideoNode,
  markLoaded,
  onAutoplayStarted,
  onAutoplayStopped,
  onRetryStatus,
  onRerollOutput,
  onDeleteOutput,
  onRemoveCuratedReference,
  showCuratedRemoveAction = false,
  onSaveToLibrary,
  onDownload,
  hideReferenceActions = false,
}: ReferenceGridCardProps) {
  const videoNodeRef = React.useRef<HTMLVideoElement | null>(null);
  const audioNodeRef = React.useRef<HTMLAudioElement | null>(null);
  const hoverAutoplayStartedRef = React.useRef(false);
  const [isHoveringVideo, setIsHoveringVideo] = React.useState(false);
  const [isHoverVideoVisible, setIsHoverVideoVisible] = React.useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = React.useState(false);
  const [audioProgressRatio, setAudioProgressRatio] = React.useState(0);
  const [currentAudioTimeMs, setCurrentAudioTimeMs] = React.useState(0);
  const [resolvedAudioDurationMs, setResolvedAudioDurationMs] = React.useState<number | null>(
    item.durationMs ?? null
  );
  const isFailing = item.taskState === "fail";
  const isSelected = activeOutputId === item.id;
  const saveDisabled = item.saveState === "saving";
  const saveLabel = item.saveState === "failed" ? "Retry save" : "Save to media library";
  const canSaveReference = canSaveReferenceOutput(item);
  const canDownloadReference = canDownloadReferenceOutput(item);
  const shouldShowSaveAction = Boolean(
    onSaveToLibrary &&
    canSaveReference &&
    item.saveState !== "saved" &&
    (isPromptOnly || isImagePreview || isVideoPreview || isAudioPreview)
  );
  const shouldShowRerollAction = Boolean(onRerollOutput && isImagePreview && canRerollOutput(item));
  const shouldShowReferenceActionRow = Boolean(
    shouldShowSaveAction ||
    (onDownload && canDownloadReference && (isImagePreview || isVideoPreview || isAudioPreview))
  );
  const shouldShowNsfwPill = isProviderSafetyBlockedOutput(item);
  const canDragReference =
    Boolean(item.previewText) || (!!cardPreviewUrl && canDragReferenceOutput(item));
  const dragPreviewKind = isImagePreview ? "image" : isVideoPreview ? "video" : "text";
  const resolvedVideoPosterUrl = videoPosterUrl?.trim() || null;
  const resolvedHoverVideoUrl =
    hoverVideoUrl?.trim() ||
    (isVideoPreview && cardPreviewUrl && isVideoUrl(cardPreviewUrl) ? cardPreviewUrl : "") ||
    null;
  const hasPosterBackedVideoPreview = Boolean(
    item.mode === "video" && resolvedVideoPosterUrl && resolvedHoverVideoUrl
  );
  const shouldShowGeneratedVideoSurfaceByDefault = Boolean(
    item.mode === "video" &&
    item.mediaSource === "generated" &&
    !hasPosterBackedVideoPreview &&
    resolvedHoverVideoUrl
  );
  const shouldRenderVideoElement = Boolean(
    (isVideoPreview && resolvedHoverVideoUrl) || hasPosterBackedVideoPreview
  );
  const shouldRenderImageElement = Boolean(
    (isImagePreview && cardPreviewUrl) || hasPosterBackedVideoPreview
  );
  const shouldRenderAudioElement = Boolean(isAudioPreview && cardPreviewUrl);
  const primaryImageSrc = hasPosterBackedVideoPreview
    ? (resolvedVideoPosterUrl ?? undefined)
    : imageSrc;
  const primaryImageDataSrc = hasPosterBackedVideoPreview ? resolvedVideoPosterUrl : cardPreviewUrl;
  const dragImageSrc =
    dragPreviewKind === "image" || hasPosterBackedVideoPreview
      ? (primaryImageSrc ?? primaryImageDataSrc ?? undefined)
      : undefined;
  const saveIcon =
    item.saveState === "failed" ? (
      <ArrowClockwise size={16} weight="bold" aria-hidden />
    ) : (
      <FloppyDisk size={16} weight="bold" aria-hidden />
    );
  const storedAudioWaveformPeaks = React.useMemo(
    () => normalizeStoredWaveformPeaks(item.waveformPeaks, REFERENCE_GRID_AUDIO_WAVEFORM_BAR_COUNT),
    [item.waveformPeaks]
  );
  const fallbackAudioWaveformBars = React.useMemo(
    () =>
      buildFallbackWaveformPeaks(
        resolvedAudioDurationMs ? resolvedAudioDurationMs / 1000 : null,
        REFERENCE_GRID_AUDIO_WAVEFORM_BAR_COUNT
      ),
    [resolvedAudioDurationMs]
  );
  const [hasDecodedWaveform, setHasDecodedWaveform] = React.useState(
    storedAudioWaveformPeaks.length > 0
  );
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
          key: `${item.id}-wavebar-${index}`,
          height: normalizedHeight,
          progress,
          progressState,
        };
      }),
    [audioProgressRatio, audioWaveformBars, item.id]
  );

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isLoading || loadingVisual !== "hydrating") return;
    const hasRenderableMedia = Boolean(
      primaryImageSrc ?? primaryImageDataSrc ?? resolvedHoverVideoUrl ?? cardPreviewUrl
    );
    if (!hasRenderableMedia) return;
    // Some preview URLs never emit a terminal load/error event in the grid runtime.
    // Fail open so completed generations do not look indefinitely in-flight.
    const timeoutId = window.setTimeout(() => {
      markLoaded(item.id, { notifyAutoSave: false });
    }, HYDRATION_FALLBACK_LOADED_MS);
    return () => window.clearTimeout(timeoutId);
  }, [
    cardPreviewUrl,
    isLoading,
    item.id,
    loadingVisual,
    markLoaded,
    primaryImageDataSrc,
    primaryImageSrc,
    resolvedHoverVideoUrl,
  ]);

  React.useEffect(() => {
    setResolvedAudioDurationMs(item.durationMs ?? null);
  }, [item.durationMs, item.id]);

  React.useEffect(() => {
    setAudioProgressRatio(0);
    setCurrentAudioTimeMs(0);
  }, [item.id]);

  React.useEffect(() => {
    if (storedAudioWaveformPeaks.length > 0) {
      setHasDecodedWaveform(true);
      setAudioWaveformBars(storedAudioWaveformPeaks);
      return;
    }
    if (hasDecodedWaveform) return;
    setAudioWaveformBars(fallbackAudioWaveformBars);
  }, [fallbackAudioWaveformBars, hasDecodedWaveform, item.id, storedAudioWaveformPeaks]);

  React.useEffect(() => {
    if (!shouldRenderAudioElement || !cardPreviewUrl) return;
    if (storedAudioWaveformPeaks.length > 0) {
      setHasDecodedWaveform(true);
      return;
    }
    let cancelled = false;
    setHasDecodedWaveform(false);

    const decodeWaveform = async () => {
      const nextBars = await extractAudioWaveformPeaksFromUrl(
        cardPreviewUrl,
        REFERENCE_GRID_AUDIO_WAVEFORM_BAR_COUNT
      );
      if (!cancelled && Array.isArray(nextBars) && nextBars.length > 0) {
        setAudioWaveformBars(nextBars);
        setHasDecodedWaveform(true);
      }
    };

    void decodeWaveform();

    return () => {
      cancelled = true;
    };
  }, [cardPreviewUrl, shouldRenderAudioElement, storedAudioWaveformPeaks]);

  React.useEffect(
    () => () => {
      const node = audioNodeRef.current;
      if (!node) return;
      node.pause();
    },
    []
  );

  const handleAudioToggle = React.useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      onSelectOutput(item.id);
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
    [isAudioPlaying, item.id, onSelectOutput]
  );

  return (
    <div
      className={`reference-card ${cardPreviewUrl || resolvedVideoPosterUrl ? "has-preview" : ""} ${isVideoPreview || hasPosterBackedVideoPreview ? "has-video" : ""} ${isAudioPreview ? "has-audio" : ""} ${hasPosterBackedVideoPreview ? "has-video-poster" : ""} ${item.previewText ? "has-text" : ""} ${isSelected ? "is-active" : ""} ${isLoading ? "is-loading" : ""} ${isLinkedPromptReference ? "is-linked-prompt-ref" : ""}`}
      role="button"
      aria-busy={isLoading}
      data-loading={isLoading ? "true" : "false"}
      data-reference-authority-tier={authorityTier}
      data-drag-preview-url={cardPreviewUrl ?? undefined}
      data-drag-image-src={dragImageSrc}
      data-drag-preview-kind={dragPreviewKind}
      tabIndex={0}
      onClick={() => onSelectOutput(item.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelectOutput(item.id);
          return;
        }
        if (!onKeyboardReorderCurated) return;
        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
          event.preventDefault();
          onKeyboardReorderCurated(item.id, event.key === "ArrowUp" ? "up" : "down");
        }
      }}
      onDoubleClick={() => onOpenDetails(item.id)}
      draggable={canDragReference}
      onDragStart={(event) => {
        onCardDragStart(event, item, dragSourceSurface);
      }}
      onDragEnd={onCardDragEnd}
      onDragOver={onCardDragOver ? (event) => onCardDragOver(event, item) : undefined}
      onDrop={onCardDrop ? (event) => onCardDrop(event, item) : undefined}
      onDragEnter={onCardDragEnter ? (event) => onCardDragEnter(event, item) : undefined}
      onDragLeave={onCardDragLeave ? (event) => onCardDragLeave(event, item) : undefined}
      onPointerEnter={() => {
        if (!resolvedHoverVideoUrl) return;
        setIsHoveringVideo(true);
        const node = videoNodeRef.current;
        if (!node || !node.paused || node.ended) {
          hoverAutoplayStartedRef.current = false;
          return;
        }
        hoverAutoplayStartedRef.current = true;
        void node.play().catch(() => {
          hoverAutoplayStartedRef.current = false;
          setIsHoveringVideo(false);
        });
      }}
      onPointerLeave={() => {
        setIsHoveringVideo(false);
        if (!hoverAutoplayStartedRef.current || canAutoplayVideo) return;
        hoverAutoplayStartedRef.current = false;
        videoNodeRef.current?.pause();
      }}
    >
      {shouldRenderVideoElement ? (
        <video
          className={`reference-card-video ${hasPosterBackedVideoPreview ? "reference-card-video--poster-backed" : ""} ${isHoveringVideo || isHoverVideoVisible || shouldShowGeneratedVideoSurfaceByDefault ? "is-visible" : ""}`}
          ref={(node) => {
            videoNodeRef.current = node;
            registerVideoNode(videoNodeKey, item.id, node);
          }}
          src={resolvedHoverVideoUrl ?? undefined}
          autoPlay={canAutoplayVideo}
          muted
          loop
          playsInline
          preload={videoPreload}
          onLoadedData={() => markLoaded(item.id)}
          onError={() => {
            setIsHoveringVideo(false);
            setIsHoverVideoVisible(false);
            markLoaded(item.id, { notifyAutoSave: false });
          }}
          onPlay={() => {
            setIsHoverVideoVisible(true);
            onAutoplayStarted(item.id);
          }}
          onPause={() => {
            setIsHoverVideoVisible(false);
            onAutoplayStopped(item.id);
          }}
        />
      ) : null}
      {shouldRenderImageElement ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={primaryImageSrc}
            data-src={primaryImageDataSrc ?? undefined}
            alt=""
            className={`reference-card-image reference-card-image--cover ${hasPosterBackedVideoPreview ? "reference-card-image--poster" : ""} ${isHoveringVideo || isHoverVideoVisible ? "is-hidden" : ""}`}
            loading={imageLoading}
            decoding="async"
            {...(imageFetchPriority ? { fetchpriority: imageFetchPriority } : {})}
            onLoad={() => markLoaded(item.id)}
            onError={() => markLoaded(item.id, { notifyAutoSave: false })}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={primaryImageSrc}
            data-src={primaryImageDataSrc ?? undefined}
            alt=""
            aria-hidden="true"
            className={`reference-card-image reference-card-image--contain ${hasPosterBackedVideoPreview ? "reference-card-image--poster" : ""} ${isHoveringVideo || isHoverVideoVisible ? "is-hidden" : ""}`}
            loading={imageLoading}
            decoding="async"
            {...(imageFetchPriority ? { fetchpriority: imageFetchPriority } : {})}
          />
        </>
      ) : null}
      {shouldRenderAudioElement ? (
        <div className="reference-card-audio-shell">
          <div className="reference-card-audio-player">
            <div className="reference-card-audio-player-row">
              <button
                type="button"
                className={`reference-card-audio-play ${isAudioPlaying ? "is-playing" : ""}`}
                aria-label={isAudioPlaying ? "Pause audio preview" : "Play audio preview"}
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
            src={cardPreviewUrl ?? undefined}
            onLoadedMetadata={(event) => {
              const durationSeconds = event.currentTarget.duration;
              if (Number.isFinite(durationSeconds) && durationSeconds > 0) {
                setResolvedAudioDurationMs(Math.round(durationSeconds * 1000));
              }
              setCurrentAudioTimeMs(0);
              setAudioProgressRatio(0);
              markLoaded(item.id);
            }}
            onError={() => markLoaded(item.id, { notifyAutoSave: false })}
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
      ) : null}
      {isFailing ? (
        <div className="reference-fail-overlay">
          <div className="fail-icon" aria-hidden="true">
            !
          </div>
          {shouldShowNsfwPill ? (
            <span className="reference-fail-pill" aria-label="NSFW provider block">
              NSFW
            </span>
          ) : null}
          <div className="fail-title">
            {shouldShowNsfwPill ? EXPLICIT_CONTENT_FAILURE_TITLE : "Generation failed"}
          </div>
          {shouldShowNsfwPill ? (
            <div className="fail-subtitle">{EXPLICIT_CONTENT_FAILURE_DETAIL}</div>
          ) : item.errorMessageShort ? (
            <div className="fail-subtitle">
              {item.errorMessageShort.replace(/fal(\.ai)?/gi, "the provider")}
            </div>
          ) : item.errorMessage ? (
            <div className="fail-subtitle">
              {item.errorMessage.replace(/fal(\.ai)?/gi, "the provider")}
            </div>
          ) : null}
          {canRetryStatus && isSelected ? (
            <button
              type="button"
              className="reference-status-retry-btn"
              onClick={(event) => {
                event.stopPropagation();
                onSelectOutput(item.id);
                onRetryStatus?.(item);
              }}
            >
              Retry status
            </button>
          ) : null}
        </div>
      ) : null}
      {loadingVisual !== "none" ? (
        <div className="reference-loading">
          <div className="reference-spinner" />
        </div>
      ) : null}
      {isLoading && canRetryStatus && isSelected ? (
        <button
          type="button"
          className="reference-status-retry-btn reference-status-retry-btn--loading"
          onClick={(event) => {
            event.stopPropagation();
            onSelectOutput(item.id);
            onRetryStatus?.(item);
          }}
        >
          Retry status
        </button>
      ) : null}
      {isLinkedPromptReference ? (
        <span className="reference-card-link-dot" aria-hidden="true" />
      ) : null}
      {renderSaveChip(item, isSelected)}
      {isFailing && onDeleteOutput && isSelected ? (
        <div className="reference-card-actions" aria-label="Reference actions">
          <button
            type="button"
            className="reference-card-action-btn reference-card-action-btn--danger"
            aria-label="Remove error from grid"
            onClick={(event) => {
              event.stopPropagation();
              onDeleteOutput(item.id);
            }}
          >
            <X size={16} weight="bold" aria-hidden />
          </button>
        </div>
      ) : null}
      {showCuratedRemoveAction && onRemoveCuratedReference && isSelected ? (
        <div className="reference-card-actions" aria-label="Curated actions">
          {onDownload &&
          canDownloadReference &&
          (isImagePreview || isVideoPreview || isAudioPreview) ? (
            <button
              type="button"
              className="reference-card-action-btn"
              aria-label="Download reference"
              onClick={(event) => {
                event.stopPropagation();
                onSelectOutput(item.id);
                onDownload(item);
              }}
            >
              <DownloadSimple size={16} weight="bold" aria-hidden />
            </button>
          ) : null}
          <button
            type="button"
            className="reference-card-action-btn reference-card-action-btn--danger"
            aria-label="Remove from curated"
            onClick={(event) => {
              event.stopPropagation();
              onRemoveCuratedReference(item.id);
            }}
          >
            <X size={16} weight="bold" aria-hidden />
          </button>
        </div>
      ) : null}
      {!hideReferenceActions && shouldShowRerollAction ? (
        <button
          type="button"
          className="reference-card-action-btn reference-card-reroll-btn"
          aria-label="Re-roll image"
          onClick={(event) => {
            event.stopPropagation();
            onSelectOutput(item.id);
            onRerollOutput?.(item);
          }}
        >
          <ArrowClockwise size={16} weight="bold" aria-hidden />
        </button>
      ) : null}
      {!hideReferenceActions && shouldShowReferenceActionRow ? (
        <div className="reference-card-actions" aria-label="Reference actions">
          {shouldShowSaveAction ? (
            <button
              type="button"
              className="reference-card-action-btn"
              aria-label={saveLabel}
              disabled={saveDisabled}
              onClick={(event) => {
                event.stopPropagation();
                onSelectOutput(item.id);
                onSaveToLibrary?.(item);
              }}
            >
              {saveIcon}
            </button>
          ) : null}
          {onDownload &&
          canDownloadReference &&
          (isImagePreview || isVideoPreview || isAudioPreview) ? (
            <button
              type="button"
              className="reference-card-action-btn"
              aria-label="Download reference"
              onClick={(event) => {
                event.stopPropagation();
                onSelectOutput(item.id);
                onDownload(item);
              }}
            >
              <DownloadSimple size={16} weight="bold" aria-hidden />
            </button>
          ) : null}
          {onDeleteOutput ? (
            <button
              type="button"
              className="reference-card-action-btn reference-card-action-btn--danger"
              aria-label="Remove reference from grid"
              onClick={(event) => {
                event.stopPropagation();
                onDeleteOutput(item.id);
              }}
            >
              <X size={16} weight="bold" aria-hidden />
            </button>
          ) : null}
        </div>
      ) : null}
      {item.previewText ? <div className="reference-card-text">{item.previewText}</div> : null}
    </div>
  );
});
