import React, { type MutableRefObject } from "react";
import { Check, DownloadSimple, FlowArrow, X } from "phosphor-react";
import { useMediaMasonryVirtualization } from "../../../media-library/hooks/useMediaMasonryVirtualization";
import { resolveMediaLibraryAdaptiveCardPreviewUrl } from "../../../media-library/logic/mediaLibraryAdaptivePreview";
import {
  MEDIA_LIBRARY_VIRTUALIZATION_ENABLED,
  type MediaLibraryGridDensityConfig,
} from "../../../media-library/logic/mediaLibraryRuntimeConfig";
import { resolveMediaCardAspectRatio } from "../../logic/mediaLibraryAspectRatio";
import { resolveVideoPosterSourceUrl } from "../../logic/mediaVideoBrowsePreview";
import { useMediaVideoBrowsePreviewUrls } from "../../hooks/useMediaVideoBrowsePreviewUrls";
import { canReloadMediaLibraryWorkflow } from "../../logic/mediaLibraryWorkflowReload";
import { isVideoUrl } from "../../logic/stateParsers";
import { MediaDurationBadge } from "../shared/MediaDurationBadge";
import { ReferenceAudioPlayer } from "../shared/ReferenceAudioPlayer";
import { MediaLibraryPromptReferenceCard } from "./MediaLibraryPromptReferenceCard";
import { useMediaAspectRatioCache } from "./useMediaAspectRatioCache";
import {
  createdAtTime,
  isAudioFile,
  isVideoFile,
  resolveMediaMetadataAudioSourceMode,
  resolveMediaMetadataDurationMs,
  resolveMediaMetadataWaveformPeaks,
  type MediaCardRefCallback,
  type MediaFileRow,
  type PromptRow,
} from "../../logic/mediaLibraryModalModel";

type ResolveMediaLibraryGridPreviewUrlArgs = {
  signedUrl: string | null | undefined;
  fileType?: string | null;
  pressureLevel: 0 | 1 | 2;
  adaptivePreviewQualityEnabled: boolean;
  shouldBypassAdaptivePreview?: boolean;
  cardLongEdgePx?: number;
  devicePixelRatio?: number;
};

export type MediaLibraryMediaDragPreview = {
  hoverVideoUrl?: string | null;
  posterPreviewUrl?: string | null;
  aspectRatio?: number | null;
};

type MediaLibraryAllItemsGridProps = {
  mediaRows: MediaFileRow[];
  promptRows: PromptRow[];
  selectedIds: Set<string>;
  optimizerFallbackMediaIds: Set<string>;
  adaptivePressureLevel: 0 | 1 | 2;
  adaptivePreviewQualityEnabled: boolean;
  resolveCardPreviewUrl?: (args: ResolveMediaLibraryGridPreviewUrlArgs) => string | null;
  scrollContainerRef?: MutableRefObject<HTMLElement | null>;
  getMediaCardRef: (fileId: string) => MediaCardRefCallback;
  onSelectMediaFile: (file: MediaFileRow) => void;
  onSelectPromptCard: (prompt: PromptRow) => void;
  onMediaDoubleClick?: (file: MediaFileRow) => void;
  onMediaDragStart?: (
    event: React.DragEvent<HTMLElement>,
    file: MediaFileRow,
    preview?: MediaLibraryMediaDragPreview
  ) => void;
  onPromptDragStart?: (event: React.DragEvent<HTMLButtonElement>, prompt: PromptRow) => void;
  onMediaDragEnd?: (event: React.DragEvent<HTMLElement>, file: MediaFileRow) => void;
  onPromptDragEnd?: (event: React.DragEvent<HTMLButtonElement>, prompt: PromptRow) => void;
  onToggleMediaSelection?: (file: MediaFileRow) => void;
  showRemoveAction?: boolean;
  onRemoveMediaFromFolder?: (file: MediaFileRow) => void;
  onRemovePromptFromFolder?: (prompt: PromptRow) => void;
  showDeleteAction?: boolean;
  onDeleteMediaFromLibrary?: (file: MediaFileRow) => void;
  onDeletePromptFromLibrary?: (prompt: PromptRow) => void;
  onDownloadMediaFile?: (file: MediaFileRow) => void;
  onReloadWorkflowFromMedia?: (file: MediaFileRow) => void;
  onMediaContextMenu?: (event: React.MouseEvent<HTMLElement>, file: MediaFileRow) => void;
  onMediaPreviewError: (file: MediaFileRow, failedUrl?: string | null) => void;
  onMediaPaint: (assetKind: "image" | "video") => void;
  onSignedUrlLoaded: (id: string) => void;
  onRequestSignedUrl?: (file: MediaFileRow) => Promise<string | null>;
  currentUserId?: string | null;
  visibleMediaIdsRef?: MutableRefObject<Set<string>>;
  visibleMediaVersion?: number;
  signedPosterUrlById?: Record<string, string>;
  signedVideoUrlById?: Record<string, string>;
  surface?: "media-library-panel" | "elements-media-panel" | "character-media-panel";
  densityConfig?: MediaLibraryGridDensityConfig;
  preferVisualMediaFirst?: boolean;
  visualMediaPriorityCount?: number;
  fixedVisualAspectRatio?: number | null;
};

type MediaLibraryAllItem =
  | { key: string; kind: "media"; id: string; createdAt: number; row: MediaFileRow }
  | { key: string; kind: "prompt"; id: string; createdAt: number; row: PromptRow };

const PROMPT_CARD_ASPECT_RATIO = 4 / 5;

type MediaCardShellProps = {
  file: MediaFileRow;
  isSelected: boolean;
  previewAspectRatio: number;
  cardPreviewUrl: string | null;
  hoverVideoUrl: string | null;
  posterPreviewUrl: string | null;
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
  onMediaPaint: (assetKind: "image" | "video") => void;
  onSignedUrlLoaded: (id: string) => void;
  onRequestSignedUrl?: (file: MediaFileRow) => Promise<string | null>;
  cacheAspectRatio: (id: string, ratio: number) => void;
  showCardActions: boolean;
  canShowDownloadAction: boolean;
  canShowWorkflowReloadAction: boolean;
  canShowRemoveAction: boolean;
  canShowDeleteAction: boolean;
  onDownloadMediaFile?: (file: MediaFileRow) => void;
  onReloadWorkflowFromMedia?: (file: MediaFileRow) => void;
  onRemoveMediaFromFolder?: (file: MediaFileRow) => void;
  onDeleteMediaFromLibrary?: (file: MediaFileRow) => void;
};

type MediaCardActionsProps = {
  file: MediaFileRow;
  canShowDownloadAction: boolean;
  canShowWorkflowReloadAction: boolean;
  canShowRemoveAction: boolean;
  canShowDeleteAction: boolean;
  onDownloadMediaFile?: (file: MediaFileRow) => void;
  onReloadWorkflowFromMedia?: (file: MediaFileRow) => void;
  onRemoveMediaFromFolder?: (file: MediaFileRow) => void;
  onDeleteMediaFromLibrary?: (file: MediaFileRow) => void;
};

function MediaLibraryAllItemsCardActions({
  file,
  canShowDownloadAction,
  canShowWorkflowReloadAction,
  canShowRemoveAction,
  canShowDeleteAction,
  onDownloadMediaFile,
  onReloadWorkflowFromMedia,
  onRemoveMediaFromFolder,
  onDeleteMediaFromLibrary,
}: MediaCardActionsProps) {
  return (
    <div className="media-library-panel-card-actions" aria-label="Media actions">
      {canShowDownloadAction ? (
        <button
          type="button"
          className="reference-card-action-btn media-library-panel-card-download-btn"
          aria-label={`Download media ${file.filename}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onDownloadMediaFile?.(file);
          }}
        >
          <DownloadSimple size={16} weight="bold" aria-hidden />
        </button>
      ) : null}
      {canShowWorkflowReloadAction ? (
        <button
          type="button"
          className="reference-card-action-btn media-library-panel-card-reload-workflow-btn"
          aria-label={`Reload workflow for ${file.filename || "media"}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onReloadWorkflowFromMedia?.(file);
          }}
        >
          <FlowArrow size={16} weight="bold" aria-hidden />
        </button>
      ) : null}
      {canShowRemoveAction ? (
        <button
          type="button"
          className="reference-card-action-btn reference-card-action-btn--danger media-library-panel-card-remove-btn"
          aria-label={`Remove media ${file.filename}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onRemoveMediaFromFolder?.(file);
          }}
        >
          <X size={16} weight="bold" aria-hidden />
        </button>
      ) : null}
      {canShowDeleteAction ? (
        <button
          type="button"
          className="reference-card-action-btn reference-card-action-btn--danger media-library-panel-card-remove-btn"
          aria-label={`Delete media ${file.filename}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onDeleteMediaFromLibrary?.(file);
          }}
        >
          <X size={16} weight="bold" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

function MediaLibraryAllItemsMediaCard({
  file,
  isSelected,
  previewAspectRatio,
  cardPreviewUrl,
  hoverVideoUrl,
  posterPreviewUrl,
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
  canShowWorkflowReloadAction,
  canShowRemoveAction,
  canShowDeleteAction,
  onDownloadMediaFile,
  onReloadWorkflowFromMedia,
  onRemoveMediaFromFolder,
  onDeleteMediaFromLibrary,
}: MediaCardShellProps) {
  const isVideo = isVideoFile(file.file_type);
  const posterUrl = posterPreviewUrl;
  const hasPosterBackedVideoPreview = Boolean(isVideo && hoverVideoUrl && posterUrl);
  const shouldRenderFallbackVideo = Boolean(isVideo && hoverVideoUrl && !posterUrl);
  const videoNodeRef = React.useRef<HTMLVideoElement | null>(null);
  const hoverAutoplayStartedRef = React.useRef(false);
  const signedUrlLoadedRef = React.useRef(false);
  const mediaPaintedRef = React.useRef(false);
  const [isHoveringVideo, setIsHoveringVideo] = React.useState(false);
  const [isHoverVideoVisible, setIsHoverVideoVisible] = React.useState(false);
  const shouldRenderHoverVideo = Boolean(hasPosterBackedVideoPreview && hoverVideoUrl);
  const durationMs = resolveMediaMetadataDurationMs(file.metadata, { fileType: file.file_type });
  const durationMediaUrl = hoverVideoUrl ?? cardPreviewUrl ?? file.signedUrl ?? null;

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

  const shouldRenderPoster = Boolean(posterUrl);
  const shouldRenderFallbackImage =
    !isVideo && Boolean(cardPreviewUrl) && !isVideoUrl(cardPreviewUrl);
  const shouldRenderBlankPlaceholder =
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

  return (
    <div
      className={`media-library-modal-card media-library-panel-media-card-shell${
        isSelected ? " is-active" : ""
      }`}
    >
      {onToggleMediaSelection && isSelected ? (
        <button
          type="button"
          className={`media-library-panel-selection-toggle${isSelected ? " is-selected" : ""}`}
          aria-label={
            isSelected
              ? `Deselect ${file.filename || "media"}`
              : `Select ${file.filename || "media"}`
          }
          aria-pressed={isSelected}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onToggleMediaSelection(file);
          }}
        >
          {isSelected ? <Check size={17} weight="fill" aria-hidden /> : null}
        </button>
      ) : null}
      <button
        type="button"
        className="media-card media-library-panel-media-card-button"
        ref={getMediaCardRef(file.id)}
        aria-pressed={isSelected}
        draggable={Boolean(onMediaDragStart)}
        onClick={() =>
          onToggleMediaSelection ? onToggleMediaSelection(file) : onSelectMediaFile(file)
        }
        onDoubleClick={() => onMediaDoubleClick?.(file)}
        onDragStart={(event) =>
          onMediaDragStart?.(event, file, {
            hoverVideoUrl,
            posterPreviewUrl,
            aspectRatio: previewAspectRatio,
          })
        }
        onDragEnd={(event) => onMediaDragEnd?.(event, file)}
        onContextMenu={(event) => onMediaContextMenu?.(event, file)}
        onPointerEnter={() => {
          if (!hoverVideoUrl) return;
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
        }}
        onPointerLeave={() => {
          setIsHoveringVideo(false);
          if (!hoverAutoplayStartedRef.current) return;
          hoverAutoplayStartedRef.current = false;
          videoNodeRef.current?.pause();
        }}
      >
        <div
          className="media-library-panel-media-frame"
          style={{ aspectRatio: previewAspectRatio }}
        >
          {shouldRenderFallbackVideo ? (
            <video
              className="media-thumb"
              ref={(node) => {
                videoNodeRef.current = node;
              }}
              src={hoverVideoUrl ?? undefined}
              muted
              playsInline
              loop
              // Posterless browse cards need the first frame, not just container metadata.
              preload="auto"
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
              onError={() => onMediaPreviewError(file, hoverVideoUrl)}
            />
          ) : null}
          {shouldRenderHoverVideo ? (
            <video
              className={`media-thumb media-library-panel-hover-video${
                isHoveringVideo || isHoverVideoVisible ? " is-visible" : ""
              }`}
              ref={(node) => {
                videoNodeRef.current = node;
              }}
              src={hoverVideoUrl ?? undefined}
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
                onMediaPreviewError(file, hoverVideoUrl);
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
          {isVideo ? (
            <MediaDurationBadge
              className="media-library-panel-media-duration"
              durationMs={durationMs}
              mediaUrl={durationMediaUrl}
              mediaKind="video"
            />
          ) : null}
        </div>
      </button>
      {showCardActions ? (
        <MediaLibraryAllItemsCardActions
          file={file}
          canShowDownloadAction={canShowDownloadAction}
          canShowWorkflowReloadAction={canShowWorkflowReloadAction}
          canShowRemoveAction={canShowRemoveAction}
          canShowDeleteAction={canShowDeleteAction}
          onDownloadMediaFile={onDownloadMediaFile}
          onReloadWorkflowFromMedia={onReloadWorkflowFromMedia}
          onRemoveMediaFromFolder={onRemoveMediaFromFolder}
          onDeleteMediaFromLibrary={onDeleteMediaFromLibrary}
        />
      ) : null}
    </div>
  );
}

function MediaLibraryAllItemsAudioCard({
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
  canShowWorkflowReloadAction,
  canShowRemoveAction,
  canShowDeleteAction,
  onDownloadMediaFile,
  onReloadWorkflowFromMedia,
  onRemoveMediaFromFolder,
  onDeleteMediaFromLibrary,
}: MediaCardShellProps) {
  const audioUrl = cardPreviewUrl ?? file.signedUrl ?? null;
  const signedUrlLoadedRef = React.useRef(false);
  const audioSourceMode = resolveMediaMetadataAudioSourceMode(file.metadata);
  const durationMs = resolveMediaMetadataDurationMs(file.metadata, { fileType: file.file_type });

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
    >
      {onToggleMediaSelection && isSelected ? (
        <button
          type="button"
          className={`media-library-panel-selection-toggle${isSelected ? " is-selected" : ""}`}
          aria-label={
            isSelected
              ? `Deselect ${file.filename || "audio"}`
              : `Select ${file.filename || "audio"}`
          }
          aria-pressed={isSelected}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onToggleMediaSelection(file);
          }}
        >
          {isSelected ? <Check size={17} weight="fill" aria-hidden /> : null}
        </button>
      ) : null}
      <div
        role="button"
        tabIndex={0}
        className="reference-card has-audio media-library-panel-audio-reference-card"
        ref={getMediaCardRef(file.id)}
        aria-pressed={isSelected}
        draggable={Boolean(onMediaDragStart)}
        onClick={() =>
          onToggleMediaSelection ? onToggleMediaSelection(file) : onSelectMediaFile(file)
        }
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (onToggleMediaSelection) {
              onToggleMediaSelection(file);
              return;
            }
            onSelectMediaFile(file);
          }
        }}
        onDoubleClick={() => onMediaDoubleClick?.(file)}
        onDragStart={(event) => onMediaDragStart?.(event, file)}
        onDragEnd={(event) => onMediaDragEnd?.(event, file)}
        onContextMenu={(event) => onMediaContextMenu?.(event, file)}
        style={{ aspectRatio: previewAspectRatio }}
      >
        <ReferenceAudioPlayer
          audioId={file.id}
          audioUrl={audioUrl}
          backgroundImageUrl={file.companion_art_url ?? null}
          audioSourceMode={audioSourceMode}
          durationMs={durationMs}
          waveformPeaks={resolveMediaMetadataWaveformPeaks(file.metadata)}
          playLabel={`Play audio ${file.filename}`}
          pauseLabel={`Pause audio ${file.filename}`}
          downloadLabel={`Download audio ${file.filename || "media"}`}
          onDownload={
            canShowDownloadAction
              ? () => {
                  onDownloadMediaFile?.(file);
                }
              : undefined
          }
          onResolveAudioUrl={onRequestSignedUrl ? () => onRequestSignedUrl(file) : undefined}
          onReady={() => {
            markSignedUrlLoaded();
          }}
          onError={() => onMediaPreviewError(file, audioUrl)}
          eagerWaveformDecode={false}
        />
      </div>
      {showCardActions ? (
        <MediaLibraryAllItemsCardActions
          file={file}
          canShowDownloadAction={false}
          canShowWorkflowReloadAction={canShowWorkflowReloadAction}
          canShowRemoveAction={canShowRemoveAction}
          canShowDeleteAction={canShowDeleteAction}
          onDownloadMediaFile={onDownloadMediaFile}
          onReloadWorkflowFromMedia={onReloadWorkflowFromMedia}
          onRemoveMediaFromFolder={onRemoveMediaFromFolder}
          onDeleteMediaFromLibrary={onDeleteMediaFromLibrary}
        />
      ) : null}
    </div>
  );
}

export function MediaLibraryAllItemsGrid({
  mediaRows,
  promptRows,
  selectedIds,
  optimizerFallbackMediaIds,
  adaptivePressureLevel,
  adaptivePreviewQualityEnabled,
  resolveCardPreviewUrl,
  scrollContainerRef,
  getMediaCardRef,
  onSelectMediaFile,
  onSelectPromptCard,
  onMediaDoubleClick,
  onMediaDragStart,
  onPromptDragStart,
  onMediaDragEnd,
  onPromptDragEnd,
  onToggleMediaSelection,
  showRemoveAction = false,
  onRemoveMediaFromFolder,
  onRemovePromptFromFolder,
  showDeleteAction = false,
  onDeleteMediaFromLibrary,
  onDeletePromptFromLibrary,
  onDownloadMediaFile,
  onReloadWorkflowFromMedia,
  onMediaContextMenu,
  onMediaPreviewError,
  onMediaPaint,
  onSignedUrlLoaded,
  onRequestSignedUrl,
  currentUserId = null,
  visibleMediaIdsRef,
  visibleMediaVersion = 0,
  signedPosterUrlById: signedPosterUrlOverrides = {},
  signedVideoUrlById: signedVideoUrlOverrides = {},
  surface = "media-library-panel",
  densityConfig,
  preferVisualMediaFirst = false,
  visualMediaPriorityCount = 0,
  fixedVisualAspectRatio = null,
}: MediaLibraryAllItemsGridProps) {
  const { aspectRatioById, cacheAspectRatio } = useMediaAspectRatioCache(mediaRows);
  const targetColumnWidth = densityConfig?.targetColumnWidth ?? 188;
  const cardPreviewLongEdgePx = densityConfig?.previewLongEdgePx ?? 320;
  const {
    signedPosterUrlById: signedPosterUrlByIdFromHook,
    signedVideoUrlById: signedVideoUrlByIdFromHook,
  } = useMediaVideoBrowsePreviewUrls({
    mediaRows,
    currentUserId,
    surface,
    visibleMediaIdsRef,
    visibleMediaVersion,
  });
  const signedPosterUrlById = React.useMemo(
    () => ({ ...signedPosterUrlByIdFromHook, ...signedPosterUrlOverrides }),
    [signedPosterUrlByIdFromHook, signedPosterUrlOverrides]
  );
  const signedVideoUrlById = React.useMemo(
    () => ({ ...signedVideoUrlByIdFromHook, ...signedVideoUrlOverrides }),
    [signedVideoUrlByIdFromHook, signedVideoUrlOverrides]
  );

  const combinedItems = React.useMemo<MediaLibraryAllItem[]>(() => {
    const items: MediaLibraryAllItem[] = [
      ...mediaRows.map((row) => ({
        key: `media:${row.id}`,
        kind: "media" as const,
        id: row.id,
        createdAt: createdAtTime(row.created_at),
        row,
      })),
      ...promptRows.map((row) => ({
        key: `prompt:${row.id}`,
        kind: "prompt" as const,
        id: row.id,
        createdAt: createdAtTime(row.created_at),
        row,
      })),
    ];
    const chronologicallySortedItems = items.sort((left, right) => {
      const createdDelta = right.createdAt - left.createdAt;
      if (createdDelta !== 0) return createdDelta;
      return right.key.localeCompare(left.key);
    });
    if (!preferVisualMediaFirst || visualMediaPriorityCount < 1) {
      return chronologicallySortedItems;
    }
    const prioritizedVisualItems: MediaLibraryAllItem[] = [];
    const remainingItems: MediaLibraryAllItem[] = [];
    for (const item of chronologicallySortedItems) {
      const isPrioritizedVisualItem =
        item.kind === "media" &&
        !isAudioFile(item.row.file_type) &&
        prioritizedVisualItems.length < visualMediaPriorityCount;
      if (isPrioritizedVisualItem) {
        prioritizedVisualItems.push(item);
        continue;
      }
      remainingItems.push(item);
    }
    return [...prioritizedVisualItems, ...remainingItems];
  }, [mediaRows, preferVisualMediaFirst, promptRows, visualMediaPriorityCount]);

  const {
    containerRef: virtualContainerRef,
    isVirtualized,
    totalHeight: virtualTotalHeight,
    renderItems: virtualRenderItems,
  } = useMediaMasonryVirtualization({
    items: combinedItems,
    getItemId: (item) => item.key,
    getAspectRatio: (item) => {
      if (item.kind === "prompt") return PROMPT_CARD_ASPECT_RATIO;
      if (isAudioFile(item.row.file_type)) return PROMPT_CARD_ASPECT_RATIO;
      if (
        typeof fixedVisualAspectRatio === "number" &&
        Number.isFinite(fixedVisualAspectRatio) &&
        fixedVisualAspectRatio > 0
      ) {
        return fixedVisualAspectRatio;
      }
      const cachedRatio = aspectRatioById[item.id];
      if (Number.isFinite(cachedRatio) && cachedRatio > 0) return cachedRatio;
      return resolveMediaCardAspectRatio({
        fileType: item.row.file_type,
        width: item.row.width ?? null,
        height: item.row.height ?? null,
        metadata: item.row.metadata,
      });
    },
    enabled: MEDIA_LIBRARY_VIRTUALIZATION_ENABLED,
    scrollContainerRef,
    targetColumnWidth,
    maxColumnCount: densityConfig?.maxColumnCount,
    gap: 1,
    overscanPx: 920,
    minItemsToVirtualize: 24,
  });

  const gridStyle = React.useMemo<React.CSSProperties | undefined>(() => {
    const densityStyle = densityConfig
      ? ({
          "--media-library-modal-preview-width": `${densityConfig.targetColumnWidth}px`,
          "--media-library-panel-density-max-columns": densityConfig.maxColumnCount,
        } as React.CSSProperties)
      : undefined;
    if (!isVirtualized) return densityStyle;
    return {
      ...densityStyle,
      height: `${virtualTotalHeight}px`,
    };
  }, [densityConfig, isVirtualized, virtualTotalHeight]);

  if (combinedItems.length === 0) {
    return <p className="tiny subdued">No saved items yet.</p>;
  }

  return (
    <div
      ref={virtualContainerRef}
      className={`media-grid media-library-modal-grid media-library-modal-grid-packed media-library-panel-all-items-grid${
        isVirtualized ? " media-library-modal-grid-virtualized" : ""
      }${densityConfig ? " media-library-panel-density-grid" : ""}`}
      style={gridStyle}
    >
      {virtualRenderItems.map((renderItem) => {
        const item = renderItem.item;
        if (item.kind === "prompt") {
          const prompt = item.row;
          const isSelected = selectedIds.has(prompt.id);
          return (
            <MediaLibraryPromptReferenceCard
              key={item.key}
              prompt={prompt}
              isSelected={isSelected}
              onSelectPromptCard={onSelectPromptCard}
              onPromptDragStart={onPromptDragStart}
              onPromptDragEnd={onPromptDragEnd}
              showRemoveAction={showRemoveAction}
              onRemovePromptFromFolder={onRemovePromptFromFolder}
              showDeleteAction={showDeleteAction}
              onDeletePromptFromLibrary={onDeletePromptFromLibrary}
              shellClassName="media-library-modal-card media-library-panel-all-items-prompt-shell"
              cardClassName="media-library-panel-all-items-prompt-card"
              shellStyle={renderItem.style}
            />
          );
        }

        const file = item.row;
        const isAudio = isAudioFile(file.file_type);
        const hasDownloadableMediaSource = Boolean(
          (file.storage_path ?? "").trim() || (file.signedUrl ?? "").trim()
        );
        const canShowRemoveAction = showRemoveAction && Boolean(onRemoveMediaFromFolder);
        const canShowDeleteAction = showDeleteAction && Boolean(onDeleteMediaFromLibrary);
        const canShowDownloadAction = Boolean(
          onDownloadMediaFile &&
          (isAudio ? hasDownloadableMediaSource : (file.signedUrl ?? "").trim().length > 0)
        );
        const canShowWorkflowReloadAction = Boolean(
          onReloadWorkflowFromMedia && canReloadMediaLibraryWorkflow(file)
        );
        const shouldShowCardActions =
          canShowDownloadAction ||
          canShowWorkflowReloadAction ||
          canShowRemoveAction ||
          canShowDeleteAction;
        const shouldBypassAdaptivePreview = optimizerFallbackMediaIds.has(file.id);
        const previewAspectRatio =
          !isAudioFile(file.file_type) &&
          typeof fixedVisualAspectRatio === "number" &&
          Number.isFinite(fixedVisualAspectRatio) &&
          fixedVisualAspectRatio > 0
            ? fixedVisualAspectRatio
            : (aspectRatioById[file.id] ??
              resolveMediaCardAspectRatio({
                fileType: file.file_type,
                width: file.width ?? null,
                height: file.height ?? null,
                metadata: file.metadata,
              }));
        const cardPreviewUrl = resolveCardPreviewUrl
          ? resolveCardPreviewUrl({
              signedUrl: file.signedUrl,
              fileType: file.file_type,
              pressureLevel: adaptivePressureLevel,
              adaptivePreviewQualityEnabled,
              shouldBypassAdaptivePreview,
              cardLongEdgePx: cardPreviewLongEdgePx,
              devicePixelRatio: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
            })
          : resolveMediaLibraryAdaptiveCardPreviewUrl({
              surface: "media-library-modal-grid",
              signedUrl: file.signedUrl,
              fileType: file.file_type,
              pressureLevel: adaptivePressureLevel,
              adaptivePreviewQualityEnabled,
              shouldBypassAdaptivePreview,
              cardLongEdgePx: cardPreviewLongEdgePx,
              devicePixelRatio: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
            });
        const fetchPriorityAttr = renderItem.index < 8 ? "high" : "auto";
        const signedPosterUrl = signedPosterUrlById[file.id] ?? null;
        const hoverVideoUrl = isVideoFile(file.file_type)
          ? (signedVideoUrlById[file.id] ??
            (file.signedUrl && isVideoUrl(file.signedUrl) ? file.signedUrl : null))
          : null;
        const posterSourceUrl = resolveVideoPosterSourceUrl(
          file,
          signedPosterUrl,
          hoverVideoUrl,
          file.signedUrl ?? null
        );
        const posterPreviewUrl = posterSourceUrl
          ? resolveCardPreviewUrl
            ? resolveCardPreviewUrl({
                signedUrl: posterSourceUrl,
                fileType: "image/jpeg",
                pressureLevel: adaptivePressureLevel,
                adaptivePreviewQualityEnabled,
                shouldBypassAdaptivePreview,
                cardLongEdgePx: cardPreviewLongEdgePx,
                devicePixelRatio: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
              })
            : resolveMediaLibraryAdaptiveCardPreviewUrl({
                surface: "media-library-modal-grid",
                signedUrl: posterSourceUrl,
                fileType: "image/jpeg",
                pressureLevel: adaptivePressureLevel,
                adaptivePreviewQualityEnabled,
                shouldBypassAdaptivePreview,
                cardLongEdgePx: cardPreviewLongEdgePx,
                devicePixelRatio: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
              })
          : null;

        return (
          <div key={item.key} style={renderItem.style}>
            {isAudio ? (
              <MediaLibraryAllItemsAudioCard
                file={file}
                isSelected={selectedIds.has(file.id)}
                previewAspectRatio={previewAspectRatio}
                cardPreviewUrl={cardPreviewUrl}
                hoverVideoUrl={null}
                posterPreviewUrl={null}
                fetchPriorityAttr={fetchPriorityAttr}
                getMediaCardRef={getMediaCardRef}
                onSelectMediaFile={onSelectMediaFile}
                onMediaDoubleClick={onMediaDoubleClick}
                onMediaDragStart={onMediaDragStart}
                onMediaDragEnd={onMediaDragEnd}
                onToggleMediaSelection={onToggleMediaSelection}
                onMediaContextMenu={onMediaContextMenu}
                onMediaPreviewError={onMediaPreviewError}
                onMediaPaint={onMediaPaint}
                onSignedUrlLoaded={onSignedUrlLoaded}
                onRequestSignedUrl={onRequestSignedUrl}
                cacheAspectRatio={cacheAspectRatio}
                showCardActions={
                  canShowWorkflowReloadAction || canShowRemoveAction || canShowDeleteAction
                }
                canShowDownloadAction={canShowDownloadAction}
                canShowWorkflowReloadAction={canShowWorkflowReloadAction}
                canShowRemoveAction={canShowRemoveAction}
                canShowDeleteAction={canShowDeleteAction}
                onDownloadMediaFile={onDownloadMediaFile}
                onReloadWorkflowFromMedia={onReloadWorkflowFromMedia}
                onRemoveMediaFromFolder={onRemoveMediaFromFolder}
                onDeleteMediaFromLibrary={onDeleteMediaFromLibrary}
              />
            ) : (
              <MediaLibraryAllItemsMediaCard
                file={file}
                isSelected={selectedIds.has(file.id)}
                previewAspectRatio={previewAspectRatio}
                cardPreviewUrl={cardPreviewUrl}
                hoverVideoUrl={hoverVideoUrl ?? null}
                posterPreviewUrl={posterPreviewUrl}
                fetchPriorityAttr={fetchPriorityAttr}
                getMediaCardRef={getMediaCardRef}
                onSelectMediaFile={onSelectMediaFile}
                onMediaDoubleClick={onMediaDoubleClick}
                onMediaDragStart={onMediaDragStart}
                onMediaDragEnd={onMediaDragEnd}
                onToggleMediaSelection={onToggleMediaSelection}
                onMediaContextMenu={onMediaContextMenu}
                onMediaPreviewError={onMediaPreviewError}
                onMediaPaint={onMediaPaint}
                onSignedUrlLoaded={onSignedUrlLoaded}
                onRequestSignedUrl={onRequestSignedUrl}
                cacheAspectRatio={cacheAspectRatio}
                showCardActions={shouldShowCardActions}
                canShowDownloadAction={canShowDownloadAction}
                canShowWorkflowReloadAction={canShowWorkflowReloadAction}
                canShowRemoveAction={canShowRemoveAction}
                canShowDeleteAction={canShowDeleteAction}
                onDownloadMediaFile={onDownloadMediaFile}
                onReloadWorkflowFromMedia={onReloadWorkflowFromMedia}
                onRemoveMediaFromFolder={onRemoveMediaFromFolder}
                onDeleteMediaFromLibrary={onDeleteMediaFromLibrary}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
