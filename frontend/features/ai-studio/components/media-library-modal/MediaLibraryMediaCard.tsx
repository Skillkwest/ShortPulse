/**
 * Shared Media Library media-card primitives.
 * Keeps image/video/audio card behavior aligned across modal, panel, Elements, and Character grids.
 */
import React from "react";
import { ArrowClockwise, CheckCircle, DownloadSimple, TrashSimple, X } from "phosphor-react";
import { resolveDurablePreviewStoragePath } from "../../../../lib/mediaPreviewPath";
import { resolveMediaRowKind } from "../../../../lib/mediaRowKind";
import { canRerollMediaLibraryWorkflow } from "../../logic/mediaLibraryWorkflowReload";
import { isVideoUrl } from "../../logic/stateParsers";
import { MediaDurationBadge } from "../shared/MediaDurationBadge";
import { ReferenceAudioPlayer } from "../shared/ReferenceAudioPlayer";
import {
  isAudioFile,
  resolveMediaAudioPresentation,
  resolveMediaMetadataAudioSourceMode,
  resolveMediaMetadataDisplayTitle,
  resolveMediaMetadataDurationMs,
  resolveMediaMetadataWaveformPeaks,
  type MediaCardRefCallback,
  type MediaFileRow,
} from "../../logic/mediaLibraryModalModel";

export type MediaLibraryMediaDragPreview = {
  hoverVideoUrl?: string | null;
  posterPreviewUrl?: string | null;
  aspectRatio?: number | null;
};

type MediaLibraryCardActionLabels = {
  actionAriaLabel: string;
  downloadLabel: string;
  rerollLabel: string;
  removeLabel: string;
  deleteLabel: string;
};

type MediaLibraryCardActionsProps = {
  file: MediaFileRow;
  canShowDownloadAction: boolean;
  canShowRerollAction: boolean;
  canShowRemoveAction: boolean;
  canShowDeleteAction: boolean;
  labels: MediaLibraryCardActionLabels;
  dangerActionMode: "separate" | "exclusive";
  onDownloadMediaFile?: (file: MediaFileRow) => void;
  onRerollWorkflowFromMedia?: (file: MediaFileRow) => void;
  onRemoveMediaFromFolder?: (file: MediaFileRow) => void;
  onDeleteMediaFromLibrary?: (file: MediaFileRow) => void;
};

type SharedMediaCardProps = {
  file: MediaFileRow;
  isSelected: boolean;
  previewAspectRatio: number;
  cardPreviewUrl: string | null;
  fetchPriorityAttr: "high" | "auto";
  getMediaCardRef: (fileId: string) => MediaCardRefCallback;
  onSelectMediaFile: (file: MediaFileRow) => void;
  onMediaDoubleClick?: (file: MediaFileRow) => void;
  onMediaDragStart?: (
    event: React.DragEvent<HTMLElement>,
    file: MediaFileRow,
    preview?: MediaLibraryMediaDragPreview
  ) => void;
  onMediaDragEnd?: (event: React.DragEvent<HTMLElement>, file: MediaFileRow) => void;
  onToggleMediaSelection?: (file: MediaFileRow) => void;
  onMediaContextMenu?: (event: React.MouseEvent<HTMLElement>, file: MediaFileRow) => void;
  onMediaPreviewError: (file: MediaFileRow, failedUrl?: string | null) => void;
  onSignedUrlLoaded: (id: string) => void;
  onRequestSignedUrl?: (file: MediaFileRow) => Promise<string | null>;
  cacheAspectRatio: (id: string, ratio: number) => void;
  showCardActions: boolean;
  canShowDownloadAction: boolean;
  canShowRerollAction: boolean;
  canShowRemoveAction: boolean;
  canShowDeleteAction: boolean;
  actionLabels: MediaLibraryCardActionLabels;
  dangerActionMode: "separate" | "exclusive";
  onDownloadMediaFile?: (file: MediaFileRow) => void;
  onRerollWorkflowFromMedia?: (file: MediaFileRow) => void;
  onRemoveMediaFromFolder?: (file: MediaFileRow) => void;
  onDeleteMediaFromLibrary?: (file: MediaFileRow) => void;
  shellStyle?: React.CSSProperties;
  setAriaPressedWithoutSelectionMode?: boolean;
};

type MediaLibraryAudioCardProps = SharedMediaCardProps & {
  dragPreview?: MediaLibraryMediaDragPreview;
};

type MediaLibraryVisualMediaCardProps = SharedMediaCardProps & {
  variant: "mixed-feed" | "media-grid";
  hoverVideoUrl?: string | null;
  posterPreviewUrl?: string | null;
  adaptivePressureLevel: 0 | 1 | 2;
  onMediaPaint: (assetKind: "image" | "video") => void;
  dragPreview?: MediaLibraryMediaDragPreview;
  shouldRenderVideoPreview?: boolean;
  managedVideoSrc?: string | null;
  autoPlayEnabled?: boolean;
  getVideoNodeRef?: (id: string) => (node: HTMLVideoElement | null) => void;
};

export const resolveMediaLibraryCardDisplayLabel = (file: MediaFileRow): string =>
  ((isAudioFile(file.file_type)
    ? resolveMediaAudioPresentation(file).displayTitle
    : resolveMediaMetadataDisplayTitle(file.metadata)) ??
    file.filename) ||
  "media";

export const buildMediaLibraryCardActionLabels = (
  file: MediaFileRow,
  {
    actionAriaLabel,
    downloadLabelPrefix,
    removeLabel,
    deleteLabel,
  }: {
    actionAriaLabel: string;
    downloadLabelPrefix: string;
    removeLabel: string;
    deleteLabel: string;
  }
): MediaLibraryCardActionLabels => ({
  actionAriaLabel,
  downloadLabel: `${downloadLabelPrefix} ${resolveMediaLibraryCardDisplayLabel(file)}`,
  rerollLabel: `Re-roll ${resolveMediaLibraryCardDisplayLabel(file)}`,
  removeLabel,
  deleteLabel,
});

const resolveMediaLibraryVideoDurationProbeUrl = (file: MediaFileRow): string | null => {
  if (resolveMediaRowKind(file) !== "video") return null;
  const signedUrl = file.signedUrl?.trim() ?? "";
  if (!signedUrl || !isVideoUrl(signedUrl)) return null;

  const storagePath = file.storage_path?.trim() ?? "";
  const previewStoragePath = file.preview_storage_path?.trim() ?? "";
  const durablePreviewPath = resolveDurablePreviewStoragePath(file)?.trim() ?? "";
  const hasSeparatePreviewStoragePath = Boolean(
    storagePath && previewStoragePath && previewStoragePath !== storagePath
  );
  const hasSeparateDurablePreviewPath = Boolean(
    storagePath && durablePreviewPath && durablePreviewPath !== storagePath
  );

  return hasSeparatePreviewStoragePath || hasSeparateDurablePreviewPath ? null : signedUrl;
};

/**
 * Renders the hover action row used by Media Library media cards.
 */
export function MediaLibraryCardActions({
  file,
  canShowDownloadAction,
  canShowRerollAction,
  canShowRemoveAction,
  canShowDeleteAction,
  labels,
  dangerActionMode,
  onDownloadMediaFile,
  onRerollWorkflowFromMedia,
  onRemoveMediaFromFolder,
  onDeleteMediaFromLibrary,
}: MediaLibraryCardActionsProps) {
  const showExclusiveDangerAction =
    dangerActionMode === "exclusive" && (canShowRemoveAction || canShowDeleteAction);
  const shouldShowTopActions =
    canShowDownloadAction ||
    (dangerActionMode === "separate" && (canShowRemoveAction || canShowDeleteAction)) ||
    showExclusiveDangerAction;
  return (
    <>
      {shouldShowTopActions ? (
        <div className="media-library-panel-card-actions" aria-label={labels.actionAriaLabel}>
          {canShowDownloadAction ? (
            <button
              type="button"
              className="reference-card-action-btn media-library-panel-card-download-btn"
              aria-label={labels.downloadLabel}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onDownloadMediaFile?.(file);
              }}
            >
              <DownloadSimple size={16} weight="bold" aria-hidden />
            </button>
          ) : null}
          {dangerActionMode === "separate" && canShowRemoveAction ? (
            <button
              type="button"
              className="reference-card-action-btn reference-card-action-btn--danger media-library-panel-card-remove-btn"
              aria-label={labels.removeLabel}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onRemoveMediaFromFolder?.(file);
              }}
            >
              <X size={16} weight="bold" aria-hidden />
            </button>
          ) : null}
          {dangerActionMode === "separate" && canShowDeleteAction ? (
            <button
              type="button"
              className="reference-card-action-btn reference-card-action-btn--danger media-library-panel-card-remove-btn"
              aria-label={labels.deleteLabel}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onDeleteMediaFromLibrary?.(file);
              }}
            >
              <TrashSimple size={16} weight="bold" aria-hidden />
            </button>
          ) : null}
          {showExclusiveDangerAction ? (
            <button
              type="button"
              className="reference-card-action-btn reference-card-action-btn--danger media-library-panel-card-remove-btn"
              aria-label={canShowDeleteAction ? labels.deleteLabel : labels.removeLabel}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (canShowDeleteAction) {
                  onDeleteMediaFromLibrary?.(file);
                  return;
                }
                onRemoveMediaFromFolder?.(file);
              }}
            >
              {canShowDeleteAction ? (
                <TrashSimple size={16} weight="bold" aria-hidden />
              ) : (
                <X size={16} weight="bold" aria-hidden />
              )}
            </button>
          ) : null}
        </div>
      ) : null}
      {canShowRerollAction ? (
        <div
          className="media-library-panel-card-actions media-library-panel-card-actions--workflow"
          aria-label="Media replay actions"
        >
          <button
            type="button"
            className="reference-card-action-btn reference-card-reroll-btn media-library-panel-card-reroll-btn"
            aria-label={labels.rerollLabel}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onRerollWorkflowFromMedia?.(file);
            }}
          >
            <ArrowClockwise size={16} weight="bold" aria-hidden />
          </button>
        </div>
      ) : null}
    </>
  );
}

const renderSelectionToggle = ({
  file,
  isSelected,
  mediaKind,
  onToggleMediaSelection,
}: {
  file: MediaFileRow;
  isSelected: boolean;
  mediaKind: "media" | "audio";
  onToggleMediaSelection?: (file: MediaFileRow) => void;
}) => {
  if (!onToggleMediaSelection || !isSelected) return null;
  return (
    <button
      type="button"
      className={`media-library-panel-selection-toggle${isSelected ? " is-selected" : ""}`}
      aria-label={
        isSelected
          ? `Deselect ${file.filename || mediaKind}`
          : `Select ${file.filename || mediaKind}`
      }
      aria-pressed={isSelected}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggleMediaSelection(file);
      }}
    >
      {isSelected ? <CheckCircle size={16} weight="fill" aria-hidden /> : null}
    </button>
  );
};

const renderCardActions = ({
  file,
  showCardActions,
  canShowDownloadAction,
  canShowRerollAction,
  canShowRemoveAction,
  canShowDeleteAction,
  actionLabels,
  dangerActionMode,
  onDownloadMediaFile,
  onRerollWorkflowFromMedia,
  onRemoveMediaFromFolder,
  onDeleteMediaFromLibrary,
}: Pick<
  SharedMediaCardProps,
  | "file"
  | "showCardActions"
  | "canShowDownloadAction"
  | "canShowRerollAction"
  | "canShowRemoveAction"
  | "canShowDeleteAction"
  | "actionLabels"
  | "dangerActionMode"
  | "onDownloadMediaFile"
  | "onRerollWorkflowFromMedia"
  | "onRemoveMediaFromFolder"
  | "onDeleteMediaFromLibrary"
>) =>
  showCardActions ? (
    <MediaLibraryCardActions
      file={file}
      canShowDownloadAction={canShowDownloadAction}
      canShowRerollAction={canShowRerollAction}
      canShowRemoveAction={canShowRemoveAction}
      canShowDeleteAction={canShowDeleteAction}
      labels={actionLabels}
      dangerActionMode={dangerActionMode}
      onDownloadMediaFile={onDownloadMediaFile}
      onRerollWorkflowFromMedia={onRerollWorkflowFromMedia}
      onRemoveMediaFromFolder={onRemoveMediaFromFolder}
      onDeleteMediaFromLibrary={onDeleteMediaFromLibrary}
    />
  ) : null;

/**
 * Renders an audio media card with shared selection, drag, and action behavior.
 */
export function MediaLibraryAudioCard({
  file,
  isSelected,
  previewAspectRatio,
  cardPreviewUrl,
  getMediaCardRef,
  onSelectMediaFile,
  onMediaDoubleClick,
  onMediaDragStart,
  onMediaDragEnd,
  onToggleMediaSelection,
  onMediaContextMenu,
  onMediaPreviewError,
  onSignedUrlLoaded,
  onRequestSignedUrl,
  showCardActions,
  canShowDownloadAction,
  canShowRerollAction,
  canShowRemoveAction,
  canShowDeleteAction,
  actionLabels,
  dangerActionMode,
  onDownloadMediaFile,
  onRerollWorkflowFromMedia,
  onRemoveMediaFromFolder,
  onDeleteMediaFromLibrary,
  shellStyle,
  setAriaPressedWithoutSelectionMode = false,
  dragPreview,
}: MediaLibraryAudioCardProps) {
  const audioUrl = cardPreviewUrl ?? file.signedUrl ?? null;
  const signedUrlLoadedRef = React.useRef(false);
  const audioSourceMode = resolveMediaMetadataAudioSourceMode(file.metadata);
  const audioPresentation = resolveMediaAudioPresentation(file);
  const audioLabel = audioPresentation.displayTitle ?? file.filename ?? "media";
  const displayTitle = audioPresentation.displayTitle;
  const durationMs = resolveMediaMetadataDurationMs(file.metadata, { fileType: file.file_type });
  const shouldSetAriaPressed =
    Boolean(onToggleMediaSelection) || setAriaPressedWithoutSelectionMode;
  const audioCardLabel = `${
    onToggleMediaSelection && isSelected ? "Deselect" : "Select"
  } audio ${audioLabel}`;

  const markSignedUrlLoaded = React.useCallback(() => {
    if (signedUrlLoadedRef.current) return;
    signedUrlLoadedRef.current = true;
    onSignedUrlLoaded(file.id);
  }, [file.id, onSignedUrlLoaded]);

  return (
    <div
      className={`media-library-modal-card media-library-panel-media-card-shell media-library-panel-audio-card-shell${
        isSelected ? " is-active" : ""
      }`}
      style={shellStyle}
    >
      {renderSelectionToggle({ file, isSelected, mediaKind: "audio", onToggleMediaSelection })}
      <div
        role="button"
        tabIndex={0}
        className="reference-card has-audio media-library-panel-audio-reference-card"
        ref={getMediaCardRef(file.id)}
        aria-label={audioCardLabel}
        aria-pressed={shouldSetAriaPressed ? isSelected : undefined}
        draggable={Boolean(onMediaDragStart)}
        onClick={() =>
          onToggleMediaSelection ? onToggleMediaSelection(file) : onSelectMediaFile(file)
        }
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          if (onToggleMediaSelection) {
            onToggleMediaSelection(file);
            return;
          }
          onSelectMediaFile(file);
        }}
        onDoubleClick={() => onMediaDoubleClick?.(file)}
        onDragStart={(event) => onMediaDragStart?.(event, file, dragPreview)}
        onDragEnd={(event) => onMediaDragEnd?.(event, file)}
        onContextMenu={(event) => onMediaContextMenu?.(event, file)}
        style={{ aspectRatio: previewAspectRatio }}
      >
        <ReferenceAudioPlayer
          audioId={file.id}
          audioUrl={audioUrl}
          backgroundImageUrl={audioPresentation.backgroundImageUrl}
          audioSourceMode={audioSourceMode}
          title={displayTitle}
          durationMs={durationMs}
          waveformPeaks={resolveMediaMetadataWaveformPeaks(file.metadata)}
          playLabel={`Play audio ${audioLabel}`}
          pauseLabel={`Pause audio ${audioLabel}`}
          downloadLabel={`Download audio ${audioLabel || "media"}`}
          onResolveAudioUrl={onRequestSignedUrl ? () => onRequestSignedUrl(file) : undefined}
          resolveAudioUrlOnMount={Boolean(onRequestSignedUrl)}
          onReady={markSignedUrlLoaded}
          onError={() => onMediaPreviewError(file, audioUrl)}
          eagerWaveformDecode={false}
        />
      </div>
      {renderCardActions({
        file,
        showCardActions,
        canShowDownloadAction,
        canShowRerollAction,
        canShowRemoveAction,
        canShowDeleteAction,
        actionLabels,
        dangerActionMode,
        onDownloadMediaFile,
        onRerollWorkflowFromMedia,
        onRemoveMediaFromFolder,
        onDeleteMediaFromLibrary,
      })}
    </div>
  );
}

/**
 * Renders image/video Media Library cards for both mixed-feed and media-only grids.
 */
export function MediaLibraryVisualMediaCard({
  file,
  isSelected,
  previewAspectRatio,
  cardPreviewUrl,
  hoverVideoUrl = null,
  posterPreviewUrl = null,
  fetchPriorityAttr,
  getMediaCardRef,
  onSelectMediaFile,
  onMediaDoubleClick,
  onMediaDragStart,
  onMediaDragEnd,
  onToggleMediaSelection,
  onMediaContextMenu,
  onMediaPreviewError,
  onMediaPaint,
  onSignedUrlLoaded,
  onRequestSignedUrl,
  cacheAspectRatio,
  showCardActions,
  canShowDownloadAction,
  canShowRerollAction,
  canShowRemoveAction,
  canShowDeleteAction,
  actionLabels,
  dangerActionMode,
  onDownloadMediaFile,
  onRerollWorkflowFromMedia,
  onRemoveMediaFromFolder,
  onDeleteMediaFromLibrary,
  shellStyle,
  setAriaPressedWithoutSelectionMode = false,
  variant,
  dragPreview,
  shouldRenderVideoPreview = false,
  managedVideoSrc = null,
  autoPlayEnabled = false,
  getVideoNodeRef,
}: MediaLibraryVisualMediaCardProps) {
  const isVideo = resolveMediaRowKind(file) === "video";
  const posterUrl = posterPreviewUrl;
  const hasManagedVideoBudget = Boolean(getVideoNodeRef);
  const mixedFeedVideoSrc = hasManagedVideoBudget ? managedVideoSrc : hoverVideoUrl;
  const hasMixedFeedVideoCandidate = Boolean(isVideo && hoverVideoUrl);
  const hasPosterBackedVideoPreview = Boolean(hasMixedFeedVideoCandidate && posterUrl);
  const shouldRenderFallbackVideo = Boolean(hasMixedFeedVideoCandidate && !posterUrl);
  const videoNodeRef = React.useRef<HTMLVideoElement | null>(null);
  const managedVideoNodeRef = getVideoNodeRef?.(file.id);
  const hoverAutoplayStartedRef = React.useRef(false);
  const signedUrlLoadedRef = React.useRef(false);
  const mediaPaintedRef = React.useRef(false);
  const [isHoveringVideo, setIsHoveringVideo] = React.useState(false);
  const [isHoverVideoVisible, setIsHoverVideoVisible] = React.useState(false);
  const shouldRenderHoverVideo = Boolean(hasPosterBackedVideoPreview);
  const fallbackVideoPreload = "metadata";
  const durationMs = resolveMediaMetadataDurationMs(file.metadata, { fileType: file.file_type });
  const durationMediaUrl = resolveMediaLibraryVideoDurationProbeUrl(file);
  const shouldSetAriaPressed =
    Boolean(onToggleMediaSelection) || setAriaPressedWithoutSelectionMode;
  const mediaCardLabel = `${
    onToggleMediaSelection && isSelected ? "Deselect" : "Select"
  } media ${resolveMediaLibraryCardDisplayLabel(file)}`;

  const markSignedUrlLoaded = React.useCallback(() => {
    if (signedUrlLoadedRef.current) return;
    signedUrlLoadedRef.current = true;
    onSignedUrlLoaded(file.id);
  }, [file.id, onSignedUrlLoaded]);

  const markPainted = React.useCallback(
    (assetKind: "image" | "video") => {
      if (mediaPaintedRef.current) return;
      mediaPaintedRef.current = true;
      onMediaPaint(assetKind);
    },
    [onMediaPaint]
  );

  const setMixedFeedVideoNodeRef = React.useCallback(
    (node: HTMLVideoElement | null) => {
      videoNodeRef.current = node;
      managedVideoNodeRef?.(node);
    },
    [managedVideoNodeRef]
  );

  const renderVideoDurationBadge = () =>
    isVideo ? (
      <MediaDurationBadge
        className="media-library-panel-media-duration"
        durationMs={durationMs}
        mediaUrl={durationMediaUrl}
        mediaKind="video"
      />
    ) : null;

  const shouldRenderPoster = Boolean(posterUrl);
  const shouldRenderFallbackImage =
    !isVideo && Boolean(cardPreviewUrl) && !isVideoUrl(cardPreviewUrl);
  const shouldRenderBlankPlaceholder =
    variant === "mixed-feed" &&
    !shouldRenderFallbackVideo &&
    !shouldRenderHoverVideo &&
    !shouldRenderPoster &&
    !shouldRenderFallbackImage;
  const previewRecoveryRequestKey = `${file.id}:${file.signedUrl ?? ""}:${cardPreviewUrl ?? ""}`;
  const previewRecoveryAttemptRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!onRequestSignedUrl || !shouldRenderBlankPlaceholder) return;
    if (previewRecoveryAttemptRef.current === previewRecoveryRequestKey) return;
    previewRecoveryAttemptRef.current = previewRecoveryRequestKey;
    void onRequestSignedUrl(file)
      .then((nextSignedUrl) => {
        if (nextSignedUrl) return;
        onMediaPreviewError(file, cardPreviewUrl);
      })
      .catch(() => {
        onMediaPreviewError(file, cardPreviewUrl);
      });
  }, [
    cardPreviewUrl,
    file,
    onMediaPreviewError,
    onRequestSignedUrl,
    previewRecoveryRequestKey,
    shouldRenderBlankPlaceholder,
  ]);

  const handleMixedPointerEnter = () => {
    if (variant !== "mixed-feed") return;
    if (!mixedFeedVideoSrc || (hasManagedVideoBudget && !autoPlayEnabled)) return;
    setIsHoveringVideo(true);
    const node = videoNodeRef.current;
    if (!node || !node.paused || node.ended) {
      hoverAutoplayStartedRef.current = false;
      return;
    }
    hoverAutoplayStartedRef.current = true;
    void node.play().catch(() => {
      hoverAutoplayStartedRef.current = false;
      if (hasPosterBackedVideoPreview) {
        setIsHoveringVideo(false);
        setIsHoverVideoVisible(false);
      }
    });
  };

  const handleMixedPointerLeave = () => {
    if (variant !== "mixed-feed") return;
    setIsHoveringVideo(false);
    if (!hoverAutoplayStartedRef.current) return;
    hoverAutoplayStartedRef.current = false;
    videoNodeRef.current?.pause();
  };

  React.useEffect(() => {
    if (mixedFeedVideoSrc) return;
    setIsHoveringVideo(false);
    setIsHoverVideoVisible(false);
    if (!hoverAutoplayStartedRef.current) return;
    hoverAutoplayStartedRef.current = false;
    videoNodeRef.current?.pause();
  }, [mixedFeedVideoSrc]);

  const renderMixedMedia = () => (
    <div className="media-library-panel-media-frame" style={{ aspectRatio: previewAspectRatio }}>
      {shouldRenderFallbackVideo ? (
        <video
          className="media-thumb"
          ref={setMixedFeedVideoNodeRef}
          src={mixedFeedVideoSrc ?? undefined}
          muted
          playsInline
          loop
          preload={fallbackVideoPreload}
          onLoadedMetadata={(event) => {
            const node = event.currentTarget;
            if (node.videoWidth > 0 && node.videoHeight > 0) {
              cacheAspectRatio(file.id, node.videoWidth / node.videoHeight);
            }
            markSignedUrlLoaded();
          }}
          onLoadedData={() => {
            markPainted("video");
          }}
          onError={() => onMediaPreviewError(file, mixedFeedVideoSrc ?? hoverVideoUrl)}
        />
      ) : null}
      {shouldRenderHoverVideo ? (
        <video
          className={`media-thumb media-library-panel-hover-video${
            isHoveringVideo || isHoverVideoVisible ? " is-visible" : ""
          }`}
          ref={setMixedFeedVideoNodeRef}
          src={mixedFeedVideoSrc ?? undefined}
          muted
          playsInline
          loop
          preload="metadata"
          onLoadedMetadata={(event) => {
            const node = event.currentTarget;
            if (node.videoWidth > 0 && node.videoHeight > 0) {
              cacheAspectRatio(file.id, node.videoWidth / node.videoHeight);
            }
            markSignedUrlLoaded();
          }}
          onLoadedData={() => {
            setIsHoverVideoVisible(true);
            markPainted("video");
          }}
          onError={() => {
            setIsHoverVideoVisible(false);
            onMediaPreviewError(file, mixedFeedVideoSrc ?? hoverVideoUrl);
          }}
          onPause={() => {
            if (!isHoveringVideo) {
              setIsHoverVideoVisible(false);
            }
          }}
          onPlay={() => {
            setIsHoverVideoVisible(true);
          }}
        />
      ) : null}
      {shouldRenderPoster ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            {...({ fetchpriority: fetchPriorityAttr } as Record<string, string>)}
            className={`media-thumb media-library-panel-video-poster${
              isHoveringVideo || isHoverVideoVisible ? " is-hidden" : ""
            }`}
            src={posterUrl ?? undefined}
            alt={file.filename}
            draggable={false}
            loading="lazy"
            decoding="async"
            onLoad={(event) => {
              const node = event.currentTarget;
              if (node.naturalWidth > 0 && node.naturalHeight > 0) {
                cacheAspectRatio(file.id, node.naturalWidth / node.naturalHeight);
              }
              markSignedUrlLoaded();
              markPainted("image");
            }}
            onError={() => onMediaPreviewError(file, posterUrl)}
          />
        </>
      ) : shouldRenderFallbackImage ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            {...({ fetchpriority: fetchPriorityAttr } as Record<string, string>)}
            className="media-thumb"
            src={cardPreviewUrl ?? undefined}
            alt={file.filename}
            draggable={false}
            loading="lazy"
            decoding="async"
            onLoad={(event) => {
              const node = event.currentTarget;
              if (node.naturalWidth > 0 && node.naturalHeight > 0) {
                cacheAspectRatio(file.id, node.naturalWidth / node.naturalHeight);
              }
              markSignedUrlLoaded();
              markPainted("image");
            }}
            onError={() => onMediaPreviewError(file, cardPreviewUrl)}
          />
        </>
      ) : (
        <div
          className="media-thumb placeholder media-library-panel-video-placeholder"
          aria-hidden
        />
      )}
      {renderVideoDurationBadge()}
    </div>
  );

  const renderMediaGridMedia = () =>
    cardPreviewUrl ? (
      shouldRenderVideoPreview ? (
        <video
          className="media-thumb"
          ref={getVideoNodeRef ? getVideoNodeRef(file.id) : undefined}
          src={managedVideoSrc ?? undefined}
          muted
          playsInline
          loop
          autoPlay={autoPlayEnabled}
          preload={autoPlayEnabled ? "metadata" : "none"}
          style={{ aspectRatio: previewAspectRatio }}
          onLoadedMetadata={(event) => {
            const node = event.currentTarget;
            if (node.videoWidth > 0 && node.videoHeight > 0) {
              cacheAspectRatio(file.id, node.videoWidth / node.videoHeight);
            }
            onSignedUrlLoaded(file.id);
          }}
          onLoadedData={() => {
            onMediaPaint("video");
          }}
          onError={() => onMediaPreviewError(file, cardPreviewUrl)}
        />
      ) : (
        <>
          {/* Signed URLs are generated dynamically at runtime. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            {...({ fetchpriority: fetchPriorityAttr } as Record<string, string>)}
            className="media-thumb"
            src={cardPreviewUrl}
            alt={file.filename}
            draggable={false}
            loading="lazy"
            decoding="async"
            style={{ aspectRatio: previewAspectRatio }}
            onLoad={(event) => {
              const node = event.currentTarget;
              if (node.naturalWidth > 0 && node.naturalHeight > 0) {
                cacheAspectRatio(file.id, node.naturalWidth / node.naturalHeight);
              }
              onSignedUrlLoaded(file.id);
              onMediaPaint("image");
            }}
            onError={() => onMediaPreviewError(file, cardPreviewUrl)}
          />
        </>
      )
    ) : (
      <div
        className="media-thumb placeholder"
        style={{ aspectRatio: previewAspectRatio }}
        aria-hidden
      />
    );

  return (
    <div
      className={`media-library-modal-card media-library-panel-media-card-shell media-library-panel-media-card-shell--${variant}${
        isSelected ? " is-active" : ""
      }`}
      style={shellStyle}
    >
      {renderSelectionToggle({ file, isSelected, mediaKind: "media", onToggleMediaSelection })}
      <button
        type="button"
        className="media-card media-library-panel-media-card-button"
        ref={getMediaCardRef(file.id)}
        aria-label={mediaCardLabel}
        aria-pressed={shouldSetAriaPressed ? isSelected : undefined}
        draggable={Boolean(onMediaDragStart)}
        onClick={() =>
          onToggleMediaSelection ? onToggleMediaSelection(file) : onSelectMediaFile(file)
        }
        onDoubleClick={() => onMediaDoubleClick?.(file)}
        onDragStart={(event) =>
          onMediaDragStart?.(
            event,
            file,
            dragPreview ?? {
              hoverVideoUrl,
              posterPreviewUrl,
              aspectRatio: previewAspectRatio,
            }
          )
        }
        onDragEnd={(event) => onMediaDragEnd?.(event, file)}
        onContextMenu={(event) => onMediaContextMenu?.(event, file)}
        onPointerEnter={variant === "mixed-feed" ? handleMixedPointerEnter : undefined}
        onPointerLeave={variant === "mixed-feed" ? handleMixedPointerLeave : undefined}
      >
        {variant === "mixed-feed" ? (
          renderMixedMedia()
        ) : (
          <>
            {renderMediaGridMedia()}
            {renderVideoDurationBadge()}
          </>
        )}
      </button>
      {renderCardActions({
        file,
        showCardActions,
        canShowDownloadAction,
        canShowRerollAction,
        canShowRemoveAction,
        canShowDeleteAction,
        actionLabels,
        dangerActionMode,
        onDownloadMediaFile,
        onRerollWorkflowFromMedia,
        onRemoveMediaFromFolder,
        onDeleteMediaFromLibrary,
      })}
    </div>
  );
}

export const canShowMediaLibraryRerollAction = (
  file: MediaFileRow,
  onRerollWorkflowFromMedia?: (file: MediaFileRow) => void
): boolean => Boolean(onRerollWorkflowFromMedia && canRerollMediaLibraryWorkflow(file));
