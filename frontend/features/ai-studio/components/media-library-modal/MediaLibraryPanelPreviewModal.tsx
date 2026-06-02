/**
 * Preview-only modal for AI Studio Media Library panel media cards.
 * Renders image/video detail previews without triggering reference ingest side effects.
 */
import React from "react";
import { X } from "phosphor-react";
import { isSupabaseRenderImageUrl } from "../../../../lib/mediaPreviewTrustPolicy";
import type { MediaLibraryDetailModalItem } from "../../logic/mediaLibraryDetailModal";
import { SharedMediaDetailPreviewMedia } from "../detail-modal/SharedMediaDetailPreviewMedia";
import { useExclusiveSoundMediaElement } from "../shared/exclusiveSoundPlayback";
import { SharedMediaDetailModalShell } from "../detail-modal/SharedMediaDetailModalShell";

type MediaLibraryPanelPreviewModalProps = {
  item: MediaLibraryDetailModalItem | null;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
  onPreviewError?: (item: MediaLibraryDetailModalItem, failedUrl: string) => void;
};

/**
 * Renders a modal preview for a selected media card.
 * Inputs: selected file row, resolved preview URL, loading/error state, and close callback.
 * Output: modal markup when `file` is set.
 * Side effects: closes on Escape key.
 */
export function MediaLibraryPanelPreviewModal({
  item,
  isLoading,
  error,
  onClose,
  onPreviewError,
}: MediaLibraryPanelPreviewModalProps) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const videoPlayback = useExclusiveSoundMediaElement(
    `media-library-preview-video:${item?.file.id ?? "none"}`,
    videoRef
  );
  const audioPlayback = useExclusiveSoundMediaElement(
    `media-library-preview-audio:${item?.file.id ?? "none"}`,
    audioRef
  );
  const [failedPreviewUrl, setFailedPreviewUrl] = React.useState<string | null>(null);
  const isVideo = item?.fileType === "video";
  const isAudio = item?.fileType === "audio";
  const title = (item?.filename ?? "").trim() || "Media preview";
  const normalizedPreviewUrl = item?.url?.trim() ?? "";
  const isForbiddenImagePreviewUrl =
    !isVideo &&
    !isAudio &&
    (normalizedPreviewUrl.startsWith("/_next/image") ||
      isSupabaseRenderImageUrl(normalizedPreviewUrl));
  const canRenderMedia = Boolean(
    normalizedPreviewUrl && normalizedPreviewUrl !== failedPreviewUrl && !isForbiddenImagePreviewUrl
  );

  React.useEffect(() => {
    setFailedPreviewUrl(null);
  }, [item?.file.id, normalizedPreviewUrl]);

  const handlePreviewError = React.useCallback(() => {
    if (!item || !normalizedPreviewUrl) return;
    setFailedPreviewUrl(normalizedPreviewUrl);
    onPreviewError?.(item, normalizedPreviewUrl);
  }, [item, normalizedPreviewUrl, onPreviewError]);

  const handleVideoPreviewError = React.useCallback(() => {
    videoPlayback.handleError();
    handlePreviewError();
  }, [handlePreviewError, videoPlayback]);

  const handleAudioPreviewError = React.useCallback(() => {
    audioPlayback.handleError();
    handlePreviewError();
  }, [audioPlayback, handlePreviewError]);

  if (!item) return null;

  return (
    <SharedMediaDetailModalShell
      isOpen={Boolean(item)}
      modalActivityId="media-library-panel-preview-modal"
      onClose={onClose}
      ariaLabel={`Preview ${title}`}
      backdropClassName="media-library-panel-preview-backdrop"
      dialogClassName="media-library-panel-preview-modal"
      backdropDataTestId="media-library-panel-preview-backdrop"
      closeOnEscape
    >
      <header className="media-library-panel-preview-head">
        <p className="tiny subdued media-library-panel-preview-title">{title}</p>
        <button
          type="button"
          className="reference-card-action-btn media-library-panel-preview-close"
          aria-label="Close media preview"
          onClick={onClose}
        >
          <X size={16} weight="bold" aria-hidden />
        </button>
      </header>

      <div className="media-library-panel-preview-body">
        <SharedMediaDetailPreviewMedia
          mediaUrl={canRenderMedia ? normalizedPreviewUrl : null}
          mediaKind={canRenderMedia ? (isVideo ? "video" : isAudio ? "audio" : "image") : null}
          altText={title}
          isLoading={isLoading}
          loadingMessage="Loading preview..."
          unavailableMessage={error || "Preview unavailable."}
          placeholderClassName="tiny subdued"
          imageClassName="media-library-panel-preview-media"
          videoClassName="media-library-panel-preview-media"
          audioClassName="media-library-panel-preview-media"
          videoRef={videoRef}
          audioRef={audioRef}
          onImageError={handlePreviewError}
          onVideoPlay={videoPlayback.handlePlay}
          onVideoPause={videoPlayback.handlePause}
          onVideoEnded={videoPlayback.handleEnded}
          onVideoError={handleVideoPreviewError}
          onVideoVolumeChange={videoPlayback.handleVolumeChange}
          onAudioPlay={audioPlayback.handlePlay}
          onAudioPause={audioPlayback.handlePause}
          onAudioEnded={audioPlayback.handleEnded}
          onAudioError={handleAudioPreviewError}
          onAudioVolumeChange={audioPlayback.handleVolumeChange}
        />
      </div>
    </SharedMediaDetailModalShell>
  );
}
