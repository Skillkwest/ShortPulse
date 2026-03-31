/**
 * Loading-visual controller for Reference Grid cards.
 * Encapsulates loading/spinner derivation so render composition stays focused on layout wiring.
 */
import React from "react";
import type { ReferenceGridMediaAuthorityTier } from "../../logic/referenceGridMedia";
import type { StudioOutput } from "../../types";
import { classifyReferenceGridCardVisualState } from "../logic/referenceGridCardVisualState";
import type { ReferenceGridMediaOutput } from "../logic/referenceGridMediaOutput";

type LoadingVisualCard = {
  item: ReferenceGridMediaOutput;
  surface: "all-refs" | "curated";
  authorityTier: ReferenceGridMediaAuthorityTier;
  cardPreviewUrl: string | null;
  isImagePreview: boolean;
  isPriorityHydration: boolean;
  imageSrc?: string;
};

type UseReferenceGridLoadingVisualControllerArgs = {
  allVisibleCardItems: LoadingVisualCard[];
  visibleOutputById: Record<string, StudioOutput>;
  visibleQuickSlotIdSet: Set<string>;
  loadedMap: Record<string, boolean>;
  decodeBudgetEnabled: boolean;
};

type UseReferenceGridLoadingVisualControllerResult = {
  loadingCardIdSet: Set<string>;
  generationLoadingCardIdSet: Set<string>;
  hydrationLoadingCardIdSet: Set<string>;
  generationLoadingIdsLength: number;
  hydrationLoadingIdsLength: number;
  loadingIdsLength: number;
};

/**
 * Returns loading-card ids for placeholder/spinner visual rendering.
 */
export const useReferenceGridLoadingVisualController = ({
  allVisibleCardItems,
  visibleOutputById,
  visibleQuickSlotIdSet,
  loadedMap,
  decodeBudgetEnabled,
}: UseReferenceGridLoadingVisualControllerArgs): UseReferenceGridLoadingVisualControllerResult => {
  const loadingState = React.useMemo(() => {
    const nextLoadingIds: string[] = [];
    const nextGenerationLoadingIds: string[] = [];
    const nextHydrationLoadingIds: string[] = [];
    allVisibleCardItems.forEach((card) => {
      if (card.surface === "all-refs" && visibleQuickSlotIdSet.has(card.item.id)) return;
      const currentOutput = visibleOutputById[card.item.id];
      if (!currentOutput) return;
      const visualState = classifyReferenceGridCardVisualState({
        item: currentOutput,
        authorityTier: card.authorityTier,
        cardPreviewUrl: card.cardPreviewUrl,
        isLoaded: Boolean(loadedMap[card.item.id]),
        decodeBudgetEnabled,
        isImagePreview: card.isImagePreview,
        isPriorityHydration: card.isPriorityHydration,
        imageSrc: card.imageSrc,
      });
      if (visualState.isLoading) {
        nextLoadingIds.push(card.item.id);
      }
      if (visualState.isGenerationLoading) {
        nextGenerationLoadingIds.push(card.item.id);
      }
      if (visualState.isMediaHydrating) {
        nextHydrationLoadingIds.push(card.item.id);
      }
    });
    return {
      loadingIds: nextLoadingIds,
      generationLoadingIds: nextGenerationLoadingIds,
      hydrationLoadingIds: nextHydrationLoadingIds,
    };
  }, [
    allVisibleCardItems,
    decodeBudgetEnabled,
    loadedMap,
    visibleOutputById,
    visibleQuickSlotIdSet,
  ]);

  const loadingCardIdSet = React.useMemo(() => new Set(loadingState.loadingIds), [loadingState]);
  const generationLoadingCardIdSet = React.useMemo(
    () => new Set(loadingState.generationLoadingIds),
    [loadingState]
  );
  const hydrationLoadingCardIdSet = React.useMemo(
    () => new Set(loadingState.hydrationLoadingIds),
    [loadingState]
  );

  return {
    loadingCardIdSet,
    generationLoadingCardIdSet,
    hydrationLoadingCardIdSet,
    generationLoadingIdsLength: loadingState.generationLoadingIds.length,
    hydrationLoadingIdsLength: loadingState.hydrationLoadingIds.length,
    loadingIdsLength: loadingState.loadingIds.length,
  };
};
