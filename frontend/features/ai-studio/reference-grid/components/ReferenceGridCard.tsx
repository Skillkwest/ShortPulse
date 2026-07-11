/**
 * Presentational card for a single reference-grid item.
 * Keeps render and card-level interaction wiring isolated from ReferenceGrid orchestration.
 */
import React from "react";
import {
  ArrowClockwise,
  DownloadSimple,
  FloppyDisk,
  FlowArrow,
  PushPinSimple,
  TrashSimple,
  X,
} from "phosphor-react";
import {
  canReloadWorkflowOutput,
  inferWorkflowReloadMediaKindForOutput,
} from "../../logic/workflowReload";
import { canRerollOutput } from "../../logic/workflowReroll";
import { resolveOutputAudioSourceMode } from "../../logic/audioSourceMode";
import { resolveReferenceAudioDisplayTitle } from "../../logic/referenceAudioTitle";
import { canDragReferenceOutput } from "../../logic/referenceOutputAuthority";
import {
  canDownloadReferenceOutput,
  canSaveReferenceOutput,
} from "../../logic/referenceActionAvailability";
import { resolveStudioOutputReferencePromptText } from "../../logic/referencePromptText";
import { formatPerfAuditDebugLine, isPerfAuditRuntimeEnabled } from "../../logic/perfAuditDebug";
import type { ReferenceGridMediaAuthorityTier } from "../../logic/referenceGridMedia";
import type { ReferenceComposerImageDragArtifact } from "../../utils/dragDrop";
import type { ReferenceDragSourceSurface } from "../../utils/dragDrop";
import type { StudioOutput, WorkflowReloadMediaKindHint } from "../../types";
import type {
  ReferenceGridDetailSurface,
  ReferenceGridOpenDetailsOptions,
} from "../referenceGridTypes";
import { MediaDurationBadge } from "../../components/shared/MediaDurationBadge";
import { ReferenceAudioPlayer } from "../../components/shared/ReferenceAudioPlayer";
import type { ExclusiveSoundPlayer } from "../../components/shared/exclusiveSoundPlayback";
import {
  REFERENCE_GRID_GENERIC_ERROR_TITLE,
  resolveReferenceGridFailureTone,
  resolveReferenceGridErrorTitle,
} from "../logic/referenceGridErrorCopy";

const HYDRATION_FALLBACK_LOADED_MS = 1500;
const HYDRATION_MISSING_SOURCE_FALLBACK_MS = 6000;

export type ReferenceGridCardProps = {
  item: StudioOutput;
  authorityTier: ReferenceGridMediaAuthorityTier;
  dragSourceSurface: ReferenceDragSourceSurface;
  detailSurface?: ReferenceGridDetailSurface;
  videoNodeKey: string;
  audioInstanceKey?: string;
  audioAssetKey?: string;
  activeOutputId: string | null;
  isLoading: boolean;
  loadingVisual: "none" | "spinner" | "hydrating";
  loadingStatusLabel?: string | null;
  cardPreviewUrl: string | null;
  videoPosterUrl?: string | null;
  hoverVideoUrl?: string | null;
  suppressHoverVideo?: boolean;
  playableMediaUrl?: string | null;
  isVideoPreview: boolean;
  isImagePreview: boolean;
  isAudioPreview?: boolean;
  canAutoplayVideo: boolean;
  videoPreload: "auto" | "metadata" | "none";
  allowDurationProbe?: boolean;
  isPromptOnly: boolean;
  isLinkedPromptReference: boolean;
  imageSrc: string | undefined;
  imageLoading: "eager" | "lazy";
  imageFetchPriority: "high" | "low";
  renderContainPreview?: boolean;
  audioBackgroundImageUrl?: string | null;
  onSelectOutput: (id: string) => void;
  onOpenDetails: (
    id: string,
    output?: StudioOutput,
    options?: ReferenceGridOpenDetailsOptions
  ) => void;
  onCardDragStart: (
    event: React.DragEvent<HTMLElement>,
    item: StudioOutput,
    sourceSurface: ReferenceDragSourceSurface,
    composerImageArtifact?: ReferenceComposerImageDragArtifact | null
  ) => void;
  composerImageArtifact?: ReferenceComposerImageDragArtifact | null;
  onCardDragEnd: (event: React.DragEvent<HTMLElement>) => void;
  onCardDragOver?: (event: React.DragEvent<HTMLElement>, item: StudioOutput) => void;
  onCardDrop?: (event: React.DragEvent<HTMLElement>, item: StudioOutput) => void;
  onCardDragEnter?: (event: React.DragEvent<HTMLElement>, item: StudioOutput) => void;
  onCardDragLeave?: (event: React.DragEvent<HTMLElement>, item: StudioOutput) => void;
  onKeyboardReorderCurated?: (id: string, direction: "up" | "down") => void;
  registerVideoNode: (nodeKey: string, outputId: string, node: HTMLVideoElement | null) => void;
  markLoaded: (id: string, options?: { notifyAutoSave?: boolean }) => void;
  onAutoplayStarted: (id: string) => void;
  onAutoplayStopped: (id: string) => void;
  onRequestAudioPlay?: (player: ExclusiveSoundPlayer) => void;
  onAudioPlaybackStarted?: (player: ExclusiveSoundPlayer) => void;
  onAudioPlaybackStopped?: (instanceKey: string) => void;
  onRerollOutput?: (output: StudioOutput) => void;
  onRetryVoiceChangerVideo?: (output: StudioOutput) => void;
  onReloadWorkflowOutput?: (
    output: StudioOutput,
    options?: { mediaKindHint?: WorkflowReloadMediaKindHint | null }
  ) => void;
  onClearLoadingOutput?: (id: string) => void;
  loadingClearLabel?: string;
  onDeleteOutput?: (id: string) => void;
  onClearGenerationOutput?: (id: string) => void;
  onRemoveCuratedReference?: (id: string) => void;
  onMediaHoverChange?: (active: boolean) => void;
  showCuratedRemoveAction?: boolean;
  isMediaStorageFull?: boolean;
  onSaveToLibrary?: (output: StudioOutput) => void;
  onDownload?: (output: StudioOutput) => void;
  onPinPromptReference?: (text: string) => void;
  hideReferenceActions?: boolean;
  allowRerollWhenActionsHidden?: boolean;
  allowWorkflowReloadWhenActionsHidden?: boolean;
};

const renderSaveChip = (item: StudioOutput) => {
  if (!item.saveState || item.saveState === "idle") return null;
  const label =
    item.saveState === "saving"
      ? "Saving..."
      : item.saveState === "saved"
        ? "Saved"
        : item.saveState === "blocked_storage"
          ? "Storage full"
          : "Save failed";
  if (item.saveState === "saved") {
    return null;
  }
  return (
    <div className={`reference-save-chip is-${item.saveState}`}>
      <span>{label}</span>
    </div>
  );
};

/**
 * Renders one reference item card and forwards interaction events to parent handlers.
 */
export const ReferenceGridCard = React.memo(function ReferenceGridCard({
  item,
  authorityTier,
  dragSourceSurface,
  detailSurface,
  videoNodeKey,
  audioInstanceKey,
  audioAssetKey,
  activeOutputId,
  isLoading,
  loadingVisual,
  loadingStatusLabel,
  cardPreviewUrl,
  videoPosterUrl,
  hoverVideoUrl,
  suppressHoverVideo = false,
  playableMediaUrl = null,
  isVideoPreview,
  isImagePreview,
  isAudioPreview = false,
  canAutoplayVideo,
  videoPreload,
  allowDurationProbe = true,
  isPromptOnly,
  isLinkedPromptReference,
  imageSrc,
  imageLoading,
  imageFetchPriority,
  renderContainPreview = true,
  audioBackgroundImageUrl = null,
  onSelectOutput,
  onOpenDetails,
  onCardDragStart,
  composerImageArtifact,
  onCardDragEnd,
  onCardDragOver,
  onCardDrop,
  onCardDragEnter,
  onCardDragLeave,
  onKeyboardReorderCurated,
  registerVideoNode,
  markLoaded,
  onAutoplayStarted,
  onAutoplayStopped,
  onRequestAudioPlay,
  onAudioPlaybackStarted,
  onAudioPlaybackStopped,
  onRerollOutput,
  onRetryVoiceChangerVideo,
  onReloadWorkflowOutput,
  onClearLoadingOutput,
  loadingClearLabel,
  onDeleteOutput,
  onClearGenerationOutput,
  onRemoveCuratedReference,
  onMediaHoverChange,
  showCuratedRemoveAction = false,
  isMediaStorageFull = false,
  onSaveToLibrary,
  onDownload,
  onPinPromptReference,
  hideReferenceActions = false,
  allowRerollWhenActionsHidden = false,
  allowWorkflowReloadWhenActionsHidden = false,
}: ReferenceGridCardProps) {
  const videoNodeRef = React.useRef<HTMLVideoElement | null>(null);
  const hoverAutoplayStartedRef = React.useRef(false);
  const attachedVideoSourceRef = React.useRef<string | null>(null);
  const mediaHoverSignaledRef = React.useRef(false);
  const mediaHoverCallbackRef = React.useRef(onMediaHoverChange);
  React.useEffect(() => {
    mediaHoverCallbackRef.current = onMediaHoverChange;
  }, [onMediaHoverChange]);
  React.useEffect(
    () => () => {
      if (mediaHoverSignaledRef.current) {
        mediaHoverCallbackRef.current?.(false);
      }
    },
    []
  );
  const signalMediaHover = (active: boolean) => {
    mediaHoverSignaledRef.current = active;
    onMediaHoverChange?.(active);
  };
  const [isVideoHoverIntentActive, setIsVideoHoverIntentActive] = React.useState(false);
  const [isHoveringVideo, setIsHoveringVideo] = React.useState(false);
  const [isHoverVideoVisible, setIsHoverVideoVisible] = React.useState(false);
  const [hasPosterImageError, setHasPosterImageError] = React.useState(false);
  const [hasMediaRenderError, setHasMediaRenderError] = React.useState(false);
  const [loadedPrimaryImageSrc, setLoadedPrimaryImageSrc] = React.useState<string | null>(null);
  const isFailing = item.taskState === "fail";
  const isSelected = activeOutputId === item.id;
  const saveDisabled =
    isMediaStorageFull || item.saveState === "saving" || item.saveState === "saved";
  const saveLabel = isMediaStorageFull
    ? "Storage full"
    : item.saveState === "failed" || item.saveState === "blocked_storage"
      ? "Retry save"
      : "Save to media library";
  const pinPromptTitle = "Pin text to Reference Grid";
  const downloadTitle = "Download";
  const removeReferenceTitle = "Remove from Reference Grid";
  const removeQuickSlotTitle = "Remove from Quick Slot";
  const rerollTitle = "Re-roll";
  const reloadWorkflowTitle = "Reload workflow";
  const canSaveReference = canSaveReferenceOutput(item);
  const canDownloadReference = canDownloadReferenceOutput(item);
  const shouldShowSaveAction = Boolean(
    onSaveToLibrary &&
    canSaveReference &&
    item.saveState !== "saved" &&
    (isPromptOnly || isImagePreview || isVideoPreview || isAudioPreview)
  );
  const referencePromptText = resolveStudioOutputReferencePromptText(item);
  const hasGeneratedPromptSource = Boolean(
    item.generationReplay ||
    item.workflowReload ||
    item.mediaSource === "generated" ||
    item.generationId
  );
  const shouldShowPinPromptAction = Boolean(
    onPinPromptReference &&
    referencePromptText &&
    hasGeneratedPromptSource &&
    !isPromptOnly &&
    (isImagePreview || isVideoPreview || isAudioPreview)
  );
  const workflowReloadMediaKindHint: WorkflowReloadMediaKindHint =
    inferWorkflowReloadMediaKindForOutput(item, {
      mediaKindHint: isVideoPreview ? "video" : isAudioPreview ? "audio" : null,
    });
  const shouldShowRerollAction = Boolean(
    onRerollOutput && canRerollOutput(item, { mediaKindHint: workflowReloadMediaKindHint })
  );
  const shouldShowWorkflowReloadAction = Boolean(
    onReloadWorkflowOutput &&
    canReloadWorkflowOutput(item, { mediaKindHint: workflowReloadMediaKindHint })
  );
  const canShowWorkflowReloadAction = !hideReferenceActions || allowWorkflowReloadWhenActionsHidden;
  const shouldShowRerollInBottomActionRow = Boolean(
    (!hideReferenceActions || allowRerollWhenActionsHidden) && shouldShowRerollAction
  );
  const shouldShowWorkflowReloadInBottomActionRow = Boolean(
    canShowWorkflowReloadAction && shouldShowWorkflowReloadAction
  );
  const shouldShowBottomActionRow = Boolean(
    shouldShowRerollInBottomActionRow || shouldShowWorkflowReloadInBottomActionRow
  );
  const bottomActionRowClassName = "reference-card-bottom-actions";
  const shouldSignalMediaHover = Boolean(
    isImagePreview || isVideoPreview || isAudioPreview || isPromptOnly || item.previewText
  );
  const shouldShowCuratedActionRow = Boolean(
    showCuratedRemoveAction &&
    isSelected &&
    (shouldShowPinPromptAction ||
      (onDownload &&
        canDownloadReference &&
        (isImagePreview || isVideoPreview || isAudioPreview)) ||
      onRemoveCuratedReference)
  );
  const shouldShowReferenceActionRow = Boolean(
    !shouldShowCuratedActionRow &&
    (shouldShowPinPromptAction ||
      shouldShowSaveAction ||
      (onDownload &&
        canDownloadReference &&
        (isImagePreview || isVideoPreview || isAudioPreview)) ||
      onDeleteOutput)
  );
  const errorTitle = resolveReferenceGridErrorTitle(item);
  const failureTone = resolveReferenceGridFailureTone(item);
  const shouldShowNsfwPill =
    failureTone !== "credits" && errorTitle !== REFERENCE_GRID_GENERIC_ERROR_TITLE;
  const canDragReference = Boolean(item.previewText) || canDragReferenceOutput(item);
  const dragPreviewKind = isImagePreview
    ? "image"
    : isVideoPreview
      ? "video"
      : isAudioPreview
        ? "audio"
        : "text";
  const resolvedVideoPosterUrl = videoPosterUrl?.trim() || null;
  const resolvedHoverVideoUrl = suppressHoverVideo
    ? null
    : hoverVideoUrl?.trim() || (isVideoPreview ? cardPreviewUrl?.trim() : "") || null;
  const hasVideoPosterPreview = Boolean(item.mode === "video" && resolvedVideoPosterUrl);
  const hasPosterBackedVideoPreview = Boolean(hasVideoPosterPreview && resolvedHoverVideoUrl);
  const shouldSuppressGeneratedPosterlessVideoSurface = Boolean(
    item.mode === "video" &&
    item.mediaSource === "generated" &&
    resolvedHoverVideoUrl &&
    !hasVideoPosterPreview &&
    !hasPosterImageError
  );
  const shouldPreferVideoSurfaceByDefault = Boolean(
    item.mode === "video" &&
    resolvedHoverVideoUrl &&
    !shouldSuppressGeneratedPosterlessVideoSurface &&
    (!hasVideoPosterPreview || hasPosterImageError)
  );
  const shouldRenderVideoElement = Boolean(
    !hasMediaRenderError &&
    ((isVideoPreview && resolvedHoverVideoUrl) || hasPosterBackedVideoPreview)
  );
  const shouldAttachVideoSource = Boolean(
    shouldRenderVideoElement &&
    resolvedHoverVideoUrl &&
    (canAutoplayVideo ||
      isHoveringVideo ||
      isVideoHoverIntentActive ||
      isHoverVideoVisible ||
      isSelected ||
      hasPosterImageError)
  );
  const attachedVideoSourceUrl = shouldAttachVideoSource ? resolvedHoverVideoUrl : null;
  const audioPreviewUrl = isAudioPreview
    ? playableMediaUrl?.trim() || cardPreviewUrl?.trim() || ""
    : "";
  const audioSourceMode = resolveOutputAudioSourceMode(item);
  const audioTitle = resolveReferenceAudioDisplayTitle(item);
  const primaryImageSrc = hasVideoPosterPreview ? (resolvedVideoPosterUrl ?? undefined) : imageSrc;
  const normalizedPrimaryImageSrc = primaryImageSrc?.trim() || "";
  const primaryImageDataSrc = hasVideoPosterPreview ? resolvedVideoPosterUrl : cardPreviewUrl;
  const shouldRenderImageElement = Boolean(
    !hasMediaRenderError &&
    normalizedPrimaryImageSrc &&
    ((isImagePreview && cardPreviewUrl) || (hasVideoPosterPreview && !hasPosterImageError))
  );
  const isPrimaryImageLoadConfirmed = Boolean(
    normalizedPrimaryImageSrc && loadedPrimaryImageSrc === normalizedPrimaryImageSrc
  );
  const primaryImageProbeClass = isPrimaryImageLoadConfirmed ? "" : " is-probing";
  const shouldRenderAudioElement = Boolean(!hasMediaRenderError && audioPreviewUrl);
  const dragImageSrc =
    dragPreviewKind === "image" || hasVideoPosterPreview
      ? normalizedPrimaryImageSrc || primaryImageDataSrc || undefined
      : undefined;
  const videoDurationMediaUrl =
    item.mode === "video"
      ? (resolvedHoverVideoUrl ?? item.resultUrls?.[0] ?? item.previewUrl ?? cardPreviewUrl ?? null)
      : null;
  const showPerfAuditDebug = isPerfAuditRuntimeEnabled();
  const perfAuditDebugLabel = React.useMemo(
    () =>
      [
        formatPerfAuditDebugLine("img", normalizedPrimaryImageSrc || primaryImageDataSrc || null),
        formatPerfAuditDebugLine(
          "drag",
          composerImageArtifact?.displayArtifactUrl ?? dragImageSrc ?? null
        ),
      ].join(" | "),
    [
      composerImageArtifact?.displayArtifactUrl,
      dragImageSrc,
      normalizedPrimaryImageSrc,
      primaryImageDataSrc,
    ]
  );
  const effectiveIsLoading = isLoading && !hasMediaRenderError;
  const shouldShowLoadingOverlay = effectiveIsLoading && loadingVisual !== "none";
  const clearLoadingOutput = onClearLoadingOutput ?? onClearGenerationOutput;
  const clearLoadingLabel =
    loadingClearLabel ??
    (onClearGenerationOutput && !onClearLoadingOutput
      ? "Clear generation from grid"
      : "Remove loading media from grid");
  const shouldShowMediaUnavailable = hasMediaRenderError && !effectiveIsLoading && !isFailing;
  const resolvedLoadingStatusLabel =
    loadingStatusLabel === undefined
      ? loadingVisual === "hydrating"
        ? null
        : "Generating"
      : loadingStatusLabel;
  const markCardMediaLoaded = React.useCallback(() => {
    markLoaded(item.id, { notifyAutoSave: isSelected });
  }, [isSelected, item.id, markLoaded]);

  React.useEffect(() => {
    setHasPosterImageError(false);
    setHasMediaRenderError(false);
  }, [
    audioPreviewUrl,
    cardPreviewUrl,
    item.id,
    primaryImageDataSrc,
    normalizedPrimaryImageSrc,
    resolvedHoverVideoUrl,
    resolvedVideoPosterUrl,
  ]);

  const startHoverPlayback = React.useCallback(() => {
    setIsVideoHoverIntentActive(true);
    if (!resolvedHoverVideoUrl) return;
    setIsHoveringVideo(true);
    const node = videoNodeRef.current;
    if (!node) {
      hoverAutoplayStartedRef.current = false;
      return;
    }
    node.muted = true;
    node.playsInline = true;
    if (node.getAttribute("src") !== resolvedHoverVideoUrl) {
      node.src = resolvedHoverVideoUrl;
    }
    if (!node.currentSrc && node.readyState === HTMLMediaElement.HAVE_NOTHING) {
      node.load();
    }
    if (node.ended) {
      try {
        node.currentTime = 0;
      } catch {
        // Ignore seek failures for providers that expose non-seekable preview responses.
      }
    }
    if (!node.paused) {
      hoverAutoplayStartedRef.current = true;
      setIsHoverVideoVisible(true);
      onAutoplayStarted(item.id);
      return;
    }
    if (hoverAutoplayStartedRef.current) return;
    hoverAutoplayStartedRef.current = true;
    void node.play().catch(() => {
      hoverAutoplayStartedRef.current = false;
      setIsVideoHoverIntentActive(false);
      setIsHoveringVideo(false);
      setIsHoverVideoVisible(false);
    });
  }, [item.id, onAutoplayStarted, resolvedHoverVideoUrl]);
  const stopHoverPlayback = React.useCallback(() => {
    setIsVideoHoverIntentActive(false);
    setIsHoveringVideo(false);
    if (!hoverAutoplayStartedRef.current || canAutoplayVideo) return;
    hoverAutoplayStartedRef.current = false;
    videoNodeRef.current?.pause();
  }, [canAutoplayVideo]);

  React.useEffect(() => {
    if (!isVideoHoverIntentActive || !resolvedHoverVideoUrl || isHoveringVideo) return;
    startHoverPlayback();
  }, [isHoveringVideo, isVideoHoverIntentActive, resolvedHoverVideoUrl, startHoverPlayback]);

  React.useEffect(() => {
    if (resolvedHoverVideoUrl) return;
    setIsHoveringVideo(false);
    setIsHoverVideoVisible(false);
    if (!hoverAutoplayStartedRef.current) return;
    hoverAutoplayStartedRef.current = false;
    videoNodeRef.current?.pause();
    onAutoplayStopped(item.id);
  }, [item.id, onAutoplayStopped, resolvedHoverVideoUrl]);

  React.useEffect(() => {
    const previousAttachedVideoSource = attachedVideoSourceRef.current;
    attachedVideoSourceRef.current = attachedVideoSourceUrl;
    const node = videoNodeRef.current;
    if (!node || attachedVideoSourceUrl) return;
    if (!previousAttachedVideoSource && !node.currentSrc && !node.getAttribute("src")) return;
    node.pause();
    node.removeAttribute("src");
    try {
      node.load();
    } catch {
      // Some browser/test environments throw when resetting detached media.
    }
  }, [attachedVideoSourceUrl]);
  const saveIcon =
    item.saveState === "failed" ? (
      <ArrowClockwise size={16} weight="bold" aria-hidden />
    ) : (
      <FloppyDisk size={16} weight="bold" aria-hidden />
    );

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!effectiveIsLoading || loadingVisual !== "hydrating") return;
    const hasRenderableMedia = Boolean(normalizedPrimaryImageSrc || resolvedHoverVideoUrl);
    if (!hasRenderableMedia) {
      const timeoutId = window.setTimeout(() => {
        setHasMediaRenderError(true);
        markLoaded(item.id, { notifyAutoSave: false });
      }, HYDRATION_MISSING_SOURCE_FALLBACK_MS);
      return () => window.clearTimeout(timeoutId);
    }
    // Some preview URLs never emit a terminal load/error event in the grid runtime.
    // Fail open so completed generations do not look indefinitely in-flight.
    const timeoutId = window.setTimeout(() => {
      markLoaded(item.id, { notifyAutoSave: false });
    }, HYDRATION_FALLBACK_LOADED_MS);
    return () => window.clearTimeout(timeoutId);
  }, [
    effectiveIsLoading,
    item.id,
    loadingVisual,
    markLoaded,
    normalizedPrimaryImageSrc,
    resolvedHoverVideoUrl,
  ]);

  const handleImageRenderError = React.useCallback(() => {
    if (hasVideoPosterPreview && resolvedHoverVideoUrl) {
      setHasPosterImageError(true);
      return;
    }
    if (hasMediaRenderError) return;
    setHasMediaRenderError(true);
    markLoaded(item.id, { notifyAutoSave: false });
  }, [hasMediaRenderError, hasVideoPosterPreview, item.id, markLoaded, resolvedHoverVideoUrl]);
  const handlePrimaryImageLoad = React.useCallback(() => {
    setLoadedPrimaryImageSrc(normalizedPrimaryImageSrc);
    markCardMediaLoaded();
  }, [markCardMediaLoaded, normalizedPrimaryImageSrc]);
  const handleCardClick = React.useCallback(() => {
    onSelectOutput(item.id);
  }, [item.id, onSelectOutput]);
  const handleCardKeyboardActivate = React.useCallback(() => {
    onSelectOutput(item.id);
  }, [item.id, onSelectOutput]);
  const handleCardDoubleClick = React.useCallback(() => {
    if (detailSurface) {
      onOpenDetails(item.id, item, { surface: detailSurface });
      return;
    }
    onOpenDetails(item.id, item);
  }, [detailSurface, item, onOpenDetails]);
  const handleVideoNodeRef = React.useCallback(
    (node: HTMLVideoElement | null) => {
      videoNodeRef.current = node;
      registerVideoNode(videoNodeKey, item.id, node);
    },
    [item.id, registerVideoNode, videoNodeKey]
  );

  return (
    <div
      className={`reference-card ${cardPreviewUrl || resolvedVideoPosterUrl ? "has-preview" : ""} ${isVideoPreview || hasVideoPosterPreview ? "has-video" : ""} ${isAudioPreview ? "has-audio" : ""} ${hasVideoPosterPreview ? "has-video-poster" : ""} ${renderContainPreview ? "has-contain-preview" : ""} ${item.previewText ? "has-text" : ""} ${isSelected ? "is-active" : ""} ${effectiveIsLoading ? "is-loading" : ""} ${hasMediaRenderError ? "is-media-unavailable" : ""} ${isLinkedPromptReference ? "is-linked-prompt-ref" : ""}`}
      role="button"
      aria-busy={effectiveIsLoading}
      data-loading={effectiveIsLoading ? "true" : "false"}
      data-output-id={item.id}
      data-reference-authority-tier={authorityTier}
      data-drag-preview-url={cardPreviewUrl ?? undefined}
      data-drag-playable-url={playableMediaUrl?.trim() || resolvedHoverVideoUrl || undefined}
      data-drag-image-src={dragImageSrc}
      data-drag-preview-kind={dragPreviewKind}
      tabIndex={0}
      onClick={(event) => {
        event.currentTarget.focus();
        handleCardClick();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleCardKeyboardActivate();
          return;
        }
        if (!onKeyboardReorderCurated) return;
        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
          event.preventDefault();
          onKeyboardReorderCurated(item.id, event.key === "ArrowUp" ? "up" : "down");
        }
      }}
      onDoubleClick={handleCardDoubleClick}
      draggable={canDragReference}
      onDragStart={(event) => {
        onCardDragStart(event, item, dragSourceSurface, composerImageArtifact);
      }}
      onDragEnd={onCardDragEnd}
      onDragOver={onCardDragOver ? (event) => onCardDragOver(event, item) : undefined}
      onDrop={onCardDrop ? (event) => onCardDrop(event, item) : undefined}
      onDragEnter={onCardDragEnter ? (event) => onCardDragEnter(event, item) : undefined}
      onDragLeave={onCardDragLeave ? (event) => onCardDragLeave(event, item) : undefined}
      onPointerEnter={() => {
        startHoverPlayback();
        if (shouldSignalMediaHover) signalMediaHover(true);
      }}
      onMouseEnter={startHoverPlayback}
      onPointerLeave={() => {
        stopHoverPlayback();
        if (shouldSignalMediaHover) signalMediaHover(false);
      }}
      onMouseLeave={stopHoverPlayback}
      onFocus={() => {
        if (shouldSignalMediaHover) signalMediaHover(true);
      }}
      onBlur={() => {
        if (shouldSignalMediaHover) signalMediaHover(false);
      }}
    >
      {shouldRenderVideoElement ? (
        <video
          className={`reference-card-video ${hasPosterBackedVideoPreview ? "reference-card-video--poster-backed" : ""} ${isHoveringVideo || isHoverVideoVisible || shouldPreferVideoSurfaceByDefault ? "is-visible" : ""}`}
          draggable={false}
          ref={handleVideoNodeRef}
          src={attachedVideoSourceUrl ?? undefined}
          autoPlay={canAutoplayVideo}
          muted
          loop
          playsInline
          preload={videoPreload}
          onLoadedData={() => {
            markCardMediaLoaded();
            if (isHoveringVideo && videoNodeRef.current?.paused) {
              startHoverPlayback();
            }
          }}
          onError={() => {
            setIsVideoHoverIntentActive(false);
            setIsHoveringVideo(false);
            setIsHoverVideoVisible(false);
            if (!effectiveIsLoading) {
              setHasMediaRenderError(true);
              markLoaded(item.id, { notifyAutoSave: false });
            }
          }}
          onPlay={() => {
            setIsHoverVideoVisible(true);
            onAutoplayStarted(item.id);
          }}
          onPause={() => {
            setIsHoverVideoVisible(false);
            onAutoplayStopped(item.id);
          }}
        />
      ) : null}
      {shouldRenderImageElement ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={normalizedPrimaryImageSrc}
          data-src={primaryImageDataSrc ?? undefined}
          alt=""
          className={`reference-card-image reference-card-image--cover${primaryImageProbeClass} ${hasVideoPosterPreview ? "reference-card-image--poster" : ""} ${isHoveringVideo || isHoverVideoVisible ? "is-hidden" : ""}`}
          loading={imageLoading}
          decoding="async"
          {...(imageFetchPriority ? { fetchpriority: imageFetchPriority } : {})}
          onLoad={handlePrimaryImageLoad}
          onError={handleImageRenderError}
        />
      ) : null}
      {shouldRenderAudioElement ? (
        <ReferenceAudioPlayer
          audioId={item.id}
          audioUrl={audioPreviewUrl}
          audioInstanceKey={audioInstanceKey}
          audioAssetKey={audioAssetKey}
          title={audioTitle}
          backgroundImageUrl={audioBackgroundImageUrl}
          audioSourceMode={audioSourceMode}
          durationMs={item.durationMs ?? null}
          waveformPeaks={item.waveformPeaks ?? null}
          playLabel="Play audio preview"
          pauseLabel="Pause audio preview"
          downloadLabel="Download reference"
          onActivate={() => onSelectOutput(item.id)}
          onReady={markCardMediaLoaded}
          onError={() => {
            if (!effectiveIsLoading) {
              setHasMediaRenderError(true);
              markLoaded(item.id, { notifyAutoSave: false });
            }
          }}
          eagerWaveformDecode={false}
          onRequestPlay={onRequestAudioPlay}
          onPlaybackStarted={onAudioPlaybackStarted}
          onPlaybackStopped={onAudioPlaybackStopped}
        />
      ) : null}
      {item.mode === "video" ? (
        <MediaDurationBadge
          className="reference-card-media-duration"
          durationMs={item.durationMs ?? null}
          mediaUrl={videoDurationMediaUrl}
          mediaKind="video"
          allowProbe={allowDurationProbe}
        />
      ) : null}
      {shouldShowMediaUnavailable ? (
        <div className="reference-card-media-unavailable" aria-label="Preview unavailable" />
      ) : null}
      {isFailing ? (
        <div className={`reference-fail-overlay reference-fail-overlay--${failureTone}`}>
          <div className="fail-icon" aria-hidden="true">
            !
          </div>
          {shouldShowNsfwPill ? (
            <span className="reference-fail-pill" aria-label="NSFW content block">
              NSFW
            </span>
          ) : null}
          <div className="fail-title">{errorTitle}</div>
        </div>
      ) : null}
      {shouldShowLoadingOverlay ? (
        <div className={`reference-loading reference-loading--${loadingVisual}`}>
          {clearLoadingOutput ? (
            <button
              type="button"
              className="reference-card-action-btn reference-card-action-btn--danger reference-loading-clear-btn"
              aria-label={clearLoadingLabel}
              title={clearLoadingLabel}
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                clearLoadingOutput(item.id);
              }}
            >
              <X size={16} weight="bold" aria-hidden />
            </button>
          ) : null}
          <div className="reference-spinner" />
          {resolvedLoadingStatusLabel ? (
            <span className="reference-loading-label">{resolvedLoadingStatusLabel}</span>
          ) : null}
        </div>
      ) : null}
      {isLinkedPromptReference ? (
        <span className="reference-card-link-dot" aria-hidden="true" />
      ) : null}
      {showPerfAuditDebug ? (
        <div
          aria-label={perfAuditDebugLabel}
          style={{
            position: "absolute",
            left: 4,
            right: 4,
            bottom: 4,
            zIndex: 4,
            padding: "3px 4px",
            borderRadius: 4,
            background: "rgba(8, 11, 16, 0.88)",
            color: "#b9f3ff",
            fontSize: 8,
            lineHeight: 1.25,
            fontFamily: "monospace",
            wordBreak: "break-all",
            pointerEvents: "none",
          }}
        >
          {perfAuditDebugLabel}
        </div>
      ) : null}
      {renderSaveChip(item)}
      {isFailing && onDeleteOutput && isSelected ? (
        <div className="reference-card-actions" aria-label="Reference actions">
          <button
            type="button"
            className="reference-card-action-btn reference-card-action-btn--danger"
            aria-label="Remove error from grid"
            title="Remove error from grid"
            onClick={(event) => {
              event.stopPropagation();
              onDeleteOutput(item.id);
            }}
          >
            <TrashSimple size={16} weight="bold" aria-hidden />
          </button>
        </div>
      ) : null}
      {shouldShowCuratedActionRow ? (
        <div className="reference-card-actions" aria-label="Curated actions">
          {shouldShowPinPromptAction ? (
            <button
              type="button"
              className="reference-card-action-btn reference-card-pin-prompt-btn"
              aria-label="Pin text reference to reference grid"
              title={pinPromptTitle}
              onClick={(event) => {
                event.stopPropagation();
                onSelectOutput(item.id);
                onPinPromptReference?.(referencePromptText);
              }}
            >
              <PushPinSimple size={16} weight="bold" aria-hidden />
            </button>
          ) : null}
          {onDownload &&
          canDownloadReference &&
          (isImagePreview || isVideoPreview || isAudioPreview) ? (
            <button
              type="button"
              className="reference-card-action-btn"
              aria-label="Download reference"
              title={downloadTitle}
              onClick={(event) => {
                event.stopPropagation();
                onSelectOutput(item.id);
                onDownload(item);
              }}
            >
              <DownloadSimple size={16} weight="bold" aria-hidden />
            </button>
          ) : null}
          <button
            type="button"
            className="reference-card-action-btn reference-card-action-btn--danger"
            aria-label="Remove from curated"
            title={removeQuickSlotTitle}
            onClick={(event) => {
              event.stopPropagation();
              onRemoveCuratedReference?.(item.id);
            }}
          >
            <TrashSimple size={16} weight="bold" aria-hidden />
          </button>
        </div>
      ) : null}
      {shouldShowBottomActionRow ? (
        <div className={bottomActionRowClassName} aria-label="Reference replay actions">
          {shouldShowRerollInBottomActionRow ? (
            <button
              type="button"
              className="reference-card-action-btn reference-card-reroll-btn"
              aria-label="Re-roll"
              title={rerollTitle}
              onClick={(event) => {
                event.stopPropagation();
                onSelectOutput(item.id);
                onRerollOutput?.(item);
              }}
            >
              <ArrowClockwise size={16} weight="bold" aria-hidden />
            </button>
          ) : null}
          {shouldShowWorkflowReloadInBottomActionRow ? (
            <button
              type="button"
              className="reference-card-action-btn reference-card-workflow-reload-btn"
              aria-label="Reload workflow"
              title={reloadWorkflowTitle}
              onClick={(event) => {
                event.stopPropagation();
                onSelectOutput(item.id);
                onReloadWorkflowOutput?.(item, { mediaKindHint: workflowReloadMediaKindHint });
              }}
            >
              <FlowArrow size={16} weight="bold" aria-hidden />
            </button>
          ) : null}
        </div>
      ) : null}
      {item.remuxRecovery?.retryable && onRetryVoiceChangerVideo ? (
        <button
          type="button"
          className="reference-card-action-btn reference-card-reroll-btn"
          aria-label="Retry video"
          title="Retry video without another charge"
          disabled={item.remuxRecovery.status === "pending"}
          onClick={(event) => {
            event.stopPropagation();
            onSelectOutput(item.id);
            onRetryVoiceChangerVideo(item);
          }}
        >
          <ArrowClockwise size={16} weight="bold" aria-hidden />
          <span>Retry video</span>
        </button>
      ) : null}
      {!hideReferenceActions && shouldShowReferenceActionRow ? (
        <div className="reference-card-actions" aria-label="Reference actions">
          {shouldShowSaveAction ? (
            <button
              type="button"
              className="reference-card-action-btn"
              aria-label={saveLabel}
              title={saveLabel}
              disabled={saveDisabled}
              onClick={(event) => {
                event.stopPropagation();
                onSelectOutput(item.id);
                onSaveToLibrary?.(item);
              }}
            >
              {saveIcon}
            </button>
          ) : null}
          {shouldShowPinPromptAction ? (
            <button
              type="button"
              className="reference-card-action-btn reference-card-pin-prompt-btn"
              aria-label="Pin text reference to reference grid"
              title={pinPromptTitle}
              onClick={(event) => {
                event.stopPropagation();
                onSelectOutput(item.id);
                onPinPromptReference?.(referencePromptText);
              }}
            >
              <PushPinSimple size={16} weight="bold" aria-hidden />
            </button>
          ) : null}
          {onDownload &&
          canDownloadReference &&
          (isImagePreview || isVideoPreview || isAudioPreview) ? (
            <button
              type="button"
              className="reference-card-action-btn"
              aria-label="Download reference"
              title={downloadTitle}
              onClick={(event) => {
                event.stopPropagation();
                onSelectOutput(item.id);
                onDownload(item);
              }}
            >
              <DownloadSimple size={16} weight="bold" aria-hidden />
            </button>
          ) : null}
          {onDeleteOutput ? (
            <button
              type="button"
              className="reference-card-action-btn reference-card-action-btn--danger"
              aria-label="Remove reference from grid"
              title={removeReferenceTitle}
              onClick={(event) => {
                event.stopPropagation();
                onDeleteOutput(item.id);
              }}
            >
              <TrashSimple size={16} weight="bold" aria-hidden />
            </button>
          ) : null}
        </div>
      ) : null}
      {item.previewText ? <div className="reference-card-text">{item.previewText}</div> : null}
    </div>
  );
});
