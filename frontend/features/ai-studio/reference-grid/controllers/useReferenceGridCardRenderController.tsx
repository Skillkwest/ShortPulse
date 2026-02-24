/**
 * Card render controller for Reference Grid.
 * Keeps per-card action wiring and visual state mapping out of ReferenceGrid.
 */
import React, { useCallback } from "react";
import { ReferenceGridCard } from "../components/ReferenceGridCard";
import type { StudioOutput } from "../../types";
import type { ReferenceDragSourceSurface } from "../../utils/dragDrop";

export type ReferenceGridVisibleCard = {
  item: StudioOutput;
  cardPreviewUrl: string | null;
  isVideoPreview: boolean;
  isImagePreview: boolean;
  isPriorityHydration: boolean;
  imageSrc?: string;
};

type UseReferenceGridCardRenderControllerArgs = {
  activeOutputId: string | null;
  showPromptGenerate: boolean;
  disablePromptGenerate: boolean;
  generateCostCredits: number | null | undefined;
  autoplayEnabledIdSet: Set<string>;
  linkedPromptReferenceIdSet: Set<string>;
  loadingCardIdSet: Set<string>;
  animatedSpinnerIdSet: Set<string>;
  perfDegradeLevel: 0 | 1 | 2;
  visibleCardItems: ReferenceGridVisibleCard[];
  curatedVisibleCardItems: ReferenceGridVisibleCard[];
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
  onDeleteOutput?: (id: string) => void;
  onRemoveCuratedReference?: (id: string) => void;
  onSaveToLibrary?: (output: StudioOutput) => void;
  onDownload?: (output: StudioOutput) => void;
  onGeneratePrompt?: (output: StudioOutput) => void;
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
  showPromptGenerate,
  disablePromptGenerate,
  generateCostCredits,
  autoplayEnabledIdSet,
  linkedPromptReferenceIdSet,
  loadingCardIdSet,
  animatedSpinnerIdSet,
  perfDegradeLevel,
  visibleCardItems,
  curatedVisibleCardItems,
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
  onDeleteOutput,
  onRemoveCuratedReference,
  onSaveToLibrary,
  onDownload,
  onGeneratePrompt,
}: UseReferenceGridCardRenderControllerArgs): UseReferenceGridCardRenderControllerResult => {
  const renderReferenceCard = useCallback(
    (
      card: ReferenceGridVisibleCard,
      options: {
        surface: ReferenceDragSourceSurface;
        isCuratedSurface: boolean;
      }
    ) => {
      const isFailing = card.item.taskState === "fail";
      const isLoading =
        !isFailing &&
        (card.item.taskState === "running" ||
          card.item.taskState === "pending" ||
          (card.item.taskState === "success" && !card.cardPreviewUrl && !card.item.previewText));
      // Keep placeholder loading class deterministic even before ancillary loading derivations settle.
      const isCardLoading = loadingCardIdSet.has(card.item.id) || isLoading;
      const loadingVisual: "none" | "spinner" = isCardLoading ? "spinner" : "none";
      const spinnerAnimated = animatedSpinnerIdSet.has(card.item.id);
      const canAutoplayVideo =
        card.isVideoPreview && autoplayEnabledIdSet.has(card.item.id) && perfDegradeLevel < 2;
      const isPromptOnly = !card.cardPreviewUrl && !!card.item.previewText;
      const isLinkedPromptReference = isPromptOnly && linkedPromptReferenceIdSet.has(card.item.id);
      const canRetryStatus = Boolean(onRetryStatus && card.item.taskId) && (isFailing || isLoading);
      const videoNodeKey = `${options.surface}:${card.item.id}`;
      return (
        <ReferenceGridCard
          key={options.isCuratedSurface ? `curated-${card.item.id}` : card.item.id}
          item={card.item}
          dragSourceSurface={options.surface}
          videoNodeKey={videoNodeKey}
          activeOutputId={activeOutputId}
          isLoading={isCardLoading}
          loadingVisual={loadingVisual}
          spinnerAnimated={spinnerAnimated}
          cardPreviewUrl={card.cardPreviewUrl}
          isVideoPreview={card.isVideoPreview}
          isImagePreview={card.isImagePreview}
          canAutoplayVideo={canAutoplayVideo}
          isPromptOnly={isPromptOnly}
          isLinkedPromptReference={isLinkedPromptReference}
          canRetryStatus={canRetryStatus}
          showPromptGenerate={showPromptGenerate}
          disablePromptGenerate={disablePromptGenerate}
          generateCostCredits={generateCostCredits}
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
          onDeleteOutput={options.isCuratedSurface ? undefined : onDeleteOutput}
          onRemoveCuratedReference={options.isCuratedSurface ? onRemoveCuratedReference : undefined}
          showCuratedRemoveAction={options.isCuratedSurface}
          onSaveToLibrary={onSaveToLibrary}
          onDownload={onDownload}
          onGeneratePrompt={onGeneratePrompt}
          hideReferenceActions={options.isCuratedSurface}
        />
      );
    },
    [
      activeOutputId,
      autoplayEnabledIdSet,
      disablePromptGenerate,
      generateCostCredits,
      linkedPromptReferenceIdSet,
      markLoaded,
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
      onGeneratePrompt,
      onOpenDetails,
      onRemoveCuratedReference,
      onRetryStatus,
      onSaveToLibrary,
      onSelectOutput,
      loadingCardIdSet,
      perfDegradeLevel,
      registerVideoNode,
      showPromptGenerate,
      animatedSpinnerIdSet,
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
export type ReferenceCanvasVisibleCard = ReferenceGridVisibleCard;
