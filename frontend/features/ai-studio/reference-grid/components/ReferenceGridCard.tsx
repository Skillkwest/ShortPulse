/**
 * Presentational card for a single reference-grid item.
 * Keeps render and card-level interaction wiring isolated from ReferenceGrid orchestration.
 */
import React from "react";
import { ArrowClockwise, CheckCircle, DownloadSimple, FloppyDisk, X } from "phosphor-react";
import { canRerollOutput } from "../../logic/generationReplay";
import { canDragReferenceOutput } from "../../logic/referenceOutputAuthority";
import {
  canDownloadReferenceOutput,
  canSaveReferenceOutput,
} from "../../logic/referenceActionAvailability";
import { formatPerfAuditDebugLine, isPerfAuditRuntimeEnabled } from "../../logic/perfAuditDebug";
import type { ReferenceGridMediaAuthorityTier } from "../../logic/referenceGridMedia";
import type { ReferenceComposerImageDragArtifact } from "../../utils/dragDrop";
import {
  EXPLICIT_CONTENT_FAILURE_DETAIL,
  EXPLICIT_CONTENT_FAILURE_TITLE,
} from "../../../../lib/explicitContentFailure";
import { normalizeCustomerFacingProviderError } from "../../../../lib/customerFacingProviderText";
import { isProviderSafetyBlockedOutput } from "../../hooks/taskPolling/providerStatusPolicy";
import type { ReferenceDragSourceSurface } from "../../utils/dragDrop";
import type { StudioOutput } from "../../types";
import { MediaDurationBadge } from "../../components/shared/MediaDurationBadge";
import { ReferenceAudioPlayer } from "../../components/shared/ReferenceAudioPlayer";

const HYDRATION_FALLBACK_LOADED_MS = 1500;
const GENERIC_FAILURE_MESSAGES = new Set([
  "generation failed",
  "invalid request",
  "request failed",
]);

const normalizeFailureCopy = (value: string | null | undefined): string =>
  (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");

const resolveReferenceFailureSubtitle = (item: StudioOutput): string | null => {
  const shortMessage = item.errorMessageShort?.trim() ?? "";
  const detail = item.errorDetail?.trim() ?? "";
  const message = item.errorMessage?.trim() ?? "";
  if (shortMessage && !GENERIC_FAILURE_MESSAGES.has(normalizeFailureCopy(shortMessage))) {
    return normalizeCustomerFacingProviderError(shortMessage, shortMessage);
  }
  if (detail) return normalizeCustomerFacingProviderError(detail, detail);
  if (shortMessage) return normalizeCustomerFacingProviderError(shortMessage, shortMessage);
  if (message) return normalizeCustomerFacingProviderError(message, message);
  return null;
};

export type ReferenceGridCardProps = {
  item: StudioOutput;
  authorityTier: ReferenceGridMediaAuthorityTier;
  dragSourceSurface: ReferenceDragSourceSurface;
  videoNodeKey: string;
  audioInstanceKey?: string;
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
  videoPreload: "auto" | "metadata" | "none";
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
    sourceSurface: ReferenceDragSourceSurface,
    composerImageArtifact?: ReferenceComposerImageDragArtifact | null
  ) => void;
  composerImageArtifact?: ReferenceComposerImageDragArtifact | null;
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
  onRequestAudioPlay?: (player: { instanceKey: string; pause: () => void }) => void;
  onAudioPlaybackStarted?: (player: { instanceKey: string; pause: () => void }) => void;
  onAudioPlaybackStopped?: (instanceKey: string) => void;
  onRetryStatus?: (output: StudioOutput) => void;
  onRerollOutput?: (output: StudioOutput) => void;
  onDeleteOutput?: (id: string) => void;
  onClearGenerationOutput?: (id: string) => void;
  onRemoveCuratedReference?: (id: string) => void;
  showCuratedRemoveAction?: boolean;
  isMediaStorageFull?: boolean;
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
        : item.saveState === "blocked_storage"
          ? "Storage full"
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
  audioInstanceKey,
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
  composerImageArtifact,
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
  onRequestAudioPlay,
  onAudioPlaybackStarted,
  onAudioPlaybackStopped,
  onRetryStatus,
  onRerollOutput,
  onDeleteOutput,
  onClearGenerationOutput,
  onRemoveCuratedReference,
  showCuratedRemoveAction = false,
  isMediaStorageFull = false,
  onSaveToLibrary,
  onDownload,
  hideReferenceActions = false,
}: ReferenceGridCardProps) {
  const videoNodeRef = React.useRef<HTMLVideoElement | null>(null);
  const hoverAutoplayStartedRef = React.useRef(false);
  const [isHoveringVideo, setIsHoveringVideo] = React.useState(false);
  const [isHoverVideoVisible, setIsHoverVideoVisible] = React.useState(false);
  const [hasPosterImageError, setHasPosterImageError] = React.useState(false);
  const isFailing = item.taskState === "fail";
  const isSelected = activeOutputId === item.id;
  const saveDisabled =
    isMediaStorageFull || item.saveState === "saving" || item.saveState === "saved";
  const saveLabel = isMediaStorageFull
    ? "Storage full"
    : item.saveState === "failed" || item.saveState === "blocked_storage"
      ? "Retry save"
      : "Save to media library";
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
  const resolvedFailureSubtitle = isFailing ? resolveReferenceFailureSubtitle(item) : null;
  const canDragReference =
    Boolean(item.previewText) || (!!cardPreviewUrl && canDragReferenceOutput(item));
  const dragPreviewKind = isImagePreview ? "image" : isVideoPreview ? "video" : "text";
  const resolvedVideoPosterUrl = videoPosterUrl?.trim() || null;
  const resolvedHoverVideoUrl =
    hoverVideoUrl?.trim() || (isVideoPreview ? cardPreviewUrl?.trim() : "") || null;
  const hasVideoPosterPreview = Boolean(item.mode === "video" && resolvedVideoPosterUrl);
  const hasPosterBackedVideoPreview = Boolean(hasVideoPosterPreview && resolvedHoverVideoUrl);
  const shouldPreferVideoSurfaceByDefault = Boolean(
    item.mode === "video" &&
    resolvedHoverVideoUrl &&
    (!hasVideoPosterPreview || hasPosterImageError)
  );
  const shouldRenderVideoElement = Boolean(
    (isVideoPreview && resolvedHoverVideoUrl) || hasPosterBackedVideoPreview
  );
  const shouldRenderImageElement = Boolean(
    (isImagePreview && cardPreviewUrl) || (hasVideoPosterPreview && !hasPosterImageError)
  );
  const audioPreviewUrl = isAudioPreview ? (cardPreviewUrl?.trim() ?? "") : "";
  const shouldRenderAudioElement = Boolean(audioPreviewUrl);
  const primaryImageSrc = hasVideoPosterPreview ? (resolvedVideoPosterUrl ?? undefined) : imageSrc;
  const primaryImageDataSrc = hasVideoPosterPreview ? resolvedVideoPosterUrl : cardPreviewUrl;
  const dragImageSrc =
    dragPreviewKind === "image" || hasVideoPosterPreview
      ? (primaryImageSrc ?? primaryImageDataSrc ?? undefined)
      : undefined;
  const videoDurationMediaUrl =
    item.mode === "video"
      ? (resolvedHoverVideoUrl ?? item.resultUrls?.[0] ?? item.previewUrl ?? cardPreviewUrl ?? null)
      : null;
  const showPerfAuditDebug = isPerfAuditRuntimeEnabled();
  const perfAuditDebugLabel = React.useMemo(
    () =>
      [
        formatPerfAuditDebugLine("img", primaryImageSrc ?? primaryImageDataSrc ?? null),
        formatPerfAuditDebugLine(
          "drag",
          composerImageArtifact?.displayArtifactUrl ?? dragImageSrc ?? null
        ),
      ].join(" | "),
    [composerImageArtifact?.displayArtifactUrl, dragImageSrc, primaryImageDataSrc, primaryImageSrc]
  );

  React.useEffect(() => {
    setHasPosterImageError(false);
  }, [item.id, resolvedVideoPosterUrl]);

  const startHoverPlayback = React.useCallback(() => {
    if (!resolvedHoverVideoUrl) return;
    setIsHoveringVideo(true);
    const node = videoNodeRef.current;
    if (!node) {
      hoverAutoplayStartedRef.current = false;
      return;
    }
    node.muted = true;
    node.playsInline = true;
    if (!node.currentSrc && node.readyState === HTMLMediaElement.HAVE_NOTHING) {
      node.load();
    }
    if (node.ended) {
      try {
        node.currentTime = 0;
      } catch {
        // Ignore seek failures for providers that expose non-seekable preview responses.
      }
    }
    if (!node.paused) {
      hoverAutoplayStartedRef.current = true;
      setIsHoverVideoVisible(true);
      onAutoplayStarted(item.id);
      return;
    }
    if (hoverAutoplayStartedRef.current) return;
    hoverAutoplayStartedRef.current = true;
    void node.play().catch(() => {
      hoverAutoplayStartedRef.current = false;
      setIsHoveringVideo(false);
      setIsHoverVideoVisible(false);
    });
  }, [item.id, onAutoplayStarted, resolvedHoverVideoUrl]);
  const stopHoverPlayback = React.useCallback(() => {
    setIsHoveringVideo(false);
    if (!hoverAutoplayStartedRef.current || canAutoplayVideo) return;
    hoverAutoplayStartedRef.current = false;
    videoNodeRef.current?.pause();
  }, [canAutoplayVideo]);
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
        onCardDragStart(event, item, dragSourceSurface, composerImageArtifact);
      }}
      onDragEnd={onCardDragEnd}
      onDragOver={onCardDragOver ? (event) => onCardDragOver(event, item) : undefined}
      onDrop={onCardDrop ? (event) => onCardDrop(event, item) : undefined}
      onDragEnter={onCardDragEnter ? (event) => onCardDragEnter(event, item) : undefined}
      onDragLeave={onCardDragLeave ? (event) => onCardDragLeave(event, item) : undefined}
      onPointerEnter={startHoverPlayback}
      onMouseEnter={startHoverPlayback}
      onPointerLeave={stopHoverPlayback}
      onMouseLeave={stopHoverPlayback}
    >
      {shouldRenderVideoElement ? (
        <video
          className={`reference-card-video ${hasPosterBackedVideoPreview ? "reference-card-video--poster-backed" : ""} ${isHoveringVideo || isHoverVideoVisible || shouldPreferVideoSurfaceByDefault ? "is-visible" : ""}`}
          draggable={false}
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
          onLoadedData={() => {
            markLoaded(item.id);
            if (isHoveringVideo && videoNodeRef.current?.paused) {
              startHoverPlayback();
            }
          }}
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
        >
          {resolvedHoverVideoUrl ? <source src={resolvedHoverVideoUrl} /> : null}
        </video>
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
            onError={() => {
              if (hasVideoPosterPreview) {
                setHasPosterImageError(true);
              }
              markLoaded(item.id, { notifyAutoSave: false });
            }}
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
          audioInstanceKey={audioInstanceKey}
          backgroundImageUrl={item.companionArtUrl ?? null}
          durationMs={item.durationMs ?? null}
          waveformPeaks={item.waveformPeaks ?? null}
          playLabel="Play audio preview"
          pauseLabel="Pause audio preview"
          onActivate={() => onSelectOutput(item.id)}
          onReady={() => markLoaded(item.id)}
          onError={() => markLoaded(item.id, { notifyAutoSave: false })}
          eagerWaveformDecode
          onRequestPlay={onRequestAudioPlay}
          onPlaybackStarted={onAudioPlaybackStarted}
          onPlaybackStopped={onAudioPlaybackStopped}
        />
      ) : null}
      {item.mode === "video" ? (
        <MediaDurationBadge
          className="reference-card-media-duration"
          durationMs={item.durationMs ?? null}
          mediaUrl={videoDurationMediaUrl}
          mediaKind="video"
        />
      ) : null}
      {isFailing ? (
        <div className="reference-fail-overlay">
          <div className="fail-icon" aria-hidden="true">
            !
          </div>
          {shouldShowNsfwPill ? (
            <span className="reference-fail-pill" aria-label="NSFW content block">
              NSFW
            </span>
          ) : null}
          <div className="fail-title">
            {shouldShowNsfwPill ? EXPLICIT_CONTENT_FAILURE_TITLE : "Generation failed"}
          </div>
          {shouldShowNsfwPill ? (
            <div className="fail-subtitle">{EXPLICIT_CONTENT_FAILURE_DETAIL}</div>
          ) : resolvedFailureSubtitle ? (
            <div className="fail-subtitle">{resolvedFailureSubtitle}</div>
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
      {showPerfAuditDebug ? (
        <div
          aria-label={perfAuditDebugLabel}
          style={{
            position: "absolute",
            left: 4,
            right: 4,
            bottom: 4,
            zIndex: 4,
            padding: "3px 4px",
            borderRadius: 4,
            background: "rgba(8, 11, 16, 0.88)",
            color: "#b9f3ff",
            fontSize: 8,
            lineHeight: 1.25,
            fontFamily: "monospace",
            wordBreak: "break-all",
            pointerEvents: "none",
          }}
        >
          {perfAuditDebugLabel}
        </div>
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
