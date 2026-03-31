/**
 * Hydration queue scheduling controller for Reference Grid.
 * Enqueues priority + near-viewport image hydration candidates and prunes stale queue entries.
 */
import { useEffect } from "react";
import type { ReferenceGridPreviewQualityBand } from "../../logic/referenceGridMedia";
import type { ReferenceGridMediaOutput } from "../logic/referenceGridMediaOutput";
import { isReferenceGridPlaceholderOnlyMediaOutput } from "../logic/referenceGridMediaOutput";
import type { ReferenceGridVisibleCardItem } from "./useReferenceGridCardItemsController";
import type { ReferenceGridResolvedCardMedia } from "./useReferenceGridResolvedMediaController";

type UseReferenceGridHydrationQueueControllerArgs = {
  decodeBudgetEnabled: boolean;
  suspendHydrationQueue?: boolean;
  activeOutput: ReferenceGridMediaOutput | null;
  visibleCardItems: ReferenceGridVisibleCardItem[];
  curatedVisibleCardItems: ReferenceGridVisibleCardItem[];
  hydrationQuickSlotPreferredIdSet: Set<string>;
  nearViewportOutputs: ReferenceGridMediaOutput[];
  nearViewportCuratedOutputs: ReferenceGridMediaOutput[];
  virtualRowHeight: number;
  curatedVirtualRowHeight: number;
  quickSlotAdaptiveSurfaceEnabled: boolean;
  resolveCardMedia: (args: {
    item: ReferenceGridMediaOutput;
    mediaSurface: "reference-grid" | "quick-slot";
    cardLongEdgePx: number;
  }) => ReferenceGridResolvedCardMedia;
  enqueueImageHydration: (
    id: string,
    url: string,
    options?: {
      priority?: "high" | "normal" | "low";
      mediaSurface?: "reference-grid" | "quick-slot";
      targetLongEdgePx?: number;
      previewQualityBand?: ReferenceGridPreviewQualityBand;
      fallbackUrl?: string;
    }
  ) => void;
  pruneHydrationQueueToCandidateIds: (candidateIdSet: Set<string>) => void;
};

/**
 * Schedules hydration candidates for active/visible/near-viewport cards with unchanged priority ordering.
 */
export const useReferenceGridHydrationQueueController = ({
  decodeBudgetEnabled,
  suspendHydrationQueue = false,
  activeOutput,
  visibleCardItems,
  curatedVisibleCardItems,
  hydrationQuickSlotPreferredIdSet,
  nearViewportOutputs,
  nearViewportCuratedOutputs,
  virtualRowHeight,
  curatedVirtualRowHeight,
  quickSlotAdaptiveSurfaceEnabled,
  resolveCardMedia,
  enqueueImageHydration,
  pruneHydrationQueueToCandidateIds,
}: UseReferenceGridHydrationQueueControllerArgs): void => {
  useEffect(() => {
    const referenceGridCardLongEdgePx = Math.max(
      240,
      Math.round(Math.max(1, virtualRowHeight - 3))
    );
    const quickSlotCardLongEdgePx = Math.max(
      200,
      Math.round(Math.max(1, curatedVirtualRowHeight - 3))
    );
    const resolvePreferredSurface = (id: string): "reference-grid" | "quick-slot" =>
      hydrationQuickSlotPreferredIdSet.has(id) && quickSlotAdaptiveSurfaceEnabled
        ? "quick-slot"
        : "reference-grid";
    const resolvePreferredCardLongEdge = (id: string): number =>
      hydrationQuickSlotPreferredIdSet.has(id)
        ? quickSlotCardLongEdgePx
        : referenceGridCardLongEdgePx;
    const shouldEnqueueHydration = decodeBudgetEnabled && !suspendHydrationQueue;
    const candidateIdSet = new Set<string>();
    if (activeOutput) {
      if (!isReferenceGridPlaceholderOnlyMediaOutput(activeOutput)) {
        const resolvedMedia = resolveCardMedia({
          item: activeOutput,
          mediaSurface: resolvePreferredSurface(activeOutput.id),
          cardLongEdgePx: resolvePreferredCardLongEdge(activeOutput.id),
        });
        if (resolvedMedia.previewUrl && resolvedMedia.isImagePreview) {
          candidateIdSet.add(activeOutput.id);
          if (shouldEnqueueHydration) {
            enqueueImageHydration(activeOutput.id, resolvedMedia.previewUrl, {
              priority: "high",
              mediaSurface: resolvePreferredSurface(activeOutput.id),
              targetLongEdgePx: resolvedMedia.targetLongEdgePx,
              previewQualityBand: resolvedMedia.previewQualityBand,
              fallbackUrl: resolvedMedia.fallbackUrl ?? undefined,
            });
          }
        }
      }
    }

    curatedVisibleCardItems.forEach((card) => {
      if (!card.isImagePreview || !card.cardPreviewUrl) return;
      if (candidateIdSet.has(card.item.id)) return;
      candidateIdSet.add(card.item.id);
      if (shouldEnqueueHydration) {
        enqueueImageHydration(card.item.id, card.cardPreviewUrl, {
          priority: card.isPriorityHydration ? "high" : "normal",
          mediaSurface: card.mediaSurface,
          targetLongEdgePx: card.targetLongEdgePx,
          previewQualityBand: card.previewQualityBand,
          fallbackUrl: card.fallbackUrl ?? undefined,
        });
      }
    });

    visibleCardItems.forEach((card) => {
      if (!card.isImagePreview || !card.cardPreviewUrl) return;
      if (candidateIdSet.has(card.item.id)) return;
      candidateIdSet.add(card.item.id);
      if (shouldEnqueueHydration) {
        enqueueImageHydration(card.item.id, card.cardPreviewUrl, {
          priority: card.isPriorityHydration ? "high" : "normal",
          mediaSurface: card.mediaSurface,
          targetLongEdgePx: card.targetLongEdgePx,
          previewQualityBand: card.previewQualityBand,
          fallbackUrl: card.fallbackUrl ?? undefined,
        });
      }
    });

    nearViewportCuratedOutputs.forEach((item) => {
      if (candidateIdSet.has(item.id)) return;
      if (isReferenceGridPlaceholderOnlyMediaOutput(item)) return;
      const resolvedMedia = resolveCardMedia({
        item,
        mediaSurface: quickSlotAdaptiveSurfaceEnabled ? "quick-slot" : "reference-grid",
        cardLongEdgePx: quickSlotCardLongEdgePx,
      });
      if (!resolvedMedia.previewUrl || !resolvedMedia.isImagePreview) return;
      candidateIdSet.add(item.id);
      if (shouldEnqueueHydration) {
        enqueueImageHydration(item.id, resolvedMedia.previewUrl, {
          priority: "low",
          mediaSurface: quickSlotAdaptiveSurfaceEnabled ? "quick-slot" : "reference-grid",
          targetLongEdgePx: resolvedMedia.targetLongEdgePx,
          previewQualityBand: resolvedMedia.previewQualityBand,
          fallbackUrl: resolvedMedia.fallbackUrl ?? undefined,
        });
      }
    });

    nearViewportOutputs.forEach((item) => {
      if (candidateIdSet.has(item.id)) return;
      if (isReferenceGridPlaceholderOnlyMediaOutput(item)) return;
      const resolvedMedia = resolveCardMedia({
        item,
        mediaSurface: "reference-grid",
        cardLongEdgePx: referenceGridCardLongEdgePx,
      });
      if (!resolvedMedia.previewUrl || !resolvedMedia.isImagePreview) return;
      candidateIdSet.add(item.id);
      if (shouldEnqueueHydration) {
        enqueueImageHydration(item.id, resolvedMedia.previewUrl, {
          priority: "low",
          mediaSurface: "reference-grid",
          targetLongEdgePx: resolvedMedia.targetLongEdgePx,
          previewQualityBand: resolvedMedia.previewQualityBand,
          fallbackUrl: resolvedMedia.fallbackUrl ?? undefined,
        });
      }
    });

    pruneHydrationQueueToCandidateIds(candidateIdSet);
  }, [
    activeOutput,
    curatedVirtualRowHeight,
    curatedVisibleCardItems,
    decodeBudgetEnabled,
    enqueueImageHydration,
    hydrationQuickSlotPreferredIdSet,
    nearViewportCuratedOutputs,
    nearViewportOutputs,
    pruneHydrationQueueToCandidateIds,
    quickSlotAdaptiveSurfaceEnabled,
    resolveCardMedia,
    suspendHydrationQueue,
    virtualRowHeight,
    visibleCardItems,
  ]);
};
