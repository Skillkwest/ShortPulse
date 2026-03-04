/**
 * Media asset gallery for Media Library data tabs.
 * Renders card grid interactions and optional load-more affordance.
 */
import { CheckCircle, DownloadSimple, Trash } from "phosphor-react";
import { useCallback, useMemo, type Ref, type SyntheticEvent } from "react";
import type { MediaDataTab } from "../logic/mediaLibraryPageHelpers";
import {
  isAdaptiveSurfaceEnabled,
  resolveAdaptiveMedia,
  resolveAdaptiveSourceKind,
} from "../../../lib/adaptive-media";
import { useMediaGridVideoBudgetController } from "../hooks/useMediaGridVideoBudgetController";
import { useMediaMasonryVirtualization } from "../hooks/useMediaMasonryVirtualization";
import {
  MEDIA_LIBRARY_VIDEO_BUDGET_ENABLED,
  MEDIA_LIBRARY_VIRTUALIZATION_ENABLED,
} from "../logic/mediaLibraryFeatureFlags";

type MediaAssetRow = {
  id: string;
  filename: string;
  file_type: string;
  signedUrl?: string;
  status?: "uploading" | "ready";
};

type MediaCardRefCallback = (node: HTMLDivElement | null) => void;

type MediaAssetGalleryProps<TRow extends MediaAssetRow> = {
  activeMediaQuery: string;
  activeMediaTab: MediaDataTab | null;
  aspectMap: Record<string, number>;
  downloadFile: (row: TRow) => Promise<void>;
  files: TRow[];
  fetchMediaTabPage: (
    tab: MediaDataTab,
    options?: { reset?: boolean; query?: string }
  ) => Promise<void>;
  getMediaCardRef: (fileId: string) => MediaCardRefCallback;
  handleImageLoad: (id: string, event: SyntheticEvent<HTMLImageElement>) => void;
  handleMediaPreviewError: (row: TRow) => void;
  handleVideoMeta: (id: string, event: SyntheticEvent<HTMLVideoElement>) => void;
  hasMoreMediaPages: boolean;
  isVideoFile: (fileType: string) => boolean;
  loadMoreSentinelRef: Ref<HTMLDivElement>;
  loadingMoreMedia: boolean;
  openModal: (file: TRow) => void;
  requestDeleteFile: (file: TRow) => void;
  selectedIds: string[];
  toggleSelect: (file: TRow) => void;
};

/**
 * Renders media cards and load-more controls for non-prompt tabs.
 * Inputs: media rows, card interaction handlers, and pagination metadata.
 * Output: media grid with optional load-more button.
 * Side effects: none.
 */
export function MediaAssetGallery<TRow extends MediaAssetRow>({
  activeMediaQuery,
  activeMediaTab,
  aspectMap,
  downloadFile,
  files,
  fetchMediaTabPage,
  getMediaCardRef,
  handleImageLoad,
  handleMediaPreviewError,
  handleVideoMeta,
  hasMoreMediaPages,
  isVideoFile,
  loadMoreSentinelRef,
  loadingMoreMedia,
  openModal,
  requestDeleteFile,
  selectedIds,
  toggleSelect,
}: MediaAssetGalleryProps<TRow>) {
  const isVideoFileType = useCallback(
    (fileType?: string | null) => isVideoFile(fileType ?? ""),
    [isVideoFile]
  );

  const {
    containerRef: virtualContainerRef,
    isVirtualized,
    totalHeight: virtualTotalHeight,
    renderItems: virtualRenderItems,
  } = useMediaMasonryVirtualization({
    items: files,
    getItemId: (item) => item.id,
    getAspectRatio: (item) =>
      aspectMap[item.id] || (isVideoFileType(item.file_type) ? 9 / 16 : 4 / 5),
    enabled: MEDIA_LIBRARY_VIRTUALIZATION_ENABLED,
    targetColumnWidth: 260,
    gap: 1,
    overscanPx: 960,
    minItemsToVirtualize: 28,
  });

  const videoBudgetItems = useMemo(
    () => files.map((file) => ({ id: file.id, fileType: file.file_type })),
    [files]
  );

  const { getVideoNodeRef, isVideoAutoplayEnabled, resolveVideoSource } =
    useMediaGridVideoBudgetController({
      items: videoBudgetItems,
      enabled: MEDIA_LIBRARY_VIDEO_BUDGET_ENABLED,
      surface: "media-library-route",
      isVideoFile: isVideoFileType,
      detachDelayMs: 900,
      visibilityThreshold: 0.52,
    });

  return (
    <>
      <div
        ref={virtualContainerRef}
        className={`media-grid media-grid-fixed media-grid-shell media-grid-packed${
          isVirtualized ? " media-grid-virtualized" : ""
        }`}
        style={isVirtualized ? { height: `${virtualTotalHeight}px` } : undefined}
      >
        {virtualRenderItems.map((renderItem) => {
          const file = renderItem.item;
          const aspectRatio =
            aspectMap[file.id] || (isVideoFileType(file.file_type) ? 9 / 16 : 4 / 5);
          const adaptiveCardPreview = file.signedUrl
            ? resolveAdaptiveMedia({
                surface: "media-library-grid",
                mediaKind: isVideoFileType(file.file_type) ? "video" : "image",
                source: resolveAdaptiveSourceKind(file.signedUrl),
                urls: {
                  previewUrl: file.signedUrl,
                  fullUrl: file.signedUrl,
                },
                storage: {},
                pressureLevel: 0,
                cardLongEdgePx: 320,
                devicePixelRatio: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
                strictPreviewLadder: true,
                adaptivePreviewQuality: isAdaptiveSurfaceEnabled("media-library-grid"),
              })
            : null;
          const cardPreviewUrl = adaptiveCardPreview?.previewUrl ?? file.signedUrl;
          const autoPlayEnabled = isVideoAutoplayEnabled(file.id);
          const managedVideoSrc = resolveVideoSource(file.id, cardPreviewUrl);
          const fetchPriorityAttr = renderItem.index < 8 ? "high" : "auto";
          return (
            <div
              className={`media-card ${file.status === "uploading" ? "is-uploading" : ""} ${
                selectedIds.includes(file.id) ? "is-selected" : ""
              }`}
              key={file.id}
              ref={getMediaCardRef(file.id)}
              style={renderItem.style}
              role="button"
              tabIndex={0}
              onClick={() => toggleSelect(file)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  toggleSelect(file);
                }
              }}
              onDoubleClick={(event) => {
                event.stopPropagation();
                openModal(file);
              }}
            >
              {file.status === "uploading" ? (
                <div className="media-thumb placeholder" style={{ aspectRatio }}>
                  <div className="loader-spin" />
                </div>
              ) : file.signedUrl ? (
                isVideoFileType(file.file_type) ? (
                  <video
                    className="media-thumb"
                    ref={getVideoNodeRef(file.id)}
                    src={managedVideoSrc}
                    muted
                    playsInline
                    loop
                    autoPlay={autoPlayEnabled}
                    preload={autoPlayEnabled ? "metadata" : "none"}
                    onLoadedMetadata={(event) => handleVideoMeta(file.id, event)}
                    onError={() => handleMediaPreviewError(file)}
                    style={{ aspectRatio }}
                  />
                ) : (
                  <>
                    {/* Signed URLs are dynamic and may include ephemeral query parameters. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      {...({ fetchpriority: fetchPriorityAttr } as Record<string, string>)}
                      src={cardPreviewUrl}
                      alt={file.filename}
                      className="media-thumb"
                      loading="lazy"
                      decoding="async"
                      onLoad={(event) => handleImageLoad(file.id, event)}
                      onError={() => handleMediaPreviewError(file)}
                      style={{ aspectRatio }}
                    />
                  </>
                )
              ) : (
                <div className="media-thumb placeholder" style={{ aspectRatio }} aria-hidden />
              )}
              {selectedIds.includes(file.id) ? (
                <span className="media-select-indicator" aria-hidden>
                  <CheckCircle size={13} weight="fill" />
                </span>
              ) : null}
              {file.status !== "uploading" ? (
                <div className="media-card-actions">
                  <button
                    type="button"
                    className="media-download"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      void downloadFile(file);
                    }}
                    aria-label={`Download file: ${file.filename || "media file"}`}
                  >
                    <DownloadSimple size={14} weight="bold" />
                  </button>
                  <button
                    type="button"
                    className="media-delete"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      requestDeleteFile(file);
                    }}
                    aria-label={`Delete file: ${file.filename || "media file"}`}
                  >
                    <Trash size={14} weight="bold" />
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {hasMoreMediaPages ? (
        <div className="media-load-more" ref={loadMoreSentinelRef}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              if (!activeMediaTab) return;
              void fetchMediaTabPage(activeMediaTab, { query: activeMediaQuery });
            }}
            disabled={loadingMoreMedia}
          >
            {loadingMoreMedia ? "Loading more..." : "Load more"}
          </button>
        </div>
      ) : null}
    </>
  );
}
