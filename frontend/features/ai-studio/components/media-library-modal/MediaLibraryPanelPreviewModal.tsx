/**
 * Preview-only modal for AI Studio Media Library panel media cards.
 * Renders image/video detail previews without triggering reference ingest side effects.
 */
import React from "react";
import { X } from "phosphor-react";
import { isSupabaseRenderImageUrl } from "../../../../lib/mediaPreviewTrustPolicy";
import { isAudioFile, isVideoFile, type MediaFileRow } from "../../logic/mediaLibraryModalModel";
import { useGuardedBackdropDismiss } from "../../../../components/useGuardedBackdropDismiss";
import { AiStudioModalLayer, useAiStudioModalActivity } from "../modal-layer/AiStudioModalLayer";
import { useExclusiveSoundMediaElement } from "../shared/exclusiveSoundPlayback";

type MediaLibraryPanelPreviewModalProps = {
  file: MediaFileRow | null;
  previewUrl: string | null;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
  onPreviewError?: (file: MediaFileRow, failedUrl: string) => void;
};

/**
 * Renders a modal preview for a selected media card.
 * Inputs: selected file row, resolved preview URL, loading/error state, and close callback.
 * Output: modal markup when `file` is set.
 * Side effects: closes on Escape key.
 */
export function MediaLibraryPanelPreviewModal({
  file,
  previewUrl,
  isLoading,
  error,
  onClose,
  onPreviewError,
}: MediaLibraryPanelPreviewModalProps) {
  useAiStudioModalActivity("media-library-panel-preview-modal", Boolean(file));
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const videoPlayback = useExclusiveSoundMediaElement(
    `media-library-preview-video:${file?.id ?? "none"}`,
    videoRef
  );
  const audioPlayback = useExclusiveSoundMediaElement(
    `media-library-preview-audio:${file?.id ?? "none"}`,
    audioRef
  );
  const [failedPreviewUrl, setFailedPreviewUrl] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!file || typeof document === "undefined") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [file, onClose]);
  const backdropDismiss = useGuardedBackdropDismiss<HTMLDivElement>(onClose, {
    disabled: !file,
  });

  const isVideo = Boolean(file && isVideoFile(file.file_type));
  const isAudio = Boolean(file && isAudioFile(file.file_type));
  const title = (file?.filename ?? "").trim() || "Media preview";
  const normalizedPreviewUrl = previewUrl?.trim() ?? "";
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
  }, [file?.id, normalizedPreviewUrl]);

  const handlePreviewError = React.useCallback(() => {
    if (!file || !normalizedPreviewUrl) return;
    setFailedPreviewUrl(normalizedPreviewUrl);
    onPreviewError?.(file, normalizedPreviewUrl);
  }, [file, normalizedPreviewUrl, onPreviewError]);

  const handleVideoPreviewError = React.useCallback(() => {
    videoPlayback.handleError();
    handlePreviewError();
  }, [handlePreviewError, videoPlayback]);

  const handleAudioPreviewError = React.useCallback(() => {
    audioPlayback.handleError();
    handlePreviewError();
  }, [audioPlayback, handlePreviewError]);

  if (!file) return null;

  return (
    <AiStudioModalLayer>
      <div
        {...backdropDismiss}
        className="media-library-panel-preview-backdrop"
        role="presentation"
        data-testid="media-library-panel-preview-backdrop"
      >
        <div
          className="media-library-panel-preview-modal"
          role="dialog"
          aria-modal="true"
          aria-label={`Preview ${title}`}
          onClick={(event) => event.stopPropagation()}
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
            {isLoading && !canRenderMedia ? <p className="tiny subdued">Loading preview…</p> : null}
            {!isLoading && !canRenderMedia ? (
              <p className="tiny subdued">{error || "Preview unavailable."}</p>
            ) : null}
            {canRenderMedia && isVideo ? (
              <video
                className="media-library-panel-preview-media"
                src={previewUrl ?? undefined}
                ref={videoRef}
                controls
                autoPlay
                playsInline
                onPlay={videoPlayback.handlePlay}
                onPause={videoPlayback.handlePause}
                onEnded={videoPlayback.handleEnded}
                onError={handleVideoPreviewError}
                onVolumeChange={videoPlayback.handleVolumeChange}
              />
            ) : null}
            {canRenderMedia && isAudio ? (
              <audio
                className="media-library-panel-preview-media"
                src={previewUrl ?? undefined}
                ref={audioRef}
                controls
                autoPlay
                onPlay={audioPlayback.handlePlay}
                onPause={audioPlayback.handlePause}
                onEnded={audioPlayback.handleEnded}
                onError={handleAudioPreviewError}
                onVolumeChange={audioPlayback.handleVolumeChange}
              />
            ) : null}
            {canRenderMedia && !isVideo && !isAudio ? (
              <>
                {/* Signed URLs are generated dynamically at runtime. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="media-library-panel-preview-media"
                  src={normalizedPreviewUrl}
                  alt={title}
                  onError={handlePreviewError}
                />
              </>
            ) : null}
          </div>
        </div>
      </div>
    </AiStudioModalLayer>
  );
}
