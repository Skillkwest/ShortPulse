/**
 * Card render controller for Reference Grid.
 * Keeps per-card action wiring and visual state mapping out of ReferenceGrid.
 */
import React, { useCallback } from "react";
import { ReferenceGridCard } from "../components/ReferenceGridCard";
import type { ReferenceGridMediaAuthorityTier } from "../../logic/referenceGridMedia";
import type { StudioOutput } from "../../types";
import type { ReferenceDragSourceSurface } from "../../utils/dragDrop";
import type { ReferenceComposerImageDragArtifact } from "../../utils/dragDrop";
import { isVideoUrl } from "../../logic/stateParsers";
import { isReferenceOutputFailing } from "../logic/referenceGridLoadingState";
import { isLocalVideoReferencePendingPersistence } from "../logic/referenceGridCardVisualState";
import type { ReferenceGridMediaOutput } from "../logic/referenceGridMediaOutput";
import {
  applyAdaptivePreviewTransform,
  type ReferenceGridPreviewQualityBand,
} from "../../logic/referenceGridMediaAdaptivePreview";
import type { ReferenceGridSingleAudioPlaybackController } from "./useReferenceGridSingleAudioPlaybackController";
import {
  incrementFreezeInvestigationCounter,
  setFreezeInvestigationGauge,
} from "../../logic/freezeInvestigationTelemetry";
import { isSupabaseRenderImageUrl } from "../../../../lib/mediaPreviewTrustPolicy";

export type ReferenceGridVisibleCard = {
  item: ReferenceGridMediaOutput;
  authorityTier: ReferenceGridMediaAuthorityTier;
  cardPreviewUrl: string | null;
  fallbackUrl?: string | null;
  isVideoPreview: boolean;
  isImagePreview: boolean;
  isAudioPreview?: boolean;
  isPriorityHydration: boolean;
  previewQualityBand?: ReferenceGridPreviewQualityBand;
  targetLongEdgePx?: number;
  imageSrc?: string;
  dragDisplayArtifactUrl?: string;
  dragDisplayArtifactKind?: "blob" | "data" | "url";
};

type UseReferenceGridCardRenderControllerArgs = {
  activeOutputId: string | null;
  visibleOutputById: Record<string, StudioOutput>;
  autoplayEnabledIdSet: Set<string>;
  linkedPromptReferenceIdSet: Set<string>;
  loadingCardIdSet: Set<string>;
  generationLoadingCardIdSet: Set<string>;
  hydrationLoadingCardIdSet: Set<string>;
  perfDegradeLevel: 0 | 1 | 2;
  visibleCardItems: ReferenceGridVisibleCard[];
  curatedVisibleCardItems: ReferenceGridVisibleCard[];
  visibleQuickSlotIdSet: Set<string>;
  onSelectOutput: (id: string) => void;
  onOpenDetails: (id: string) => void;
  onCardDragStart: (
    event: React.DragEvent<HTMLElement>,
    item: StudioOutput,
    sourceSurface: ReferenceDragSourceSurface,
    composerImageArtifact?: ReferenceComposerImageDragArtifact | null
  ) => void;
  onCardDragEnd: (event: React.DragEvent<HTMLElement>) => void;
  onCuratedSectionDragOver: (event: React.DragEvent<HTMLElement>) => void;
  onCuratedCardDrop: (event: React.DragEvent<HTMLElement>, target: StudioOutput) => void;
  onCuratedSectionDragEnter: (event: React.DragEvent<HTMLElement>) => void;
  onCuratedSectionDragLeave: (event: React.DragEvent<HTMLElement>) => void;
  onCuratedCardKeyboardReorder: (id: string, direction: "up" | "down") => void;
  registerVideoNode: (nodeKey: string, outputId: string, node: HTMLVideoElement | null) => void;
  markLoaded: (id: string, options?: { notifyAutoSave?: boolean }) => void;
  onAutoplayStarted: (id: string) => void;
  onAutoplayStopped: (id: string) => void;
  audioPlaybackController: ReferenceGridSingleAudioPlaybackController;
  onRetryStatus?: (output: StudioOutput) => void;
  onRerollOutput?: (output: StudioOutput) => void;
  onDeleteOutput?: (id: string) => void;
  onClearGenerationOutput?: (id: string) => void;
  onRemoveCuratedReference?: (id: string) => void;
  isMediaStorageFull?: boolean;
  onSaveToLibrary?: (output: StudioOutput) => void;
  onDownload?: (output: StudioOutput) => void;
};

type UseReferenceGridCardRenderControllerResult = {
  curatedCardNodes: React.ReactNode[];
  allRefsCardNodes: React.ReactNode[];
};

const NOOP_AUDIO_PLAYBACK_CONTROLLER: ReferenceGridSingleAudioPlaybackController = {
  requestPlay: () => undefined,
  markPlaying: () => undefined,
  clearActivePlayer: () => undefined,
};

/**
 * Returns curated/all-refs card node arrays with unchanged card behavior wiring.
 */
export const useReferenceGridCardRenderController = ({
  activeOutputId,
  visibleOutputById,
  autoplayEnabledIdSet,
  linkedPromptReferenceIdSet,
  loadingCardIdSet,
  generationLoadingCardIdSet,
  hydrationLoadingCardIdSet,
  perfDegradeLevel,
  visibleCardItems,
  curatedVisibleCardItems,
  visibleQuickSlotIdSet,
  onSelectOutput,
  onOpenDetails,
  onCardDragStart,
  onCardDragEnd,
  onCuratedSectionDragOver,
  onCuratedCardDrop,
  onCuratedSectionDragEnter,
  onCuratedSectionDragLeave,
  onCuratedCardKeyboardReorder,
  registerVideoNode,
  markLoaded,
  onAutoplayStarted,
  onAutoplayStopped,
  audioPlaybackController,
  onRetryStatus,
  onRerollOutput,
  onDeleteOutput,
  onClearGenerationOutput,
  onRemoveCuratedReference,
  isMediaStorageFull = false,
  onSaveToLibrary,
  onDownload,
}: UseReferenceGridCardRenderControllerArgs): UseReferenceGridCardRenderControllerResult => {
  const resolvedAudioPlaybackController = audioPlaybackController ?? NOOP_AUDIO_PLAYBACK_CONTROLLER;
  incrementFreezeInvestigationCounter("referenceGrid.cardRender.recompute");
  setFreezeInvestigationGauge(
    "referenceGrid.cardRender.visibleCardItemsCount",
    visibleCardItems.length
  );
  setFreezeInvestigationGauge(
    "referenceGrid.cardRender.visibleCuratedCardItemsCount",
    curatedVisibleCardItems.length
  );
  const renderReferenceCard = useCallback(
    (
      card: ReferenceGridVisibleCard,
      options: {
        surface: ReferenceDragSourceSurface;
        isCuratedSurface: boolean;
      }
    ) => {
      const currentOutput = visibleOutputById[card.item.id];
      if (!currentOutput) return null;
      const isFailing = isReferenceOutputFailing(currentOutput);
      const isGenerationLoading = generationLoadingCardIdSet.has(currentOutput.id);
      const isHydrationLoading = hydrationLoadingCardIdSet.has(currentOutput.id);
      const shouldPreferCuratedSurface =
        !options.isCuratedSurface && visibleQuickSlotIdSet.has(currentOutput.id);
      const suppressDuplicateAllRefsLoading = shouldPreferCuratedSurface && !isGenerationLoading;
      const shouldWarmVideoPreview =
        card.isVideoPreview &&
        !shouldPreferCuratedSurface &&
        (activeOutputId === currentOutput.id || autoplayEnabledIdSet.has(currentOutput.id));
      const isLocalVideoPersistenceLoading = isLocalVideoReferencePendingPersistence(currentOutput);
      const suppressDormantVideoLoading =
        card.isVideoPreview &&
        !shouldWarmVideoPreview &&
        !isGenerationLoading &&
        !isLocalVideoPersistenceLoading;
      const isCardLoading = isFailing
        ? false
        : suppressDormantVideoLoading
          ? false
          : suppressDuplicateAllRefsLoading
            ? false
            : loadingCardIdSet.has(card.item.id);
      const loadingVisual: "none" | "spinner" | "hydrating" =
        isFailing || suppressDormantVideoLoading || suppressDuplicateAllRefsLoading
          ? "none"
          : isGenerationLoading || isLocalVideoPersistenceLoading
            ? "spinner"
            : isHydrationLoading
              ? "hydrating"
              : "none";
      const canAutoplayVideo =
        card.isVideoPreview &&
        !shouldPreferCuratedSurface &&
        autoplayEnabledIdSet.has(currentOutput.id) &&
        perfDegradeLevel < 2;
      const isPromptOnly = !card.cardPreviewUrl && !!currentOutput.previewText;
      const isLinkedPromptReference =
        isPromptOnly && linkedPromptReferenceIdSet.has(currentOutput.id);
      const canRetryStatus =
        Boolean(onRetryStatus && currentOutput.taskId) && (isFailing || isGenerationLoading);
      const videoPosterUrl =
        currentOutput.mode === "video"
          ? currentOutput.previewPosterUrl?.trim() ||
            (card.isImagePreview ? card.cardPreviewUrl : "") ||
            null
          : null;
      const hoverVideoUrl =
        currentOutput.mode === "video"
          ? currentOutput.localObjectUrl?.trim() ||
            (card.isVideoPreview ? card.cardPreviewUrl : "") ||
            (card.fallbackUrl && isVideoUrl(card.fallbackUrl) ? card.fallbackUrl : "") ||
            currentOutput.resultUrls?.find(
              (value) => typeof value === "string" && isVideoUrl(value)
            ) ||
            (currentOutput.previewUrl && isVideoUrl(currentOutput.previewUrl)
              ? currentOutput.previewUrl
              : "") ||
            null
          : null;
      const shouldPrimeGeneratedVideoFrame =
        currentOutput.mode === "video" &&
        currentOutput.mediaSource === "generated" &&
        !videoPosterUrl &&
        Boolean(hoverVideoUrl);
      const composerImageArtifact: ReferenceComposerImageDragArtifact | null =
        currentOutput.mode === "image" && card.dragDisplayArtifactUrl
          ? {
              displayArtifactUrl: card.dragDisplayArtifactUrl,
              displayArtifactKind: card.dragDisplayArtifactKind ?? "url",
              promptText: currentOutput.prompt?.trim() || currentOutput.previewText?.trim() || null,
              mediaId: currentOutput.savedMediaIds?.[0]?.trim() || null,
              previewStoragePath: currentOutput.previewStoragePath?.trim() || null,
              fullStoragePath: currentOutput.fullStoragePath?.trim() || null,
              referenceUrl: null,
              mimeType: currentOutput.mimeType?.trim() || null,
              width:
                typeof currentOutput.width === "number" &&
                Number.isFinite(currentOutput.width) &&
                currentOutput.width > 0
                  ? Math.max(1, Math.round(currentOutput.width))
                  : undefined,
              height:
                typeof currentOutput.height === "number" &&
                Number.isFinite(currentOutput.height) &&
                currentOutput.height > 0
                  ? Math.max(1, Math.round(currentOutput.height))
                  : undefined,
            }
          : null;
      const videoNodeKey = `${options.surface}:${currentOutput.id}`;
      const audioInstanceKey = `${options.surface}:${currentOutput.id}`;
      const renderContainPreview = currentOutput.mode === "image";
      const audioBackgroundImageUrl =
        currentOutput.mode === "audio" &&
        currentOutput.companionArtUrl &&
        !isSupabaseRenderImageUrl(currentOutput.companionArtUrl)
          ? applyAdaptivePreviewTransform({
              url: currentOutput.companionArtUrl,
              qualityBand: card.previewQualityBand ?? "compact",
              targetLongEdgePx: card.targetLongEdgePx ?? 320,
              mediaKindHint: "image",
              surface: options.isCuratedSurface ? "quick-slot" : "reference-grid",
            })
          : null;
      return (
        <ReferenceGridCard
          key={options.isCuratedSurface ? `curated-${currentOutput.id}` : currentOutput.id}
          item={currentOutput}
          dragSourceSurface={options.surface}
          videoNodeKey={videoNodeKey}
          audioInstanceKey={audioInstanceKey}
          activeOutputId={activeOutputId}
          authorityTier={card.authorityTier}
          isLoading={isCardLoading}
          loadingVisual={loadingVisual}
          cardPreviewUrl={card.cardPreviewUrl}
          videoPosterUrl={videoPosterUrl}
          hoverVideoUrl={hoverVideoUrl}
          isVideoPreview={card.isVideoPreview}
          isImagePreview={card.isImagePreview}
          isAudioPreview={card.isAudioPreview}
          canAutoplayVideo={canAutoplayVideo}
          videoPreload={
            shouldPrimeGeneratedVideoFrame ? "auto" : shouldWarmVideoPreview ? "metadata" : "none"
          }
          isPromptOnly={isPromptOnly}
          isLinkedPromptReference={isLinkedPromptReference}
          canRetryStatus={canRetryStatus}
          imageSrc={card.imageSrc}
          imageLoading={card.isPriorityHydration ? "eager" : "lazy"}
          imageFetchPriority={card.isPriorityHydration ? "high" : "low"}
          renderContainPreview={renderContainPreview}
          audioBackgroundImageUrl={audioBackgroundImageUrl}
          onSelectOutput={onSelectOutput}
          onOpenDetails={onOpenDetails}
          onCardDragStart={onCardDragStart}
          composerImageArtifact={composerImageArtifact}
          onCardDragEnd={onCardDragEnd}
          onCardDragOver={
            options.isCuratedSurface
              ? (event) => {
                  onCuratedSectionDragOver(event);
                }
              : undefined
          }
          onCardDrop={options.isCuratedSurface ? onCuratedCardDrop : undefined}
          onCardDragEnter={
            options.isCuratedSurface
              ? (event) => {
                  onCuratedSectionDragEnter(event);
                }
              : undefined
          }
          onCardDragLeave={
            options.isCuratedSurface
              ? (event) => {
                  onCuratedSectionDragLeave(event);
                }
              : undefined
          }
          onKeyboardReorderCurated={
            options.isCuratedSurface ? onCuratedCardKeyboardReorder : undefined
          }
          registerVideoNode={registerVideoNode}
          markLoaded={markLoaded}
          onAutoplayStarted={onAutoplayStarted}
          onAutoplayStopped={onAutoplayStopped}
          onRequestAudioPlay={resolvedAudioPlaybackController.requestPlay}
          onAudioPlaybackStarted={resolvedAudioPlaybackController.markPlaying}
          onAudioPlaybackStopped={resolvedAudioPlaybackController.clearActivePlayer}
          onRetryStatus={onRetryStatus}
          onRerollOutput={options.isCuratedSurface ? undefined : onRerollOutput}
          onDeleteOutput={options.isCuratedSurface ? undefined : onDeleteOutput}
          onClearGenerationOutput={isGenerationLoading ? onClearGenerationOutput : undefined}
          onRemoveCuratedReference={options.isCuratedSurface ? onRemoveCuratedReference : undefined}
          showCuratedRemoveAction={options.isCuratedSurface}
          isMediaStorageFull={isMediaStorageFull}
          onSaveToLibrary={onSaveToLibrary}
          onDownload={onDownload}
          hideReferenceActions={options.isCuratedSurface}
        />
      );
    },
    [
      activeOutputId,
      resolvedAudioPlaybackController,
      autoplayEnabledIdSet,
      linkedPromptReferenceIdSet,
      markLoaded,
      visibleOutputById,
      generationLoadingCardIdSet,
      hydrationLoadingCardIdSet,
      onAutoplayStarted,
      onAutoplayStopped,
      onCardDragEnd,
      onCardDragStart,
      onCuratedCardDrop,
      onCuratedCardKeyboardReorder,
      onCuratedSectionDragEnter,
      onCuratedSectionDragLeave,
      onCuratedSectionDragOver,
      onDeleteOutput,
      onClearGenerationOutput,
      onDownload,
      onOpenDetails,
      onRemoveCuratedReference,
      onRerollOutput,
      onRetryStatus,
      isMediaStorageFull,
      onSaveToLibrary,
      onSelectOutput,
      loadingCardIdSet,
      perfDegradeLevel,
      registerVideoNode,
      visibleQuickSlotIdSet,
    ]
  );

  const curatedCardNodes = React.useMemo(
    () =>
      curatedVisibleCardItems.map((card) =>
        renderReferenceCard(card, {
          surface: "curated",
          isCuratedSurface: true,
        })
      ),
    [curatedVisibleCardItems, renderReferenceCard]
  );
  const allRefsCardNodes = React.useMemo(
    () =>
      visibleCardItems.map((card) =>
        renderReferenceCard(card, {
          surface: "all-refs",
          isCuratedSurface: false,
        })
      ),
    [renderReferenceCard, visibleCardItems]
  );

  return {
    curatedCardNodes,
    allRefsCardNodes,
  };
};

/**
 * @deprecated Use `ReferenceGridVisibleCard`.
 */
