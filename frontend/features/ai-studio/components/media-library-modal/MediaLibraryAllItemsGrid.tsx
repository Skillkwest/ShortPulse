import React, { type MutableRefObject } from "react";
import { CheckCircle, DownloadSimple, X } from "phosphor-react";
import { getSignedMediaUrlsBatch } from "../../../../lib/mediaSignedUrlCache";
import { resolveVideoPosterSigningStoragePaths } from "../../../../lib/mediaPreviewPath";
import { useMediaMasonryVirtualization } from "../../../media-library/hooks/useMediaMasonryVirtualization";
import { resolveMediaLibraryAdaptiveCardPreviewUrl } from "../../../media-library/logic/mediaLibraryAdaptivePreview";
import { MEDIA_LIBRARY_VIRTUALIZATION_ENABLED } from "../../../media-library/logic/mediaLibraryFeatureFlags";
import { isVideoUrl } from "../../logic/stateParsers";
import { resolveMediaCardAspectRatio } from "../../logic/mediaLibraryAspectRatio";
import { MediaLibraryPromptReferenceCard } from "./MediaLibraryPromptReferenceCard";
import {
  BUCKET,
  createdAtTime,
  isAudioFile,
  isVideoFile,
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
  onMediaDragStart?: (event: React.DragEvent<HTMLButtonElement>, file: MediaFileRow) => void;
  onPromptDragStart?: (event: React.DragEvent<HTMLButtonElement>, prompt: PromptRow) => void;
  onMediaDragEnd?: (event: React.DragEvent<HTMLButtonElement>, file: MediaFileRow) => void;
  onPromptDragEnd?: (event: React.DragEvent<HTMLButtonElement>, prompt: PromptRow) => void;
  onToggleMediaSelection?: (file: MediaFileRow) => void;
  showRemoveAction?: boolean;
  onRemoveMediaFromFolder?: (file: MediaFileRow) => void;
  onRemovePromptFromFolder?: (prompt: PromptRow) => void;
  showDeleteAction?: boolean;
  onDeleteMediaFromLibrary?: (file: MediaFileRow) => void;
  onDeletePromptFromLibrary?: (prompt: PromptRow) => void;
  onDownloadMediaFile?: (file: MediaFileRow) => void;
  onMediaContextMenu?: (event: React.MouseEvent<HTMLButtonElement>, file: MediaFileRow) => void;
  onMediaPreviewError: (file: MediaFileRow, failedUrl?: string | null) => void;
  onMediaPaint: (assetKind: "image" | "video") => void;
  onSignedUrlLoaded: (id: string) => void;
  currentUserId?: string | null;
};

type MediaLibraryAllItem =
  | { key: string; kind: "media"; id: string; createdAt: number; row: MediaFileRow }
  | { key: string; kind: "prompt"; id: string; createdAt: number; row: PromptRow };

const PROMPT_CARD_ASPECT_RATIO = 4 / 5;
const RENDERABLE_IMAGE_URL_PATTERN = /^(?:https?:\/\/|blob:|data:image\/|\/)/i;

const asRenderableImageUrl = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || isVideoUrl(trimmed)) return null;
  return RENDERABLE_IMAGE_URL_PATTERN.test(trimmed) ? trimmed : null;
};

const resolveVideoPosterSourceUrl = (
  file: MediaFileRow,
  signedPosterUrl: string | null,
  hoverVideoUrl: string | null
): string | null => {
  if (!isVideoFile(file.file_type)) return null;
  return (
    asRenderableImageUrl(signedPosterUrl) ??
    asRenderableImageUrl(file.poster_variant_path) ??
    asRenderableImageUrl(file.thumb_variant_path) ??
    (hoverVideoUrl && !isVideoUrl(hoverVideoUrl) ? hoverVideoUrl : null)
  );
};

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
  onMediaDragStart?: (event: React.DragEvent<HTMLButtonElement>, file: MediaFileRow) => void;
  onMediaDragEnd?: (event: React.DragEvent<HTMLButtonElement>, file: MediaFileRow) => void;
  onToggleMediaSelection?: (file: MediaFileRow) => void;
  onMediaContextMenu?: (event: React.MouseEvent<HTMLButtonElement>, file: MediaFileRow) => void;
  onMediaPreviewError: (file: MediaFileRow, failedUrl?: string | null) => void;
  onMediaPaint: (assetKind: "image" | "video") => void;
  onSignedUrlLoaded: (id: string) => void;
  cacheAspectRatio: (id: string, ratio: number) => void;
  showCardActions: boolean;
  canShowDownloadAction: boolean;
  canShowRemoveAction: boolean;
  canShowDeleteAction: boolean;
  onDownloadMediaFile?: (file: MediaFileRow) => void;
  onRemoveMediaFromFolder?: (file: MediaFileRow) => void;
  onDeleteMediaFromLibrary?: (file: MediaFileRow) => void;
};

type MediaCardActionsProps = {
  file: MediaFileRow;
  canShowDownloadAction: boolean;
  canShowRemoveAction: boolean;
  canShowDeleteAction: boolean;
  onDownloadMediaFile?: (file: MediaFileRow) => void;
  onRemoveMediaFromFolder?: (file: MediaFileRow) => void;
  onDeleteMediaFromLibrary?: (file: MediaFileRow) => void;
};

function MediaLibraryAllItemsCardActions({
  file,
  canShowDownloadAction,
  canShowRemoveAction,
  canShowDeleteAction,
  onDownloadMediaFile,
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
  cacheAspectRatio,
  showCardActions,
  canShowDownloadAction,
  canShowRemoveAction,
  canShowDeleteAction,
  onDownloadMediaFile,
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
          {isSelected ? <CheckCircle size={16} weight="fill" aria-hidden /> : null}
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
        onDragStart={(event) => onMediaDragStart?.(event, file)}
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
              preload="metadata"
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
        </div>
      </button>
      {showCardActions ? (
        <MediaLibraryAllItemsCardActions
          file={file}
          canShowDownloadAction={canShowDownloadAction}
          canShowRemoveAction={canShowRemoveAction}
          canShowDeleteAction={canShowDeleteAction}
          onDownloadMediaFile={onDownloadMediaFile}
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
  showCardActions,
  canShowDownloadAction,
  canShowRemoveAction,
  canShowDeleteAction,
  onDownloadMediaFile,
  onRemoveMediaFromFolder,
  onDeleteMediaFromLibrary,
}: MediaCardShellProps) {
  const audioUrl = cardPreviewUrl ?? file.signedUrl ?? null;
  const signedUrlLoadedRef = React.useRef(false);

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
          {isSelected ? <CheckCircle size={16} weight="fill" aria-hidden /> : null}
        </button>
      ) : null}
      <button
        type="button"
        className="media-card media-library-panel-media-card-button media-library-panel-audio-card-button"
        ref={getMediaCardRef(file.id)}
        aria-pressed={isSelected}
        draggable={Boolean(onMediaDragStart)}
        onClick={() =>
          onToggleMediaSelection ? onToggleMediaSelection(file) : onSelectMediaFile(file)
        }
        onDoubleClick={() => onMediaDoubleClick?.(file)}
        onDragStart={(event) => onMediaDragStart?.(event, file)}
        onDragEnd={(event) => onMediaDragEnd?.(event, file)}
        onContextMenu={(event) => onMediaContextMenu?.(event, file)}
      >
        <div
          className="media-library-panel-media-frame media-library-panel-audio-frame"
          style={{ aspectRatio: previewAspectRatio }}
        >
          <div
            className="media-thumb placeholder media-library-panel-audio-placeholder"
            aria-hidden
          />
          <div className="media-library-panel-audio-meta">
            <span className="media-library-panel-audio-label">Audio</span>
            <span className="media-library-panel-audio-filename">{file.filename}</span>
          </div>
        </div>
      </button>
      <div className="media-library-panel-audio-controls">
        <audio
          controls
          preload="metadata"
          src={audioUrl ?? undefined}
          aria-label={`Play audio ${file.filename}`}
          onLoadedMetadata={() => {
            markSignedUrlLoaded();
          }}
          onCanPlay={() => {
            markSignedUrlLoaded();
          }}
          onError={() => onMediaPreviewError(file, audioUrl)}
        />
      </div>
      {showCardActions ? (
        <MediaLibraryAllItemsCardActions
          file={file}
          canShowDownloadAction={canShowDownloadAction}
          canShowRemoveAction={canShowRemoveAction}
          canShowDeleteAction={canShowDeleteAction}
          onDownloadMediaFile={onDownloadMediaFile}
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
  onMediaContextMenu,
  onMediaPreviewError,
  onMediaPaint,
  onSignedUrlLoaded,
  currentUserId = null,
}: MediaLibraryAllItemsGridProps) {
  const [aspectRatioById, setAspectRatioById] = React.useState<Record<string, number>>({});
  const [signedPosterUrlById, setSignedPosterUrlById] = React.useState<Record<string, string>>({});
  const [signedVideoUrlById, setSignedVideoUrlById] = React.useState<Record<string, string>>({});

  const cacheAspectRatio = React.useCallback((id: string, ratio: number) => {
    if (!Number.isFinite(ratio) || ratio <= 0) return;
    setAspectRatioById((prev) => {
      if (prev[id] === ratio) return prev;
      return { ...prev, [id]: ratio };
    });
  }, []);

  React.useEffect(() => {
    const activeIdSet = new Set(mediaRows.map((item) => item.id));
    setAspectRatioById((prev) => {
      let changed = false;
      const next: Record<string, number> = {};
      for (const [id, ratio] of Object.entries(prev)) {
        if (!activeIdSet.has(id)) {
          changed = true;
          continue;
        }
        next[id] = ratio;
      }
      return changed ? next : prev;
    });
  }, [mediaRows]);

  React.useEffect(() => {
    const videoRows = mediaRows.filter(
      (row) => isVideoFile(row.file_type) && (row.storage_path ?? "").trim().length > 0
    );

    if (videoRows.length === 0) {
      setSignedVideoUrlById((prev) => (Object.keys(prev).length > 0 ? {} : prev));
      return;
    }

    const storagePathByRowId = new Map<string, string>();
    const storagePaths: string[] = [];
    for (const row of videoRows) {
      const storagePath = (row.storage_path ?? "").trim();
      if (!storagePath) continue;
      storagePathByRowId.set(row.id, storagePath);
      storagePaths.push(storagePath);
    }

    if (storagePaths.length === 0) {
      setSignedVideoUrlById((prev) => (Object.keys(prev).length > 0 ? {} : prev));
      return;
    }

    let cancelled = false;
    void getSignedMediaUrlsBatch({
      bucket: BUCKET,
      storagePaths,
      surface: "media-library-panel",
    })
      .then((signedByPath) => {
        if (cancelled) return;
        const nextById: Record<string, string> = {};
        for (const [rowId, storagePath] of storagePathByRowId.entries()) {
          const signedUrl = signedByPath.get(storagePath) ?? null;
          if (signedUrl) {
            nextById[rowId] = signedUrl;
          }
        }
        setSignedVideoUrlById((prev) => {
          const prevKeys = Object.keys(prev);
          const nextKeys = Object.keys(nextById);
          if (
            prevKeys.length === nextKeys.length &&
            nextKeys.every((key) => prev[key] === nextById[key])
          ) {
            return prev;
          }
          return nextById;
        });
      })
      .catch(() => {
        if (cancelled) return;
        setSignedVideoUrlById((prev) => (Object.keys(prev).length > 0 ? {} : prev));
      });

    return () => {
      cancelled = true;
    };
  }, [mediaRows]);

  React.useEffect(() => {
    const videoPosterRows = mediaRows.filter((row) => {
      if (!isVideoFile(row.file_type)) return false;
      const posterCandidates = resolveVideoPosterSigningStoragePaths(row, currentUserId);
      return posterCandidates.length > 0;
    });

    if (videoPosterRows.length === 0) {
      setSignedPosterUrlById((prev) => (Object.keys(prev).length > 0 ? {} : prev));
      return;
    }

    const posterPathByRowId = new Map<string, string[]>();
    const posterPaths: string[] = [];
    for (const row of videoPosterRows) {
      const candidates = resolveVideoPosterSigningStoragePaths(row, currentUserId);
      if (candidates.length === 0) continue;
      posterPathByRowId.set(row.id, candidates);
      posterPaths.push(...candidates);
    }

    if (posterPaths.length === 0) {
      setSignedPosterUrlById((prev) => (Object.keys(prev).length > 0 ? {} : prev));
      return;
    }

    let cancelled = false;
    void getSignedMediaUrlsBatch({
      bucket: BUCKET,
      storagePaths: posterPaths,
      surface: "media-library-panel",
    })
      .then((signedByPath) => {
        if (cancelled) return;
        const nextById: Record<string, string> = {};
        for (const [rowId, candidates] of posterPathByRowId.entries()) {
          const signedUrl = candidates
            .map((candidate) => signedByPath.get(candidate) ?? null)
            .find((candidate): candidate is string => Boolean(candidate));
          if (signedUrl) {
            nextById[rowId] = signedUrl;
          }
        }
        setSignedPosterUrlById((prev) => {
          const prevKeys = Object.keys(prev);
          const nextKeys = Object.keys(nextById);
          if (
            prevKeys.length === nextKeys.length &&
            nextKeys.every((key) => prev[key] === nextById[key])
          ) {
            return prev;
          }
          return nextById;
        });
      })
      .catch(() => {
        if (cancelled) return;
        setSignedPosterUrlById((prev) => (Object.keys(prev).length > 0 ? {} : prev));
      });

    return () => {
      cancelled = true;
    };
  }, [currentUserId, mediaRows]);

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
    return items.sort((left, right) => {
      const createdDelta = right.createdAt - left.createdAt;
      if (createdDelta !== 0) return createdDelta;
      return right.key.localeCompare(left.key);
    });
  }, [mediaRows, promptRows]);

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
    targetColumnWidth: 188,
    gap: 1,
    overscanPx: 920,
    minItemsToVirtualize: 24,
  });

  if (combinedItems.length === 0) {
    return <p className="tiny subdued">No saved items yet.</p>;
  }

  return (
    <div
      ref={virtualContainerRef}
      className={`media-grid media-library-modal-grid media-library-modal-grid-packed media-library-panel-all-items-grid${
        isVirtualized ? " media-library-modal-grid-virtualized" : ""
      }`}
      style={isVirtualized ? { height: `${virtualTotalHeight}px` } : undefined}
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
        const canShowRemoveAction = showRemoveAction && Boolean(onRemoveMediaFromFolder);
        const canShowDeleteAction = showDeleteAction && Boolean(onDeleteMediaFromLibrary);
        const canShowDownloadAction = Boolean(
          onDownloadMediaFile && (file.signedUrl ?? "").trim().length > 0
        );
        const shouldShowCardActions =
          canShowDownloadAction || canShowRemoveAction || canShowDeleteAction;
        const shouldBypassAdaptivePreview = optimizerFallbackMediaIds.has(file.id);
        const previewAspectRatio =
          aspectRatioById[file.id] ??
          resolveMediaCardAspectRatio({
            fileType: file.file_type,
            width: file.width ?? null,
            height: file.height ?? null,
            metadata: file.metadata,
          });
        const cardPreviewUrl = resolveCardPreviewUrl
          ? resolveCardPreviewUrl({
              signedUrl: file.signedUrl,
              fileType: file.file_type,
              pressureLevel: adaptivePressureLevel,
              adaptivePreviewQualityEnabled,
              shouldBypassAdaptivePreview,
              cardLongEdgePx: 320,
              devicePixelRatio: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
            })
          : resolveMediaLibraryAdaptiveCardPreviewUrl({
              surface: "media-library-modal-grid",
              signedUrl: file.signedUrl,
              fileType: file.file_type,
              pressureLevel: adaptivePressureLevel,
              adaptivePreviewQualityEnabled,
              shouldBypassAdaptivePreview,
              cardLongEdgePx: 320,
              devicePixelRatio: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
            });
        const fetchPriorityAttr = renderItem.index < 8 ? "high" : "auto";
        const signedPosterUrl = signedPosterUrlById[file.id] ?? null;
        const hoverVideoUrl = isVideoFile(file.file_type)
          ? (signedVideoUrlById[file.id] ??
            (file.signedUrl && isVideoUrl(file.signedUrl) ? file.signedUrl : null))
          : null;
        const posterSourceUrl = resolveVideoPosterSourceUrl(file, signedPosterUrl, hoverVideoUrl);
        const posterPreviewUrl = posterSourceUrl
          ? resolveCardPreviewUrl
            ? resolveCardPreviewUrl({
                signedUrl: posterSourceUrl,
                fileType: "image/jpeg",
                pressureLevel: adaptivePressureLevel,
                adaptivePreviewQualityEnabled,
                shouldBypassAdaptivePreview,
                cardLongEdgePx: 320,
                devicePixelRatio: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
              })
            : resolveMediaLibraryAdaptiveCardPreviewUrl({
                surface: "media-library-modal-grid",
                signedUrl: posterSourceUrl,
                fileType: "image/jpeg",
                pressureLevel: adaptivePressureLevel,
                adaptivePreviewQualityEnabled,
                shouldBypassAdaptivePreview,
                cardLongEdgePx: 320,
                devicePixelRatio: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
              })
          : null;
        const isAudio = isAudioFile(file.file_type);

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
                cacheAspectRatio={cacheAspectRatio}
                showCardActions={shouldShowCardActions}
                canShowDownloadAction={canShowDownloadAction}
                canShowRemoveAction={canShowRemoveAction}
                canShowDeleteAction={canShowDeleteAction}
                onDownloadMediaFile={onDownloadMediaFile}
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
                cacheAspectRatio={cacheAspectRatio}
                showCardActions={shouldShowCardActions}
                canShowDownloadAction={canShowDownloadAction}
                canShowRemoveAction={canShowRemoveAction}
                canShowDeleteAction={canShowDeleteAction}
                onDownloadMediaFile={onDownloadMediaFile}
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
