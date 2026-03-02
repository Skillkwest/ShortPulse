import React, { type MutableRefObject } from "react";
import { CheckCircle } from "phosphor-react";
import {
  isAdaptiveSurfaceEnabled,
  resolveAdaptiveMedia,
  resolveAdaptiveSourceKind,
} from "../../../../lib/adaptive-media";
import { useMediaGridVideoBudgetController } from "../../../media-library/hooks/useMediaGridVideoBudgetController";
import { useMediaMasonryVirtualization } from "../../../media-library/hooks/useMediaMasonryVirtualization";
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

type MediaLibraryMediaGridProps = {
  activeMedia: MediaFileRow[];
  selectedIds: Set<string>;
  optimizerFallbackMediaIds: Set<string>;
  scrollContainerRef?: MutableRefObject<HTMLElement | null>;
  getMediaCardRef: (fileId: string) => MediaCardRefCallback;
  onSelectMediaFile: (file: MediaFileRow) => void;
  onMediaPreviewError: (file: MediaFileRow, failedUrl?: string | null) => void;
  onMediaPaint: (assetKind: "image" | "video") => void;
  onSignedUrlLoaded: (id: string) => void;
};

export function MediaLibraryMediaGrid({
  activeMedia,
  selectedIds,
  optimizerFallbackMediaIds,
  scrollContainerRef,
  getMediaCardRef,
  onSelectMediaFile,
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

  const { getVideoNodeRef, isVideoAutoplayEnabled, resolveVideoSource } =
    useMediaGridVideoBudgetController({
      items: activeMedia.map((file) => ({ id: file.id, fileType: file.file_type })),
      enabled: MEDIA_LIBRARY_VIDEO_BUDGET_ENABLED,
      surface: "media-library-modal",
      isVideoFile: (fileType) => isVideoFile(fileType ?? ""),
      scrollContainerRef,
      detachDelayMs: 850,
      visibilityThreshold: 0.5,
    });

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
          const isSelected = selectedIds.has(file.id);
          const shouldBypassAdaptivePreview = optimizerFallbackMediaIds.has(file.id);
          const previewAspectRatio = resolveMediaCardAspectRatio({
            fileType: file.file_type,
            metadata: file.metadata,
          });
          const adaptiveCardPreview =
            file.signedUrl && !shouldBypassAdaptivePreview
              ? resolveAdaptiveMedia({
                  surface: "media-library-modal-grid",
                  mediaKind: isVideoFile(file.file_type) ? "video" : "image",
                  source: resolveAdaptiveSourceKind(file.signedUrl),
                  urls: {
                    previewUrl: file.signedUrl,
                    fullUrl: file.signedUrl,
                  },
                  storage: {},
                  pressureLevel: 0,
                  cardLongEdgePx: 320,
                  devicePixelRatio:
                    typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
                  strictPreviewLadder: true,
                  adaptivePreviewQuality: isAdaptiveSurfaceEnabled("media-library-modal-grid"),
                })
              : null;
          const cardPreviewUrl = shouldBypassAdaptivePreview
            ? file.signedUrl
            : (adaptiveCardPreview?.previewUrl ?? file.signedUrl);
          const autoPlayEnabled = isVideoAutoplayEnabled(file.id);
          const managedVideoSrc = resolveVideoSource(file.id, cardPreviewUrl);
          const fetchPriorityAttr = renderItem.index < 8 ? "high" : "auto";

          return (
            <button
              key={file.id}
              type="button"
              className={`media-card media-library-modal-card${isSelected ? " is-selected" : ""}`}
              ref={getMediaCardRef(file.id)}
              style={renderItem.style}
              aria-pressed={isSelected}
              onClick={() => onSelectMediaFile(file)}
            >
              {isSelected ? (
                <span className="media-library-select-indicator" aria-hidden>
                  <CheckCircle size={16} weight="fill" />
                </span>
              ) : null}
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
          );
        })
      )}
    </div>
  );
}
