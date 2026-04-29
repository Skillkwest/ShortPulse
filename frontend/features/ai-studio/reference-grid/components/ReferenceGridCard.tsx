/**
 * Presentational card for a single reference-grid item.
 * Keeps render and card-level interaction wiring isolated from ReferenceGrid orchestration.
 */
import React from "react";
import { ArrowClockwise, CheckCircle, DownloadSimple, FloppyDisk, X } from "phosphor-react";
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
import type { ReferenceDragSourceSurface } from "../../utils/dragDrop";
import type { StudioOutput } from "../../types";
import { ReferenceAudioPlayer } from "../../components/shared/ReferenceAudioPlayer";

const HYDRATION_FALLBACK_LOADED_MS = 1500;

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
  onClearGenerationOutput?: (id: string) => void;
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
  onClearGenerationOutput,
  onRemoveCuratedReference,
  showCuratedRemoveAction = false,
  onSaveToLibrary,
  onDownload,
  hideReferenceActions = false,
}: ReferenceGridCardProps) {
  const videoNodeRef = React.useRef<HTMLVideoElement | null>(null);
  const hoverAutoplayStartedRef = React.useRef(false);
  const [isHoveringVideo, setIsHoveringVideo] = React.useState(false);
  const [isHoverVideoVisible, setIsHoverVideoVisible] = React.useState(false);
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
  const hasVideoPosterPreview = Boolean(item.mode === "video" && resolvedVideoPosterUrl);
  const hasPosterBackedVideoPreview = Boolean(hasVideoPosterPreview && resolvedHoverVideoUrl);
  const shouldShowGeneratedVideoSurfaceByDefault = Boolean(
    item.mode === "video" &&
    item.mediaSource === "generated" &&
    !hasVideoPosterPreview &&
    resolvedHoverVideoUrl
  );
  const shouldRenderVideoElement = Boolean(
    (isVideoPreview && resolvedHoverVideoUrl) || hasPosterBackedVideoPreview
  );
  const shouldRenderImageElement = Boolean(
    (isImagePreview && cardPreviewUrl) || hasVideoPosterPreview
  );
  const audioPreviewUrl = isAudioPreview ? (cardPreviewUrl?.trim() ?? "") : "";
  const shouldRenderAudioElement = Boolean(audioPreviewUrl);
  const primaryImageSrc = hasVideoPosterPreview ? (resolvedVideoPosterUrl ?? undefined) : imageSrc;
  const primaryImageDataSrc = hasVideoPosterPreview ? resolvedVideoPosterUrl : cardPreviewUrl;
  const dragImageSrc =
    dragPreviewKind === "image" || hasVideoPosterPreview
      ? (primaryImageSrc ?? primaryImageDataSrc ?? undefined)
      : undefined;
  const saveIcon =
    item.saveState === "failed" ? (
      <ArrowClockwise size={16} weight="bold" aria-hidden />
    ) : (
      <FloppyDisk size={16} weight="bold" aria-hidden />
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

  return (
    <div
      className={`reference-card ${cardPreviewUrl || resolvedVideoPosterUrl ? "has-preview" : ""} ${isVideoPreview || hasVideoPosterPreview ? "has-video" : ""} ${isAudioPreview ? "has-audio" : ""} ${hasVideoPosterPreview ? "has-video-poster" : ""} ${item.previewText ? "has-text" : ""} ${isSelected ? "is-active" : ""} ${isLoading ? "is-loading" : ""} ${isLinkedPromptReference ? "is-linked-prompt-ref" : ""}`}
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
            className={`reference-card-image reference-card-image--cover ${hasVideoPosterPreview ? "reference-card-image--poster" : ""} ${isHoveringVideo || isHoverVideoVisible ? "is-hidden" : ""}`}
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
            className={`reference-card-image reference-card-image--contain ${hasVideoPosterPreview ? "reference-card-image--poster" : ""} ${isHoveringVideo || isHoverVideoVisible ? "is-hidden" : ""}`}
            loading={imageLoading}
            decoding="async"
            {...(imageFetchPriority ? { fetchpriority: imageFetchPriority } : {})}
          />
        </>
      ) : null}
      {shouldRenderAudioElement ? (
        <ReferenceAudioPlayer
          audioId={item.id}
          audioUrl={audioPreviewUrl}
          durationMs={item.durationMs ?? null}
          waveformPeaks={item.waveformPeaks ?? null}
          playLabel="Play audio preview"
          pauseLabel="Pause audio preview"
          onActivate={() => onSelectOutput(item.id)}
          onReady={() => markLoaded(item.id)}
          onError={() => markLoaded(item.id, { notifyAutoSave: false })}
          eagerWaveformDecode
        />
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
          {onClearGenerationOutput ? (
            <button
              type="button"
              className="reference-card-action-btn reference-card-action-btn--danger reference-loading-clear-btn"
              aria-label="Clear generation from grid"
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onClearGenerationOutput(item.id);
              }}
            >
              <X size={16} weight="bold" aria-hidden />
            </button>
          ) : null}
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
