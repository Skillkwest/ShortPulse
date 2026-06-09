import React, { type MutableRefObject } from "react";
import { Check, DownloadSimple, FlowArrow, X } from "phosphor-react";
import {
  resolveDurablePreviewStoragePath,
  resolveVideoPosterStoragePath,
} from "../../../../lib/mediaPreviewPath";
import { useMediaGridVideoBudgetController } from "../../../media-library/hooks/useMediaGridVideoBudgetController";
import { useMediaMasonryVirtualization } from "../../../media-library/hooks/useMediaMasonryVirtualization";
import { resolveMediaLibraryAdaptiveCardPreviewUrl } from "../../../media-library/logic/mediaLibraryAdaptivePreview";
import {
  MEDIA_LIBRARY_VIDEO_BUDGET_ENABLED,
  MEDIA_LIBRARY_VIRTUALIZATION_ENABLED,
  type MediaLibraryGridDensityConfig,
} from "../../../media-library/logic/mediaLibraryRuntimeConfig";
import { resolveMediaCardAspectRatio } from "../../logic/mediaLibraryAspectRatio";
import { canReloadMediaLibraryWorkflow } from "../../logic/mediaLibraryWorkflowReload";
import {
  isAudioFile,
  isVideoFile,
  resolveMediaMetadataAudioSourceMode,
  resolveMediaMetadataDurationMs,
  resolveMediaMetadataWaveformPeaks,
  type MediaFileRow,
  type MediaCardRefCallback,
} from "../../logic/mediaLibraryModalModel";
import { ReferenceAudioPlayer } from "../shared/ReferenceAudioPlayer";
import type { MediaLibraryMediaDragPreview } from "./MediaLibraryAllItemsGrid";
import { useMediaAspectRatioCache } from "./useMediaAspectRatioCache";

type ResolveMediaLibraryGridPreviewUrlArgs = {
  signedUrl: string | null | undefined;
  fileType?: string | null;
  pressureLevel: 0 | 1 | 2;
  adaptivePreviewQualityEnabled: boolean;
  shouldBypassAdaptivePreview?: boolean;
  cardLongEdgePx?: number;
  devicePixelRatio?: number;
};

type MediaLibraryMediaGridProps = {
  activeMedia: MediaFileRow[];
  selectedIds: Set<string>;
  optimizerFallbackMediaIds: Set<string>;
  adaptivePressureLevel: 0 | 1 | 2;
  adaptivePreviewQualityEnabled: boolean;
  resolveCardPreviewUrl?: (args: ResolveMediaLibraryGridPreviewUrlArgs) => string | null;
  scrollContainerRef?: MutableRefObject<HTMLElement | null>;
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
  showRemoveAction?: boolean;
  onRemoveMediaFromFolder?: (file: MediaFileRow) => void;
  showDeleteAction?: boolean;
  onDeleteMediaFromLibrary?: (file: MediaFileRow) => void;
  onDownloadMediaFile?: (file: MediaFileRow) => void;
  onReloadWorkflowFromMedia?: (file: MediaFileRow) => void;
  onMediaContextMenu?: (event: React.MouseEvent<HTMLElement>, file: MediaFileRow) => void;
  onMediaPreviewError: (file: MediaFileRow, failedUrl?: string | null) => void;
  onMediaPaint: (assetKind: "image" | "video") => void;
  onSignedUrlLoaded: (id: string) => void;
  onRequestSignedUrl?: (file: MediaFileRow) => Promise<string | null>;
  visibleMediaIdsRef?: MutableRefObject<Set<string>>;
  surface?:
    | "media-library-modal"
    | "media-library-panel"
    | "elements-media-panel"
    | "character-media-panel";
  densityConfig?: MediaLibraryGridDensityConfig;
  fixedVisualAspectRatio?: number | null;
};

export function MediaLibraryMediaGrid({
  activeMedia,
  selectedIds,
  optimizerFallbackMediaIds,
  adaptivePressureLevel,
  adaptivePreviewQualityEnabled,
  resolveCardPreviewUrl,
  scrollContainerRef,
  getMediaCardRef,
  onSelectMediaFile,
  onMediaDoubleClick,
  onMediaDragStart,
  onMediaDragEnd,
  onToggleMediaSelection,
  showRemoveAction = false,
  onRemoveMediaFromFolder,
  showDeleteAction = false,
  onDeleteMediaFromLibrary,
  onDownloadMediaFile,
  onReloadWorkflowFromMedia,
  onMediaContextMenu,
  onMediaPreviewError,
  onMediaPaint,
  onSignedUrlLoaded,
  onRequestSignedUrl,
  surface = "media-library-modal",
  densityConfig,
  fixedVisualAspectRatio = null,
}: MediaLibraryMediaGridProps) {
  const { aspectRatioById, cacheAspectRatio } = useMediaAspectRatioCache(activeMedia);
  const targetColumnWidth = densityConfig?.targetColumnWidth ?? 220;
  const cardPreviewLongEdgePx = densityConfig?.previewLongEdgePx ?? 320;

  const {
    containerRef: virtualContainerRef,
    isVirtualized,
    totalHeight: virtualTotalHeight,
    renderItems: virtualRenderItems,
  } = useMediaMasonryVirtualization({
    items: activeMedia,
    getItemId: (item) => item.id,
    getAspectRatio: (item) => {
      if (
        !isAudioFile(item.file_type) &&
        typeof fixedVisualAspectRatio === "number" &&
        Number.isFinite(fixedVisualAspectRatio) &&
        fixedVisualAspectRatio > 0
      ) {
        return fixedVisualAspectRatio;
      }
      const cachedRatio = aspectRatioById[item.id];
      if (Number.isFinite(cachedRatio) && cachedRatio > 0) return cachedRatio;
      return resolveMediaCardAspectRatio({
        fileType: item.file_type,
        width: item.width ?? null,
        height: item.height ?? null,
        metadata: item.metadata,
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

  const videoBudgetItems = React.useMemo(
    () => activeMedia.map((file) => ({ id: file.id, fileType: file.file_type })),
    [activeMedia]
  );
  const isVideoFileType = React.useCallback(
    (fileType?: string | null) => isVideoFile(fileType ?? ""),
    []
  );

  const { getVideoNodeRef, isVideoAutoplayEnabled, resolveVideoSource } =
    useMediaGridVideoBudgetController({
      items: videoBudgetItems,
      enabled: MEDIA_LIBRARY_VIDEO_BUDGET_ENABLED,
      surface,
      isVideoFile: isVideoFileType,
      scrollContainerRef,
      detachDelayMs: 850,
      visibilityThreshold: 0.5,
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

  return (
    <div
      ref={virtualContainerRef}
      className={`media-grid media-library-modal-grid media-library-modal-grid-packed${
        isVirtualized ? " media-library-modal-grid-virtualized" : ""
      }${densityConfig ? " media-library-panel-density-grid" : ""}`}
      style={gridStyle}
    >
      {activeMedia.length === 0 ? (
        <p className="tiny subdued">No media found for this tab.</p>
      ) : (
        virtualRenderItems.map((renderItem) => {
          const file = renderItem.item;
          const supportsRemoveAction = Boolean(onRemoveMediaFromFolder);
          const canShowRemoveAction = showRemoveAction && supportsRemoveAction;
          const supportsDeleteAction = Boolean(onDeleteMediaFromLibrary);
          const canShowDeleteAction = showDeleteAction && supportsDeleteAction;
          const isAudio = isAudioFile(file.file_type);
          const hasDownloadableMediaSource = Boolean(
            (file.storage_path ?? "").trim() || (file.signedUrl ?? "").trim()
          );
          const canShowDownloadAction = Boolean(
            !isAudio && onDownloadMediaFile && (file.signedUrl ?? "").trim().length > 0
          );
          const canShowAudioDownloadAction = Boolean(
            isAudio && onDownloadMediaFile && hasDownloadableMediaSource
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
          const durablePreviewPath = resolveDurablePreviewStoragePath(file);
          const posterPreviewPath = resolveVideoPosterStoragePath(file);
          const shouldRenderVideoPreview =
            isVideoFile(file.file_type) &&
            (!durablePreviewPath || !posterPreviewPath || durablePreviewPath !== posterPreviewPath);
          const autoPlayEnabled = isVideoAutoplayEnabled(file.id);
          const managedVideoSrc = resolveVideoSource(file.id, cardPreviewUrl);
          const fetchPriorityAttr = renderItem.index < 8 ? "high" : "auto";
          const isSelected = selectedIds.has(file.id);

          if (isAudio) {
            const durationMs = resolveMediaMetadataDurationMs(file.metadata, {
              fileType: file.file_type,
            });
            const audioSourceMode = resolveMediaMetadataAudioSourceMode(file.metadata);
            const audioUrl = cardPreviewUrl ?? file.signedUrl ?? null;

            return (
              <div
                key={file.id}
                className={`media-library-modal-card media-library-panel-media-card-shell media-library-panel-audio-card-shell${
                  isSelected ? " is-active" : ""
                }`}
                style={renderItem.style}
              >
                {onToggleMediaSelection && isSelected ? (
                  <button
                    type="button"
                    className="media-library-panel-selection-toggle is-selected"
                    aria-label={`Deselect ${file.filename || "audio"}`}
                    aria-pressed={isSelected}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onToggleMediaSelection(file);
                    }}
                  >
                    <Check size={17} weight="fill" aria-hidden />
                  </button>
                ) : null}
                <div
                  role="button"
                  tabIndex={0}
                  className="reference-card has-audio media-library-panel-audio-reference-card"
                  ref={getMediaCardRef(file.id)}
                  aria-pressed={onToggleMediaSelection ? isSelected : undefined}
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
                  onDragStart={(event) =>
                    onMediaDragStart?.(event, file, {
                      aspectRatio: previewAspectRatio,
                    })
                  }
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
                      canShowAudioDownloadAction
                        ? () => {
                            onDownloadMediaFile?.(file);
                          }
                        : undefined
                    }
                    onResolveAudioUrl={
                      onRequestSignedUrl ? () => onRequestSignedUrl(file) : undefined
                    }
                    onReady={() => onSignedUrlLoaded(file.id)}
                    onError={() => onMediaPreviewError(file, audioUrl)}
                    eagerWaveformDecode={false}
                  />
                </div>
                {shouldShowCardActions ? (
                  <div className="media-library-panel-card-actions" aria-label="Folder actions">
                    {canShowDownloadAction ? (
                      <button
                        type="button"
                        className="reference-card-action-btn media-library-panel-card-download-btn"
                        aria-label={`Download ${file.filename || "media"}`}
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
                    {canShowRemoveAction || canShowDeleteAction ? (
                      <button
                        type="button"
                        className="reference-card-action-btn reference-card-action-btn--danger media-library-panel-card-remove-btn"
                        aria-label={
                          canShowDeleteAction
                            ? `Delete ${file.filename || "media"} from library`
                            : `Remove ${file.filename || "media"} from this folder`
                        }
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
                        <X size={16} weight="bold" aria-hidden />
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          }

          return (
            <div
              key={file.id}
              className={`media-library-modal-card media-library-panel-media-card-shell${
                isSelected ? " is-active" : ""
              }`}
              style={renderItem.style}
            >
              {onToggleMediaSelection && isSelected ? (
                <button
                  type="button"
                  className={`media-library-panel-selection-toggle${
                    isSelected ? " is-selected" : ""
                  }`}
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
                aria-pressed={onToggleMediaSelection ? isSelected : undefined}
                draggable={Boolean(onMediaDragStart)}
                onClick={() =>
                  onToggleMediaSelection ? onToggleMediaSelection(file) : onSelectMediaFile(file)
                }
                onDoubleClick={() => onMediaDoubleClick?.(file)}
                onDragStart={(event) =>
                  onMediaDragStart?.(event, file, {
                    aspectRatio: previewAspectRatio,
                  })
                }
                onDragEnd={(event) => onMediaDragEnd?.(event, file)}
                onContextMenu={(event) => onMediaContextMenu?.(event, file)}
              >
                {cardPreviewUrl ? (
                  shouldRenderVideoPreview ? (
                    <video
                      className="media-thumb"
                      ref={getVideoNodeRef(file.id)}
                      src={managedVideoSrc}
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
                )}
              </button>
              {shouldShowCardActions ? (
                <div className="media-library-panel-card-actions" aria-label="Folder actions">
                  {canShowDownloadAction ? (
                    <button
                      type="button"
                      className="reference-card-action-btn media-library-panel-card-download-btn"
                      aria-label={`Download ${file.filename || "media"}`}
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
                  {canShowRemoveAction || canShowDeleteAction ? (
                    <button
                      type="button"
                      className="reference-card-action-btn reference-card-action-btn--danger media-library-panel-card-remove-btn"
                      aria-label={
                        canShowDeleteAction
                          ? `Delete ${file.filename || "media"} from library`
                          : `Remove ${file.filename || "media"} from this folder`
                      }
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
                      <X size={16} weight="bold" aria-hidden />
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })
      )}
    </div>
  );
}
