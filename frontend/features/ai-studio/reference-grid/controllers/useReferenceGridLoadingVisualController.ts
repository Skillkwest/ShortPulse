/**
 * Loading-visual controller for Reference Grid cards.
 * Encapsulates loading/spinner derivation so render composition stays focused on layout wiring.
 */
import React from "react";
import type { StudioOutput } from "../../types";
import {
  isReferenceOutputFailing,
  isReferenceOutputLoadingTaskState,
} from "../logic/referenceGridLoadingState";

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
};

type UseReferenceGridLoadingVisualControllerResult = {
  loadingCardIdSet: Set<string>;
  loadingIdsLength: number;
};

/**
 * Returns loading-card ids for placeholder/spinner visual rendering.
 */
export const useReferenceGridLoadingVisualController = ({
  allVisibleCardItems,
  loadedMap,
  decodeBudgetEnabled,
}: UseReferenceGridLoadingVisualControllerArgs): UseReferenceGridLoadingVisualControllerResult => {
  const loadingIds = React.useMemo(() => {
    const nextLoadingIds: string[] = [];
    allVisibleCardItems.forEach((card) => {
      const isFailing = isReferenceOutputFailing(card.item);
      const isLoadingTaskState =
        !isFailing &&
        isReferenceOutputLoadingTaskState({
          taskState: card.item.taskState,
          previewText: card.item.previewText,
          cardPreviewUrl: card.cardPreviewUrl,
        });
      const isLoaded = loadedMap[card.item.id];
      const shouldShowLoading =
        !isFailing &&
        (isLoadingTaskState ||
          (!isLoaded && !card.item.previewText) ||
          (card.isImagePreview &&
            decodeBudgetEnabled &&
            !card.imageSrc &&
            card.isPriorityHydration));
      if (shouldShowLoading) {
        nextLoadingIds.push(card.item.id);
      }
    });
    return nextLoadingIds;
  }, [allVisibleCardItems, decodeBudgetEnabled, loadedMap]);

  const loadingCardIdSet = React.useMemo(() => new Set(loadingIds), [loadingIds]);

  return {
    loadingCardIdSet,
    loadingIdsLength: loadingIds.length,
  };
};
