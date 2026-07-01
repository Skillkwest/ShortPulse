import React, { type MutableRefObject } from "react";
import {
  resolveDurablePreviewStoragePath,
  resolveVideoPosterStoragePath,
} from "../../../../lib/mediaPreviewPath";
import { resolveMediaRowKind } from "../../../../lib/mediaRowKind";
import { useMediaGridVideoBudgetController } from "../../../media-library/hooks/useMediaGridVideoBudgetController";
import { useMediaMasonryVirtualization } from "../../../media-library/hooks/useMediaMasonryVirtualization";
import { resolveMediaLibraryAdaptiveCardPreviewUrl } from "../../../media-library/logic/mediaLibraryAdaptivePreview";
import {
  MEDIA_LIBRARY_VIDEO_BUDGET_ENABLED,
  MEDIA_LIBRARY_VIRTUALIZATION_ENABLED,
  type MediaLibraryGridDensityConfig,
} from "../../../media-library/logic/mediaLibraryRuntimeConfig";
import {
  MEDIA_AUDIO_CARD_ASPECT_RATIO,
  resolveMediaCardAspectRatio,
} from "../../logic/mediaLibraryAspectRatio";
import {
  isVideoFile,
  type MediaFileRow,
  type MediaCardRefCallback,
} from "../../logic/mediaLibraryModalModel";
import {
  MediaLibraryAudioCard,
  MediaLibraryVisualMediaCard,
  buildMediaLibraryCardActionLabels,
  canShowMediaLibraryRerollAction,
  resolveMediaLibraryCardDisplayLabel,
  type MediaLibraryMediaDragPreview,
} from "./MediaLibraryMediaCard";
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
  onRerollWorkflowFromMedia?: (file: MediaFileRow) => void;
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
  onRerollWorkflowFromMedia,
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
  const shouldUsePackedMasonryLayout = Boolean(densityConfig);
  const layoutMode: "chronological-grid" | "masonry" = shouldUsePackedMasonryLayout
    ? "masonry"
    : "chronological-grid";

  const {
    containerRef: virtualContainerRef,
    isVirtualized,
    totalHeight: virtualTotalHeight,
    renderItems: virtualRenderItems,
  } = useMediaMasonryVirtualization({
    items: activeMedia,
    getItemId: (item) => item.id,
    getAspectRatio: (item) => {
      const mediaKind = resolveMediaRowKind(item);
      if (mediaKind === "audio") return MEDIA_AUDIO_CARD_ASPECT_RATIO;
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
        fileType: mediaKind,
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
    minItemsToVirtualize: shouldUsePackedMasonryLayout ? 1 : 24,
    layoutMode,
  });

  const videoBudgetItems = React.useMemo(
    () => activeMedia.map((file) => ({ id: file.id, fileType: resolveMediaRowKind(file) })),
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
      pressureLevel: adaptivePressureLevel,
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
          const mediaKind = resolveMediaRowKind(file);
          const isAudio = mediaKind === "audio";
          const isVideo = mediaKind === "video";
          const hasDownloadableMediaSource = Boolean(
            (file.storage_path ?? "").trim() || (file.signedUrl ?? "").trim()
          );
          const canShowDownloadAction = Boolean(
            !isAudio && onDownloadMediaFile && (file.signedUrl ?? "").trim().length > 0
          );
          const canShowAudioDownloadAction = Boolean(
            isAudio && onDownloadMediaFile && hasDownloadableMediaSource
          );
          const canShowRerollAction = canShowMediaLibraryRerollAction(
            file,
            onRerollWorkflowFromMedia
          );
          const shouldShowCardActions =
            canShowDownloadAction ||
            canShowAudioDownloadAction ||
            canShowRerollAction ||
            canShowRemoveAction ||
            canShowDeleteAction;
          const shouldBypassAdaptivePreview = optimizerFallbackMediaIds.has(file.id);
          const previewAspectRatio = isAudio
            ? MEDIA_AUDIO_CARD_ASPECT_RATIO
            : typeof fixedVisualAspectRatio === "number" &&
                Number.isFinite(fixedVisualAspectRatio) &&
                fixedVisualAspectRatio > 0
              ? fixedVisualAspectRatio
              : (aspectRatioById[file.id] ??
                resolveMediaCardAspectRatio({
                  fileType: mediaKind,
                  width: file.width ?? null,
                  height: file.height ?? null,
                  metadata: file.metadata,
                }));
          const cardPreviewUrl = resolveCardPreviewUrl
            ? resolveCardPreviewUrl({
                signedUrl: file.signedUrl,
                fileType: mediaKind,
                pressureLevel: adaptivePressureLevel,
                adaptivePreviewQualityEnabled,
                shouldBypassAdaptivePreview,
                cardLongEdgePx: cardPreviewLongEdgePx,
                devicePixelRatio: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
              })
            : resolveMediaLibraryAdaptiveCardPreviewUrl({
                surface: "media-library-modal-grid",
                signedUrl: file.signedUrl,
                fileType: mediaKind,
                pressureLevel: adaptivePressureLevel,
                adaptivePreviewQualityEnabled,
                shouldBypassAdaptivePreview,
                cardLongEdgePx: cardPreviewLongEdgePx,
                devicePixelRatio: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
              });
          const durablePreviewPath = resolveDurablePreviewStoragePath(file);
          const posterPreviewPath = resolveVideoPosterStoragePath(file);
          const shouldRenderVideoPreview =
            isVideo &&
            (!durablePreviewPath || !posterPreviewPath || durablePreviewPath !== posterPreviewPath);
          const autoPlayEnabled = isVideoAutoplayEnabled(file.id);
          const managedVideoSrc = resolveVideoSource(file.id, cardPreviewUrl);
          const fetchPriorityAttr = renderItem.index < 8 ? "high" : "auto";
          const isSelected = selectedIds.has(file.id);
          const mediaLabel = resolveMediaLibraryCardDisplayLabel(file);

          if (isAudio) {
            return (
              <MediaLibraryAudioCard
                key={file.id}
                file={file}
                isSelected={isSelected}
                previewAspectRatio={previewAspectRatio}
                cardPreviewUrl={cardPreviewUrl}
                fetchPriorityAttr={fetchPriorityAttr}
                getMediaCardRef={getMediaCardRef}
                onSelectMediaFile={onSelectMediaFile}
                onMediaDoubleClick={onMediaDoubleClick}
                onMediaDragStart={onMediaDragStart}
                onMediaDragEnd={onMediaDragEnd}
                onToggleMediaSelection={onToggleMediaSelection}
                onMediaContextMenu={onMediaContextMenu}
                onMediaPreviewError={onMediaPreviewError}
                onSignedUrlLoaded={onSignedUrlLoaded}
                onRequestSignedUrl={onRequestSignedUrl}
                cacheAspectRatio={cacheAspectRatio}
                showCardActions={shouldShowCardActions}
                canShowDownloadAction={canShowAudioDownloadAction}
                canShowRerollAction={canShowRerollAction}
                canShowRemoveAction={canShowRemoveAction}
                canShowDeleteAction={canShowDeleteAction}
                actionLabels={buildMediaLibraryCardActionLabels(file, {
                  actionAriaLabel: "Folder actions",
                  downloadLabelPrefix: "Download audio",
                  removeLabel: `Remove ${mediaLabel} from this folder`,
                  deleteLabel: `Delete ${mediaLabel} from library`,
                })}
                dangerActionMode="exclusive"
                onDownloadMediaFile={onDownloadMediaFile}
                onRerollWorkflowFromMedia={onRerollWorkflowFromMedia}
                onRemoveMediaFromFolder={onRemoveMediaFromFolder}
                onDeleteMediaFromLibrary={onDeleteMediaFromLibrary}
                shellStyle={renderItem.style}
                dragPreview={{ aspectRatio: previewAspectRatio }}
              />
            );
          }

          return (
            <MediaLibraryVisualMediaCard
              key={file.id}
              variant="media-grid"
              file={file}
              isSelected={isSelected}
              previewAspectRatio={previewAspectRatio}
              cardPreviewUrl={cardPreviewUrl}
              adaptivePressureLevel={adaptivePressureLevel}
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
              canShowRerollAction={canShowRerollAction}
              canShowRemoveAction={canShowRemoveAction}
              canShowDeleteAction={canShowDeleteAction}
              actionLabels={buildMediaLibraryCardActionLabels(file, {
                actionAriaLabel: "Folder actions",
                downloadLabelPrefix: "Download",
                removeLabel: `Remove ${mediaLabel} from this folder`,
                deleteLabel: `Delete ${mediaLabel} from library`,
              })}
              dangerActionMode="exclusive"
              onDownloadMediaFile={onDownloadMediaFile}
              onRerollWorkflowFromMedia={onRerollWorkflowFromMedia}
              onRemoveMediaFromFolder={onRemoveMediaFromFolder}
              onDeleteMediaFromLibrary={onDeleteMediaFromLibrary}
              shellStyle={renderItem.style}
              dragPreview={{ aspectRatio: previewAspectRatio }}
              shouldRenderVideoPreview={shouldRenderVideoPreview}
              managedVideoSrc={managedVideoSrc}
              autoPlayEnabled={autoPlayEnabled}
              getVideoNodeRef={getVideoNodeRef}
            />
          );
        })
      )}
    </div>
  );
}
