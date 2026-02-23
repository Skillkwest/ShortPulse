import React from "react";
import { CheckCircle } from "phosphor-react";
import {
  isAdaptiveSurfaceEnabled,
  resolveAdaptiveMedia,
  resolveAdaptiveSourceKind,
} from "../../../../lib/adaptive-media";
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
  getMediaCardRef,
  onSelectMediaFile,
  onMediaPreviewError,
  onMediaPaint,
  onSignedUrlLoaded,
}: MediaLibraryMediaGridProps) {
  return (
    <div className="media-grid media-library-modal-grid media-library-modal-grid-packed">
      {activeMedia.length === 0 ? (
        <p className="tiny subdued">No media found for this tab.</p>
      ) : (
        activeMedia.map((file) => {
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

          return (
            <button
              key={file.id}
              type="button"
              className={`media-card media-library-modal-card${isSelected ? " is-selected" : ""}`}
              ref={getMediaCardRef(file.id)}
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
                    src={cardPreviewUrl}
                    muted
                    playsInline
                    loop
                    autoPlay
                    preload="metadata"
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
