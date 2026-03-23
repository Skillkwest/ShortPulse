/**
 * Hydration queue scheduling controller for Reference Grid.
 * Enqueues priority + near-viewport image hydration candidates and prunes stale queue entries.
 */
import { useEffect } from "react";
import type { ReferenceGridPreviewQualityBand } from "../../logic/referenceGridMedia";
import type { StudioOutput } from "../../types";
import type { ReferenceGridVisibleCardItem } from "./useReferenceGridCardItemsController";
import type { ReferenceGridResolvedCardMedia } from "./useReferenceGridResolvedMediaController";

type UseReferenceGridHydrationQueueControllerArgs = {
  decodeBudgetEnabled: boolean;
  suspendHydrationQueue?: boolean;
  activeOutputId: string | null;
  outputs: StudioOutput[];
  visibleCardItems: ReferenceGridVisibleCardItem[];
  curatedVisibleCardItems: ReferenceGridVisibleCardItem[];
  hydrationQuickSlotPreferredIdSet: Set<string>;
  nearViewportOutputs: StudioOutput[];
  nearViewportCuratedOutputs: StudioOutput[];
  virtualRowHeight: number;
  curatedVirtualRowHeight: number;
  quickSlotAdaptiveSurfaceEnabled: boolean;
  resolveCardMedia: (args: {
    item: StudioOutput;
    mediaSurface: "reference-grid" | "quick-slot";
    cardLongEdgePx: number;
  }) => ReferenceGridResolvedCardMedia;
  enqueueImageHydration: (
    id: string,
    url: string,
    options?: {
      priority?: "high" | "normal" | "low";
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
  activeOutputId,
  outputs,
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
    if (!decodeBudgetEnabled) return;
    if (suspendHydrationQueue) return;
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
    const candidateIdSet = new Set<string>();
    if (activeOutputId) {
      const activeOutput = outputs.find((item) => item.id === activeOutputId);
      if (activeOutput) {
        const resolvedMedia = resolveCardMedia({
          item: activeOutput,
          mediaSurface: resolvePreferredSurface(activeOutputId),
          cardLongEdgePx: resolvePreferredCardLongEdge(activeOutputId),
        });
        if (resolvedMedia.previewUrl && resolvedMedia.isImagePreview) {
          candidateIdSet.add(activeOutputId);
          enqueueImageHydration(activeOutputId, resolvedMedia.previewUrl, {
            priority: "high",
            targetLongEdgePx: resolvedMedia.targetLongEdgePx,
            previewQualityBand: resolvedMedia.previewQualityBand,
            fallbackUrl: resolvedMedia.fallbackUrl ?? undefined,
          });
        }
      }
    }

    curatedVisibleCardItems.forEach((card) => {
      if (!card.isImagePreview || !card.cardPreviewUrl) return;
      if (candidateIdSet.has(card.item.id)) return;
      candidateIdSet.add(card.item.id);
      enqueueImageHydration(card.item.id, card.cardPreviewUrl, {
        priority: card.isPriorityHydration ? "high" : "normal",
        targetLongEdgePx: card.targetLongEdgePx,
        previewQualityBand: card.previewQualityBand,
        fallbackUrl: card.fallbackUrl ?? undefined,
      });
    });

    visibleCardItems.forEach((card) => {
      if (!card.isImagePreview || !card.cardPreviewUrl) return;
      if (candidateIdSet.has(card.item.id)) return;
      candidateIdSet.add(card.item.id);
      enqueueImageHydration(card.item.id, card.cardPreviewUrl, {
        priority: card.isPriorityHydration ? "high" : "normal",
        targetLongEdgePx: card.targetLongEdgePx,
        previewQualityBand: card.previewQualityBand,
        fallbackUrl: card.fallbackUrl ?? undefined,
      });
    });

    nearViewportCuratedOutputs.forEach((item) => {
      if (candidateIdSet.has(item.id)) return;
      const resolvedMedia = resolveCardMedia({
        item,
        mediaSurface: quickSlotAdaptiveSurfaceEnabled ? "quick-slot" : "reference-grid",
        cardLongEdgePx: quickSlotCardLongEdgePx,
      });
      if (!resolvedMedia.previewUrl || !resolvedMedia.isImagePreview) return;
      candidateIdSet.add(item.id);
      enqueueImageHydration(item.id, resolvedMedia.previewUrl, {
        priority: "low",
        targetLongEdgePx: resolvedMedia.targetLongEdgePx,
        previewQualityBand: resolvedMedia.previewQualityBand,
        fallbackUrl: resolvedMedia.fallbackUrl ?? undefined,
      });
    });

    nearViewportOutputs.forEach((item) => {
      if (candidateIdSet.has(item.id)) return;
      const resolvedMedia = resolveCardMedia({
        item,
        mediaSurface: "reference-grid",
        cardLongEdgePx: referenceGridCardLongEdgePx,
      });
      if (!resolvedMedia.previewUrl || !resolvedMedia.isImagePreview) return;
      candidateIdSet.add(item.id);
      enqueueImageHydration(item.id, resolvedMedia.previewUrl, {
        priority: "low",
        targetLongEdgePx: resolvedMedia.targetLongEdgePx,
        previewQualityBand: resolvedMedia.previewQualityBand,
        fallbackUrl: resolvedMedia.fallbackUrl ?? undefined,
      });
    });

    pruneHydrationQueueToCandidateIds(candidateIdSet);
  }, [
    activeOutputId,
    curatedVirtualRowHeight,
    curatedVisibleCardItems,
    decodeBudgetEnabled,
    enqueueImageHydration,
    hydrationQuickSlotPreferredIdSet,
    nearViewportCuratedOutputs,
    nearViewportOutputs,
    outputs,
    pruneHydrationQueueToCandidateIds,
    quickSlotAdaptiveSurfaceEnabled,
    resolveCardMedia,
    suspendHydrationQueue,
    virtualRowHeight,
    visibleCardItems,
  ]);
};
