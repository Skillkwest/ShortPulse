import React, { type MutableRefObject } from "react";
import { DownloadSimple, X } from "phosphor-react";
import { useMediaGridVideoBudgetController } from "../../../media-library/hooks/useMediaGridVideoBudgetController";
import { useMediaMasonryVirtualization } from "../../../media-library/hooks/useMediaMasonryVirtualization";
import { resolveMediaLibraryAdaptiveCardPreviewUrl } from "../../../media-library/logic/mediaLibraryAdaptivePreview";
import {
  MEDIA_LIBRARY_VIDEO_BUDGET_ENABLED,
  MEDIA_LIBRARY_VIRTUALIZATION_ENABLED,
} from "../../../media-library/logic/mediaLibraryFeatureFlags";
import { resolveMediaCardAspectRatio } from "../../logic/mediaLibraryAspectRatio";
import {
  isVideoFile,
  type MediaFileRow,
  type MediaCardRefCallback,
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
  onMediaDragStart?: (event: React.DragEvent<HTMLButtonElement>, file: MediaFileRow) => void;
  onMediaDragEnd?: (event: React.DragEvent<HTMLButtonElement>, file: MediaFileRow) => void;
  showRemoveAction?: boolean;
  onRemoveMediaFromFolder?: (file: MediaFileRow) => void;
  showDeleteAction?: boolean;
  onDeleteMediaFromLibrary?: (file: MediaFileRow) => void;
  onDownloadMediaFile?: (file: MediaFileRow) => void;
  onMediaContextMenu?: (event: React.MouseEvent<HTMLButtonElement>, file: MediaFileRow) => void;
  onMediaPreviewError: (file: MediaFileRow, failedUrl?: string | null) => void;
  onMediaPaint: (assetKind: "image" | "video") => void;
  onSignedUrlLoaded: (id: string) => void;
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
  showRemoveAction = false,
  onRemoveMediaFromFolder,
  showDeleteAction = false,
  onDeleteMediaFromLibrary,
  onDownloadMediaFile,
  onMediaContextMenu,
  onMediaPreviewError,
  onMediaPaint,
  onSignedUrlLoaded,
}: MediaLibraryMediaGridProps) {
  const {
    containerRef: virtualContainerRef,
    isVirtualized,
    totalHeight: virtualTotalHeight,
    renderItems: virtualRenderItems,
  } = useMediaMasonryVirtualization({
    items: activeMedia,
    getItemId: (item) => item.id,
    getAspectRatio: (item) =>
      resolveMediaCardAspectRatio({
        fileType: item.file_type,
        metadata: item.metadata,
      }),
    enabled: MEDIA_LIBRARY_VIRTUALIZATION_ENABLED,
    scrollContainerRef,
    targetColumnWidth: 220,
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
      surface: "media-library-modal",
      isVideoFile: isVideoFileType,
      scrollContainerRef,
      detachDelayMs: 850,
      visibilityThreshold: 0.5,
    });
  void selectedIds;

  return (
    <div
      ref={virtualContainerRef}
      className={`media-grid media-library-modal-grid media-library-modal-grid-packed${
        isVirtualized ? " media-library-modal-grid-virtualized" : ""
      }`}
      style={isVirtualized ? { height: `${virtualTotalHeight}px` } : undefined}
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
          const canShowDownloadAction = Boolean(
            onDownloadMediaFile && (file.signedUrl ?? "").trim().length > 0
          );
          const shouldShowCardActions =
            canShowDownloadAction || canShowRemoveAction || canShowDeleteAction;
          const shouldBypassAdaptivePreview = optimizerFallbackMediaIds.has(file.id);
          const previewAspectRatio = resolveMediaCardAspectRatio({
            fileType: file.file_type,
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
          const autoPlayEnabled = isVideoAutoplayEnabled(file.id);
          const managedVideoSrc = resolveVideoSource(file.id, cardPreviewUrl);
          const fetchPriorityAttr = renderItem.index < 8 ? "high" : "auto";

          return (
            <div
              key={file.id}
              className="media-library-modal-card media-library-panel-media-card-shell"
              style={renderItem.style}
            >
              <button
                type="button"
                className="media-card media-library-panel-media-card-button"
                ref={getMediaCardRef(file.id)}
                draggable={Boolean(onMediaDragStart)}
                onClick={() => onSelectMediaFile(file)}
                onDoubleClick={() => onMediaDoubleClick?.(file)}
                onDragStart={(event) => onMediaDragStart?.(event, file)}
                onDragEnd={(event) => onMediaDragEnd?.(event, file)}
                onContextMenu={(event) => onMediaContextMenu?.(event, file)}
              >
                {cardPreviewUrl ? (
                  isVideoFile(file.file_type) ? (
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
                      onLoadedMetadata={() => {
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
                        onLoad={() => {
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
