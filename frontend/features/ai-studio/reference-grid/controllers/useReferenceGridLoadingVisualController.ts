/**
 * Loading-visual controller for Reference Grid cards.
 * Encapsulates loading/spinner derivation so render composition stays focused on layout wiring.
 */
import React from "react";
import type { StudioOutput } from "../../types";

type LoadingVisualCard = {
  item: StudioOutput;
  cardPreviewUrl: string | null;
  isImagePreview: boolean;
  isPriorityHydration: boolean;
  imageSrc?: string;
};

type UseReferenceGridLoadingVisualControllerArgs = {
  allVisibleCardItems: LoadingVisualCard[];
  loadedMap: Record<string, boolean>;
  decodeBudgetEnabled: boolean;
  perfDegradeLevel: 0 | 1 | 2;
  maxAnimatedSpinnersLevel0: number;
  maxAnimatedSpinnersLevel1: number;
  maxAnimatedSpinnersLevel2: number;
};

type UseReferenceGridLoadingVisualControllerResult = {
  loadingCardIdSet: Set<string>;
  animatedSpinnerIdSet: Set<string>;
  loadingIdsLength: number;
};

/**
 * Returns loading-card ids plus spinner animation ids with unchanged prioritization semantics.
 */
export const useReferenceGridLoadingVisualController = ({
  allVisibleCardItems,
  loadedMap,
  decodeBudgetEnabled,
  perfDegradeLevel,
  maxAnimatedSpinnersLevel0,
  maxAnimatedSpinnersLevel1,
  maxAnimatedSpinnersLevel2,
}: UseReferenceGridLoadingVisualControllerArgs): UseReferenceGridLoadingVisualControllerResult => {
  const loadingCardState = React.useMemo(() => {
    const nextLoadingIds: string[] = [];
    const nextSpinnerCandidateIds: string[] = [];
    allVisibleCardItems.forEach((card) => {
      const isFailing = card.item.taskState === "fail";
      const isLoading =
        !isFailing &&
        (card.item.taskState === "running" ||
          card.item.taskState === "pending" ||
          (card.item.taskState === "success" && !card.cardPreviewUrl && !card.item.previewText));
      if (isLoading) {
        nextSpinnerCandidateIds.push(card.item.id);
      }
      const isLoaded = loadedMap[card.item.id];
      const shouldShowLoading =
        !isFailing &&
        (isLoading ||
          (!isLoaded && !card.item.previewText) ||
          (card.isImagePreview &&
            decodeBudgetEnabled &&
            !card.imageSrc &&
            card.isPriorityHydration));
      if (shouldShowLoading) {
        nextLoadingIds.push(card.item.id);
      }
    });
    return {
      loadingIds: nextLoadingIds,
      spinnerCandidateIds: nextSpinnerCandidateIds,
    };
  }, [allVisibleCardItems, decodeBudgetEnabled, loadedMap]);

  const loadingCardIdSet = React.useMemo(
    () => new Set(loadingCardState.loadingIds),
    [loadingCardState.loadingIds]
  );
  const maxAnimatedSpinners = React.useMemo(() => {
    if (perfDegradeLevel >= 2) return maxAnimatedSpinnersLevel2;
    if (perfDegradeLevel >= 1) return maxAnimatedSpinnersLevel1;
    return maxAnimatedSpinnersLevel0;
  }, [
    maxAnimatedSpinnersLevel0,
    maxAnimatedSpinnersLevel1,
    maxAnimatedSpinnersLevel2,
    perfDegradeLevel,
  ]);
  // Pending outputs are inserted at index 0; reverse yields FIFO by generation age.
  const pendingSpinnerQueueIds = React.useMemo(
    () => [...loadingCardState.spinnerCandidateIds].reverse(),
    [loadingCardState.spinnerCandidateIds]
  );
  const spinnerSlotIds = React.useMemo(
    () => pendingSpinnerQueueIds.slice(0, Math.max(1, maxAnimatedSpinners)),
    [maxAnimatedSpinners, pendingSpinnerQueueIds]
  );
  const animatedSpinnerIdSet = React.useMemo(() => new Set(spinnerSlotIds), [spinnerSlotIds]);

  return {
    loadingCardIdSet,
    animatedSpinnerIdSet,
    loadingIdsLength: loadingCardState.loadingIds.length,
  };
};
