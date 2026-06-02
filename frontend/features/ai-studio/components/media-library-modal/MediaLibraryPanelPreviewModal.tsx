/**
 * Preview-only modal for AI Studio Media Library panel media cards.
 * Renders image/video detail previews without triggering reference ingest side effects.
 */
import React from "react";
import { isSupabaseRenderImageUrl } from "../../../../lib/mediaPreviewTrustPolicy";
import type { MediaLibraryDetailModalItem } from "../../logic/mediaLibraryDetailModal";
import { SharedMediaDetailContentLayout } from "../detail-modal/SharedMediaDetailContentLayout";
import { SharedMediaDetailInfoPanel } from "../detail-modal/SharedMediaDetailInfoPanel";
import { SharedMediaDetailPreviewMedia } from "../detail-modal/SharedMediaDetailPreviewMedia";
import { SharedMediaDetailTopBar } from "../detail-modal/SharedMediaDetailTopBar";
import {
  resolveSharedMediaDetailBladeContent,
  resolveSharedMediaDetailKindLabel,
  resolveSharedMediaDetailTitle,
} from "../detail-modal/sharedMediaDetailPresentation";
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
  const isVideo = item?.media.kind === "video";
  const isAudio = item?.media.kind === "audio";
  const title = item ? resolveSharedMediaDetailTitle(item) : "Media preview";
  const mediaTypeLabel = item ? resolveSharedMediaDetailKindLabel(item) : "image";
  const bladeContent = item
    ? resolveSharedMediaDetailBladeContent({
        item,
      })
    : { label: "PROMPT" as const, value: "" };
  const normalizedPreviewUrl = item?.media.url?.trim() ?? "";
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
      backdropClassName="reference-modal-backdrop media-library-panel-preview-backdrop"
      dialogClassName={`reference-modal-new ${isAudio ? "is-audio-modal" : ""}`}
      backdropDataTestId="media-library-panel-preview-backdrop"
      closeOnEscape
    >
      <SharedMediaDetailContentLayout
        topBar={
          <SharedMediaDetailTopBar
            items={[
              { label: mediaTypeLabel, className: "art-meta-item" },
              { label: title, className: "art-meta-item art-meta-filename", title },
            ]}
            onClose={onClose}
            closeLabel="Close media preview"
          />
        }
        stageClassName="art-image-vessel media-library-panel-preview-body"
        stage={
          <SharedMediaDetailPreviewMedia
            mediaUrl={canRenderMedia ? normalizedPreviewUrl : null}
            mediaKind={canRenderMedia ? (isVideo ? "video" : isAudio ? "audio" : "image") : null}
            altText={title}
            isLoading={isLoading}
            loadingMessage="Loading preview..."
            unavailableMessage={error || "Preview unavailable."}
            placeholderClassName="art-text-placeholder media-library-panel-preview-placeholder"
            imageClassName="art-hero-image media-library-panel-preview-media"
            videoClassName="art-hero-image media-library-panel-preview-media"
            audioClassName="art-hero-audio media-library-panel-preview-media"
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
        }
        sidePanel={
          <SharedMediaDetailInfoPanel
            label={bladeContent.label}
            value={bladeContent.value}
            placeholder="No prompt metadata available."
          />
        }
      />
    </SharedMediaDetailModalShell>
  );
}
