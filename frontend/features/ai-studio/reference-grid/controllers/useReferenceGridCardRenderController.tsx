/**
 * Card render controller for Reference Grid.
 * Keeps per-card action wiring and visual state mapping out of ReferenceGrid.
 */
import React, { useCallback } from "react";
import { ReferenceGridCard } from "../components/ReferenceGridCard";
import type { ReferenceGridMediaAuthorityTier } from "../../logic/referenceGridMedia";
import type { StudioOutput } from "../../types";
import type { ReferenceDragSourceSurface } from "../../utils/dragDrop";
import { isVideoUrl } from "../../logic/stateParsers";
import { isReferenceOutputFailing } from "../logic/referenceGridLoadingState";
import { isLocalVideoReferencePendingPersistence } from "../logic/referenceGridCardVisualState";
import type { ReferenceGridMediaOutput } from "../logic/referenceGridMediaOutput";
import {
  incrementFreezeInvestigationCounter,
  setFreezeInvestigationGauge,
} from "../../logic/freezeInvestigationTelemetry";

export type ReferenceGridVisibleCard = {
  item: ReferenceGridMediaOutput;
  authorityTier: ReferenceGridMediaAuthorityTier;
  cardPreviewUrl: string | null;
  isVideoPreview: boolean;
  isImagePreview: boolean;
  isPriorityHydration: boolean;
  imageSrc?: string;
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
    sourceSurface: ReferenceDragSourceSurface
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
  onRetryStatus?: (output: StudioOutput) => void;
  onRerollOutput?: (output: StudioOutput) => void;
  onDeleteOutput?: (id: string) => void;
  onRemoveCuratedReference?: (id: string) => void;
  onSaveToLibrary?: (output: StudioOutput) => void;
  onDownload?: (output: StudioOutput) => void;
};

type UseReferenceGridCardRenderControllerResult = {
  curatedCardNodes: React.ReactNode[];
  allRefsCardNodes: React.ReactNode[];
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
  onRetryStatus,
  onRerollOutput,
  onDeleteOutput,
  onRemoveCuratedReference,
  onSaveToLibrary,
  onDownload,
}: UseReferenceGridCardRenderControllerArgs): UseReferenceGridCardRenderControllerResult => {
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
      const isCardLoading = suppressDormantVideoLoading
        ? false
        : suppressDuplicateAllRefsLoading
          ? false
          : loadingCardIdSet.has(card.item.id);
      const loadingVisual: "none" | "spinner" | "hydrating" =
        suppressDormantVideoLoading || suppressDuplicateAllRefsLoading
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
      const videoNodeKey = `${options.surface}:${currentOutput.id}`;
      return (
        <ReferenceGridCard
          key={options.isCuratedSurface ? `curated-${currentOutput.id}` : currentOutput.id}
          item={currentOutput}
          dragSourceSurface={options.surface}
          videoNodeKey={videoNodeKey}
          activeOutputId={activeOutputId}
          authorityTier={card.authorityTier}
          isLoading={isCardLoading}
          loadingVisual={loadingVisual}
          cardPreviewUrl={card.cardPreviewUrl}
          videoPosterUrl={videoPosterUrl}
          hoverVideoUrl={hoverVideoUrl}
          isVideoPreview={card.isVideoPreview}
          isImagePreview={card.isImagePreview}
          canAutoplayVideo={canAutoplayVideo}
          videoPreload={
            shouldWarmVideoPreview || shouldPrimeGeneratedVideoFrame ? "metadata" : "none"
          }
          isPromptOnly={isPromptOnly}
          isLinkedPromptReference={isLinkedPromptReference}
          canRetryStatus={canRetryStatus}
          imageSrc={card.imageSrc}
          imageLoading={card.isPriorityHydration ? "eager" : "lazy"}
          imageFetchPriority={card.isPriorityHydration ? "high" : "low"}
          onSelectOutput={onSelectOutput}
          onOpenDetails={onOpenDetails}
          onCardDragStart={onCardDragStart}
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
          onRetryStatus={onRetryStatus}
          onRerollOutput={options.isCuratedSurface ? undefined : onRerollOutput}
          onDeleteOutput={options.isCuratedSurface ? undefined : onDeleteOutput}
          onRemoveCuratedReference={options.isCuratedSurface ? onRemoveCuratedReference : undefined}
          showCuratedRemoveAction={options.isCuratedSurface}
          onSaveToLibrary={onSaveToLibrary}
          onDownload={onDownload}
          hideReferenceActions={options.isCuratedSurface}
        />
      );
    },
    [
      activeOutputId,
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
      onDownload,
      onOpenDetails,
      onRemoveCuratedReference,
      onRerollOutput,
      onRetryStatus,
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
