import React from "react";
import { isSupabaseRenderImageUrl } from "../../../../lib/mediaPreviewTrustPolicy";
import type {
  SharedMediaDetailActionItem,
  SharedMediaDetailItemBase,
  SharedMediaDetailVideoSnapshotErrorHandler,
  SharedMediaDetailVideoSnapshotHandler,
} from "./detailModalPlatformTypes";
import { SharedMediaDetailActionBar } from "./SharedMediaDetailActionBar";
import { SharedMediaDetailContentLayout } from "./SharedMediaDetailContentLayout";
import { SharedMediaDetailInfoPanel } from "./SharedMediaDetailInfoPanel";
import { SharedMediaDetailModalShell } from "./SharedMediaDetailModalShell";
import { SharedMediaDetailPreviewMedia } from "./SharedMediaDetailPreviewMedia";
import { SharedMediaDetailTopBar } from "./SharedMediaDetailTopBar";
import { SharedMediaDetailVideoSnapshotControl } from "./SharedMediaDetailVideoSnapshotControl";
import {
  resolveSharedMediaDetailBladePlaceholder,
  resolveSharedMediaDetailBladeContent,
  resolveSharedMediaDetailTopBarItems,
  resolveSharedMediaDetailTitle,
  shouldRenderSharedMediaDetailInfoPanel,
} from "./sharedMediaDetailPresentation";
import { useExclusiveSoundMediaElement } from "../shared/exclusiveSoundPlayback";

const normalizePreviewCandidate = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const isForbiddenImagePreviewUrl = (value: string): boolean =>
  value.startsWith("/_next/image") || isSupabaseRenderImageUrl(value);

const resolveSharedPreviewCandidates = (item: SharedMediaDetailItemBase | null): string[] => {
  if (!item) return [];
  const media = item.media;
  const candidates =
    media.kind === "image"
      ? [media.url, media.fullUrl, media.previewUrl, media.companionArtUrl]
      : [media.url, media.fullUrl, media.previewUrl];
  const uniqueCandidates = new Set<string>();
  candidates.forEach((candidate) => {
    const normalized = normalizePreviewCandidate(candidate);
    if (!normalized) return;
    if (media.kind === "image" && isForbiddenImagePreviewUrl(normalized)) return;
    uniqueCandidates.add(normalized);
  });
  return Array.from(uniqueCandidates);
};

type SharedMediaDetailPreviewModalProps = {
  item: SharedMediaDetailItemBase | null;
  isLoading?: boolean;
  error?: string | null;
  onClose: () => void;
  onPreviewError?: (item: SharedMediaDetailItemBase, failedUrl: string) => void;
  onSnapshotVideoFrame?: SharedMediaDetailVideoSnapshotHandler;
  onSnapshotVideoFrameError?: SharedMediaDetailVideoSnapshotErrorHandler;
  topBarActionItems?: SharedMediaDetailActionItem[];
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
  onSnapshotVideoFrame,
  onSnapshotVideoFrameError,
  topBarActionItems = [],
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
  const [failedPreviewUrls, setFailedPreviewUrls] = React.useState<string[]>([]);
  const [displayPreviewUrl, setDisplayPreviewUrl] = React.useState<string | null>(null);
  const isVideo = item?.media.kind === "video";
  const isAudio = item?.media.kind === "audio";
  const itemIdentityKey = item
    ? `${item.surface}:${item.selectionTarget.kind}:${item.media.kind}:${item.media.id}`
    : "none";
  const title = item ? resolveSharedMediaDetailTitle(item) : "Media preview";
  const isExternalUpload = Boolean(
    item?.media.source?.trim()?.toLowerCase() === "upload" && item.media.filename?.trim()
  );
  const bladeContent = item
    ? resolveSharedMediaDetailBladeContent({
        item,
      })
    : { label: "PROMPT" as const, value: "" };
  const shouldRenderInfoPanel = item
    ? shouldRenderSharedMediaDetailInfoPanel(item, bladeContent)
    : false;
  const previewCandidates = React.useMemo(() => resolveSharedPreviewCandidates(item), [item]);
  const preferredPreviewUrl =
    previewCandidates.find((candidate) => !failedPreviewUrls.includes(candidate)) ?? null;
  const activePreviewUrl = displayPreviewUrl;
  const canRenderMedia = Boolean(activePreviewUrl);

  React.useEffect(() => {
    setFailedPreviewUrls([]);
    setDisplayPreviewUrl(null);
  }, [itemIdentityKey]);

  React.useEffect(() => {
    if (!item || !preferredPreviewUrl) {
      setDisplayPreviewUrl(null);
      return;
    }

    if (item.media.kind !== "image") {
      setDisplayPreviewUrl(preferredPreviewUrl);
      return;
    }

    setDisplayPreviewUrl((currentPreviewUrl) => {
      if (!currentPreviewUrl || !previewCandidates.includes(currentPreviewUrl)) {
        return preferredPreviewUrl;
      }
      if (currentPreviewUrl === preferredPreviewUrl) return currentPreviewUrl;
      if (failedPreviewUrls.includes(currentPreviewUrl)) return preferredPreviewUrl;
      return currentPreviewUrl;
    });
  }, [failedPreviewUrls, item, preferredPreviewUrl, previewCandidates]);

  React.useEffect(() => {
    if (!item || item.media.kind !== "image") return;
    if (!preferredPreviewUrl || displayPreviewUrl === preferredPreviewUrl) return;
    if (failedPreviewUrls.includes(preferredPreviewUrl)) return;

    let isCancelled = false;
    const image = new Image();
    image.onload = () => {
      if (isCancelled) return;
      setDisplayPreviewUrl(preferredPreviewUrl);
    };
    image.onerror = () => {
      if (isCancelled) return;
      setFailedPreviewUrls((currentFailedUrls) =>
        currentFailedUrls.includes(preferredPreviewUrl)
          ? currentFailedUrls
          : [...currentFailedUrls, preferredPreviewUrl]
      );
    };
    image.src = preferredPreviewUrl;

    return () => {
      isCancelled = true;
      image.onload = null;
      image.onerror = null;
    };
  }, [displayPreviewUrl, failedPreviewUrls, item, preferredPreviewUrl]);

  const handlePreviewError = React.useCallback(() => {
    if (!item || !activePreviewUrl) return;
    const nextFailedPreviewUrls = failedPreviewUrls.includes(activePreviewUrl)
      ? failedPreviewUrls
      : [...failedPreviewUrls, activePreviewUrl];
    const nextPreviewUrl =
      previewCandidates.find((candidate) => !nextFailedPreviewUrls.includes(candidate)) ?? null;
    setFailedPreviewUrls(nextFailedPreviewUrls);
    if (!nextPreviewUrl) {
      onPreviewError?.(item, activePreviewUrl);
    }
  }, [activePreviewUrl, failedPreviewUrls, item, onPreviewError, previewCandidates]);

  const handleVideoPreviewError = React.useCallback(() => {
    videoPlayback.handleError();
    handlePreviewError();
  }, [handlePreviewError, videoPlayback]);

  const handleAudioPreviewError = React.useCallback(() => {
    audioPlayback.handleError();
    handlePreviewError();
  }, [audioPlayback, handlePreviewError]);

  const previewMediaKind = canRenderMedia
    ? isVideo
      ? "video"
      : isAudio
        ? "audio"
        : "image"
    : null;

  const mediaUnavailableMessage = error || unavailableMessage;

  React.useEffect(() => {
    if (!item || previewCandidates.length > 0) return;
    onPreviewError?.(item, item.media.url);
  }, [item, onPreviewError, previewCandidates.length]);

  const shouldRenderSnapshotControl = item?.media.kind === "video" && canRenderMedia;

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
            actions={
              topBarActionItems.length > 0 ? (
                <SharedMediaDetailActionBar items={topBarActionItems} />
              ) : (
                topBarActions
              )
            }
            onClose={onClose}
            closeLabel={closeLabel}
          />
        }
        stageClassName={stageClassName}
        stage={
          <>
            <SharedMediaDetailPreviewMedia
              mediaUrl={activePreviewUrl}
              mediaKind={previewMediaKind}
              altText={title}
              isLoading={isLoading}
              loadingMessage={loadingMessage}
              unavailableMessage={mediaUnavailableMessage}
              placeholderClassName={placeholderClassName}
              imageClassName={imageClassName}
              videoClassName={videoClassName}
              audioClassName={audioClassName}
              audioId={item.media.id}
              audioSourceMode={item.media.audioSourceMode ?? null}
              audioMusicMode={item.media.musicMode ?? null}
              audioLyricsText={item.media.lyricsText ?? null}
              audioDurationMs={item.media.durationMs ?? null}
              audioWaveformPeaks={item.media.waveformPeaks ?? null}
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
            {shouldRenderSnapshotControl ? (
              <SharedMediaDetailVideoSnapshotControl
                videoRef={videoRef}
                filenameHint={item.media.filename ?? title}
                onSnapshotVideoFrame={onSnapshotVideoFrame}
                onSnapshotVideoFrameError={onSnapshotVideoFrameError}
              />
            ) : null}
          </>
        }
        sidePanel={
          shouldRenderInfoPanel ? (
            <SharedMediaDetailInfoPanel
              label={bladeContent.label}
              value={bladeContent.value}
              placeholder={item ? resolveSharedMediaDetailBladePlaceholder(item) : undefined}
            />
          ) : null
        }
      />
    </SharedMediaDetailModalShell>
  );
}
