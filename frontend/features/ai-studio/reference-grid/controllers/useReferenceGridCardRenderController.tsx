/**
 * Card render controller for Reference Grid.
 * Keeps per-card action wiring and visual state mapping out of ReferenceGrid.
 */
import React, { useCallback } from "react";
import { ReferenceGridCard } from "../components/ReferenceGridCard";
import type { ReferenceGridMediaAuthorityTier } from "../../logic/referenceGridMedia";
import type { StudioOutput, WorkflowReloadMediaKindHint } from "../../types";
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
import type { ReferenceGridOpenDetailsOptions } from "../referenceGridTypes";
import {
  incrementFreezeInvestigationCounter,
  setFreezeInvestigationGauge,
} from "../../logic/freezeInvestigationTelemetry";
import { isSupabaseRenderImageUrl } from "../../../../lib/mediaPreviewTrustPolicy";

export type ReferenceGridVisibleCard = {
  item: ReferenceGridMediaOutput;
  authorityTier: ReferenceGridMediaAuthorityTier;
  cardPreviewUrl: string | null;
  videoPosterUrl?: string | null;
  audioBackgroundImageUrl?: string | null;
  playableMediaUrl?: string | null;
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
  suspendBackgroundVisualWork?: boolean;
  visibleCardItems: ReferenceGridVisibleCard[];
  curatedVisibleCardItems: ReferenceGridVisibleCard[];
  visibleQuickSlotIdSet: Set<string>;
  onSelectReferenceGridOutput: (id: string) => void;
  onSelectQuickSlotOutput: (id: string) => void;
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
  onRerollOutput?: (output: StudioOutput) => void;
  onReloadWorkflowOutput?: (
    output: StudioOutput,
    options?: { mediaKindHint?: WorkflowReloadMediaKindHint | null }
  ) => void;
  onDeleteOutput?: (id: string) => void;
  onClearGenerationOutput?: (id: string) => void;
  onRemoveCuratedReference?: (id: string) => void;
  onAllRefsMediaHoverChange?: (active: boolean) => void;
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

const resolveLoadingStatusLabel = ({
  item,
  loadingVisual,
  isLocalVideoPersistenceLoading,
}: {
  item: StudioOutput;
  loadingVisual: "none" | "spinner" | "hydrating";
  isLocalVideoPersistenceLoading: boolean;
}): string | null => {
  if (loadingVisual === "hydrating" || isLocalVideoPersistenceLoading) return null;
  if (item.mediaSource === "upload") {
    return item.saveState === "saving" ? "Saving" : "Uploading";
  }
  return "Generating";
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
  suspendBackgroundVisualWork = false,
  visibleCardItems,
  curatedVisibleCardItems,
  visibleQuickSlotIdSet,
  onSelectReferenceGridOutput,
  onSelectQuickSlotOutput,
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
  onRerollOutput,
  onReloadWorkflowOutput,
  onDeleteOutput,
  onClearGenerationOutput,
  onRemoveCuratedReference,
  onAllRefsMediaHoverChange,
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
      const shouldClearAsGeneration =
        isGenerationLoading && currentOutput.mediaSource === "generated";
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
      const loadingStatusLabel = resolveLoadingStatusLabel({
        item: currentOutput,
        loadingVisual,
        isLocalVideoPersistenceLoading,
      });
      const canAutoplayVideo =
        card.isVideoPreview &&
        !shouldPreferCuratedSurface &&
        autoplayEnabledIdSet.has(currentOutput.id) &&
        perfDegradeLevel < 2;
      const suppressHoverVideo =
        card.isVideoPreview && perfDegradeLevel >= 2 && activeOutputId !== currentOutput.id;
      const isPromptOnly = !card.cardPreviewUrl && !!currentOutput.previewText;
      const isLinkedPromptReference =
        isPromptOnly && linkedPromptReferenceIdSet.has(currentOutput.id);
      const videoPosterUrl =
        currentOutput.mode === "video"
          ? card.videoPosterUrl?.trim() ||
            currentOutput.previewPosterUrl?.trim() ||
            (card.isImagePreview ? card.cardPreviewUrl : "") ||
            null
          : null;
      const hoverVideoUrl =
        currentOutput.mode === "video"
          ? currentOutput.localObjectUrl?.trim() ||
            card.playableMediaUrl?.trim() ||
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
      const audioAssetKey = `studio-output:${currentOutput.id}`;
      const renderContainPreview = currentOutput.mode === "image";
      const clearLoadingOutputHandler = isCardLoading
        ? shouldClearAsGeneration
          ? onClearGenerationOutput
          : onDeleteOutput
        : undefined;
      const clearLoadingLabel = shouldClearAsGeneration
        ? "Clear generation from grid"
        : "Remove loading media from grid";
      const resolvedAudioBackgroundSource =
        card.audioBackgroundImageUrl?.trim() || currentOutput.companionArtUrl?.trim() || null;
      const audioBackgroundImageUrl =
        currentOutput.mode === "audio" &&
        resolvedAudioBackgroundSource &&
        !isSupabaseRenderImageUrl(resolvedAudioBackgroundSource)
          ? applyAdaptivePreviewTransform({
              url: resolvedAudioBackgroundSource,
              qualityBand: card.previewQualityBand ?? "compact",
              targetLongEdgePx: card.targetLongEdgePx ?? 320,
              mediaKindHint: "image",
              surface: options.isCuratedSurface ? "quick-slot" : "reference-grid",
            })
          : null;
      const handleSelectOutput = options.isCuratedSurface
        ? onSelectQuickSlotOutput
        : onSelectReferenceGridOutput;
      return (
        <ReferenceGridCard
          key={options.isCuratedSurface ? `curated-${currentOutput.id}` : currentOutput.id}
          item={currentOutput}
          dragSourceSurface={options.surface}
          detailSurface={options.isCuratedSurface ? "quick-slot" : "reference-grid"}
          videoNodeKey={videoNodeKey}
          audioInstanceKey={audioInstanceKey}
          audioAssetKey={audioAssetKey}
          activeOutputId={activeOutputId}
          authorityTier={card.authorityTier}
          isLoading={isCardLoading}
          loadingVisual={loadingVisual}
          loadingStatusLabel={loadingStatusLabel}
          cardPreviewUrl={card.cardPreviewUrl}
          videoPosterUrl={videoPosterUrl}
          hoverVideoUrl={hoverVideoUrl}
          suppressHoverVideo={suppressHoverVideo}
          playableMediaUrl={card.playableMediaUrl ?? null}
          isVideoPreview={card.isVideoPreview}
          isImagePreview={card.isImagePreview}
          isAudioPreview={card.isAudioPreview}
          canAutoplayVideo={canAutoplayVideo}
          videoPreload={shouldWarmVideoPreview ? "metadata" : "none"}
          allowDurationProbe={!suspendBackgroundVisualWork}
          isPromptOnly={isPromptOnly}
          isLinkedPromptReference={isLinkedPromptReference}
          imageSrc={card.imageSrc}
          imageLoading={card.isPriorityHydration ? "eager" : "lazy"}
          imageFetchPriority={card.isPriorityHydration ? "high" : "low"}
          renderContainPreview={renderContainPreview}
          audioBackgroundImageUrl={audioBackgroundImageUrl}
          onSelectOutput={handleSelectOutput}
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
          onRerollOutput={onRerollOutput}
          onReloadWorkflowOutput={
            onReloadWorkflowOutput
              ? (_output, reloadOptions) => {
                  onReloadWorkflowOutput(currentOutput, reloadOptions);
                }
              : undefined
          }
          onDeleteOutput={options.isCuratedSurface ? undefined : onDeleteOutput}
          onClearLoadingOutput={clearLoadingOutputHandler}
          loadingClearLabel={clearLoadingLabel}
          onRemoveCuratedReference={options.isCuratedSurface ? onRemoveCuratedReference : undefined}
          onMediaHoverChange={options.isCuratedSurface ? undefined : onAllRefsMediaHoverChange}
          showCuratedRemoveAction={options.isCuratedSurface}
          isMediaStorageFull={isMediaStorageFull}
          onSaveToLibrary={onSaveToLibrary}
          onDownload={onDownload}
          hideReferenceActions={options.isCuratedSurface}
          allowRerollWhenActionsHidden={options.isCuratedSurface}
          allowWorkflowReloadWhenActionsHidden={options.isCuratedSurface}
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
      onAllRefsMediaHoverChange,
      onDownload,
      onOpenDetails,
      onRemoveCuratedReference,
      onReloadWorkflowOutput,
      onRerollOutput,
      isMediaStorageFull,
      onSaveToLibrary,
      onSelectQuickSlotOutput,
      onSelectReferenceGridOutput,
      loadingCardIdSet,
      perfDegradeLevel,
      registerVideoNode,
      suspendBackgroundVisualWork,
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
