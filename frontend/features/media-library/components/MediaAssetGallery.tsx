/**
 * Media asset gallery for Media Library data tabs.
 * Renders card grid interactions and optional load-more affordance.
 */
import { CheckCircle, DownloadSimple, Trash } from "phosphor-react";
import type { Ref, SyntheticEvent } from "react";
import type { MediaDataTab } from "../logic/mediaLibraryPageHelpers";
import {
  isAdaptiveSurfaceEnabled,
  resolveAdaptiveMedia,
  resolveAdaptiveSourceKind,
} from "../../../lib/adaptive-media";

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
  return (
    <>
      <div className="media-grid media-grid-fixed media-grid-shell media-grid-packed">
        {files.map((file) => {
          const aspectRatio = aspectMap[file.id] || (isVideoFile(file.file_type) ? 9 / 16 : 4 / 5);
          const adaptiveCardPreview = file.signedUrl
            ? resolveAdaptiveMedia({
                surface: "media-library-grid",
                mediaKind: isVideoFile(file.file_type) ? "video" : "image",
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
          return (
            <div
              className={`media-card ${file.status === "uploading" ? "is-uploading" : ""} ${
                selectedIds.includes(file.id) ? "is-selected" : ""
              }`}
              key={file.id}
              ref={getMediaCardRef(file.id)}
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
                isVideoFile(file.file_type) ? (
                  <video
                    className="media-thumb"
                    src={cardPreviewUrl}
                    muted
                    playsInline
                    loop
                    autoPlay
                    preload="metadata"
                    onLoadedMetadata={(event) => handleVideoMeta(file.id, event)}
                    onError={() => handleMediaPreviewError(file)}
                    style={{ aspectRatio }}
                  />
                ) : (
                  <>
                    {/* Signed URLs are dynamic and may include ephemeral query parameters. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={cardPreviewUrl}
                      alt={file.filename}
                      className="media-thumb"
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
