import React from "react";
import { isSupabaseRenderImageUrl } from "../../../../lib/mediaPreviewTrustPolicy";
import type { SharedMediaDetailItemBase } from "./detailModalPlatformTypes";
import { SharedMediaDetailContentLayout } from "./SharedMediaDetailContentLayout";
import { SharedMediaDetailInfoPanel } from "./SharedMediaDetailInfoPanel";
import { SharedMediaDetailModalShell } from "./SharedMediaDetailModalShell";
import { SharedMediaDetailPreviewMedia } from "./SharedMediaDetailPreviewMedia";
import { SharedMediaDetailTopBar } from "./SharedMediaDetailTopBar";
import {
  resolveSharedMediaDetailBladePlaceholder,
  resolveSharedMediaDetailBladeContent,
  resolveSharedMediaDetailTopBarItems,
  resolveSharedMediaDetailTitle,
} from "./sharedMediaDetailPresentation";
import { useExclusiveSoundMediaElement } from "../shared/exclusiveSoundPlayback";

type SharedMediaDetailPreviewModalProps = {
  item: SharedMediaDetailItemBase | null;
  isLoading?: boolean;
  error?: string | null;
  onClose: () => void;
  onPreviewError?: (item: SharedMediaDetailItemBase, failedUrl: string) => void;
  topBarActions?: React.ReactNode;
  modalActivityId?: string;
  ariaLabelPrefix?: string;
  backdropClassName?: string;
  dialogClassName?: string;
  backdropDataTestId?: string;
  closeLabel?: string;
  loadingMessage?: string;
  unavailableMessage?: string;
  stageClassName?: string;
  placeholderClassName?: string;
  imageClassName?: string;
  videoClassName?: string;
  audioClassName?: string;
};

/**
 * Shared media detail modal body for cross-surface non-output-backed dialogs.
 * Keeps shell, stage, metadata, and optional actions aligned for library and canvas detail opens.
 */
export function SharedMediaDetailPreviewModal({
  item,
  isLoading = false,
  error = null,
  onClose,
  onPreviewError,
  topBarActions = null,
  modalActivityId = "shared-media-detail-preview-modal",
  ariaLabelPrefix = "Preview",
  backdropClassName = "reference-modal-backdrop",
  dialogClassName,
  backdropDataTestId,
  closeLabel = "Close media preview",
  loadingMessage = "Loading preview...",
  unavailableMessage = "Preview unavailable.",
  stageClassName = "art-image-vessel",
  placeholderClassName = "art-text-placeholder",
  imageClassName = "art-hero-image",
  videoClassName = "art-hero-image",
  audioClassName = "art-hero-audio",
}: SharedMediaDetailPreviewModalProps) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const videoPlayback = useExclusiveSoundMediaElement(
    `${modalActivityId}:video:${item?.media.id ?? "none"}`,
    videoRef
  );
  const audioPlayback = useExclusiveSoundMediaElement(
    `${modalActivityId}:audio:${item?.media.id ?? "none"}`,
    audioRef
  );
  const [failedPreviewUrl, setFailedPreviewUrl] = React.useState<string | null>(null);
  const isVideo = item?.media.kind === "video";
  const isAudio = item?.media.kind === "audio";
  const title = item ? resolveSharedMediaDetailTitle(item) : "Media preview";
  const isExternalUpload = Boolean(
    item?.media.source?.trim()?.toLowerCase() === "upload" && item.media.filename?.trim()
  );
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
  }, [item?.media.id, normalizedPreviewUrl]);

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
      modalActivityId={modalActivityId}
      onClose={onClose}
      ariaLabel={`${ariaLabelPrefix} ${title}`}
      backdropClassName={backdropClassName}
      dialogClassName={
        dialogClassName ??
        `reference-modal-new ${isAudio ? "is-audio-modal" : ""} ${isExternalUpload ? "is-uploaded is-stage-only" : ""}`.trim()
      }
      backdropDataTestId={backdropDataTestId}
      closeOnEscape
    >
      <SharedMediaDetailContentLayout
        topBar={
          <SharedMediaDetailTopBar
            eyebrow="Media detail"
            title={title}
            items={item ? resolveSharedMediaDetailTopBarItems(item) : []}
            centerTitle={isExternalUpload}
            actions={topBarActions}
            onClose={onClose}
            closeLabel={closeLabel}
          />
        }
        stageClassName={stageClassName}
        stage={
          <SharedMediaDetailPreviewMedia
            mediaUrl={canRenderMedia ? normalizedPreviewUrl : null}
            mediaKind={canRenderMedia ? (isVideo ? "video" : isAudio ? "audio" : "image") : null}
            altText={title}
            isLoading={isLoading}
            loadingMessage={loadingMessage}
            unavailableMessage={error || unavailableMessage}
            placeholderClassName={placeholderClassName}
            imageClassName={imageClassName}
            videoClassName={videoClassName}
            audioClassName={audioClassName}
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
          isExternalUpload ? null : (
            <SharedMediaDetailInfoPanel
              label={bladeContent.label}
              value={bladeContent.value}
              placeholder={item ? resolveSharedMediaDetailBladePlaceholder(item) : undefined}
            />
          )
        }
      />
    </SharedMediaDetailModalShell>
  );
}
