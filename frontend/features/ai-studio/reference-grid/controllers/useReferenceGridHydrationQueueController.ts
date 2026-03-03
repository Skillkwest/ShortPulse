/**
 * Hydration queue scheduling controller for Reference Grid.
 * Enqueues priority + near-viewport image hydration candidates and prunes stale queue entries.
 */
import { useEffect } from "react";
import {
  resolveReferenceCardUrls,
  type ReferenceGridPreviewQualityBand,
} from "../../logic/referenceGridMedia";
import type { StudioOutput } from "../../types";
import type { ReferenceGridVisibleCardItem } from "./useReferenceGridCardItemsController";
import {
  isOutputVideoPreview,
  resolveFirstRenderableUrl,
} from "../logic/referenceGridMediaHelpers";

type UseReferenceGridHydrationQueueControllerArgs = {
  decodeBudgetEnabled: boolean;
  activeOutputId: string | null;
  outputs: StudioOutput[];
  visibleCardItems: ReferenceGridVisibleCardItem[];
  curatedVisibleCardItems: ReferenceGridVisibleCardItem[];
  nearViewportOutputs: StudioOutput[];
  nearViewportCuratedOutputs: StudioOutput[];
  previewQualityPressureLevel: 0 | 1 | 2;
  strictPreviewLadder: boolean;
  adaptivePreviewRoutingEnabled: boolean;
  virtualRowHeight: number;
  curatedVirtualRowHeight: number;
  quickSlotAdaptiveSurfaceEnabled: boolean;
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
  activeOutputId,
  outputs,
  visibleCardItems,
  curatedVisibleCardItems,
  nearViewportOutputs,
  nearViewportCuratedOutputs,
  previewQualityPressureLevel,
  strictPreviewLadder,
  adaptivePreviewRoutingEnabled,
  virtualRowHeight,
  curatedVirtualRowHeight,
  quickSlotAdaptiveSurfaceEnabled,
  enqueueImageHydration,
  pruneHydrationQueueToCandidateIds,
}: UseReferenceGridHydrationQueueControllerArgs): void => {
  useEffect(() => {
    if (!decodeBudgetEnabled) return;
    const candidateIdSet = new Set<string>();
    if (activeOutputId) {
      const activeOutput = outputs.find((item) => item.id === activeOutputId);
      if (activeOutput) {
        const resolved = resolveReferenceCardUrls(activeOutput, {
          strictPreviewLadder,
          adaptivePreviewQuality: adaptivePreviewRoutingEnabled,
          pressureLevel: previewQualityPressureLevel,
          surface: "reference-grid",
          cardLongEdgePx: Math.max(240, Math.round(Math.max(1, virtualRowHeight - 3))),
          devicePixelRatio: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
        });
        const activeUrl = resolved.previewUrl ?? resolved.fullUrl;
        if (activeUrl && !isOutputVideoPreview(activeOutput, activeUrl)) {
          candidateIdSet.add(activeOutputId);
          enqueueImageHydration(activeOutputId, activeUrl, {
            priority: "high",
            targetLongEdgePx: resolved.targetLongEdgePx,
            previewQualityBand: resolved.previewQualityBand,
            fallbackUrl:
              resolveFirstRenderableUrl(
                resolved.fullUrl,
                activeOutput.previewUrl,
                activeOutput.fullStoragePath,
                activeOutput.previewStoragePath,
                activeOutput.resultUrls?.[0]
              ) ?? undefined,
          });
        }
      }
    }

    visibleCardItems.forEach((card) => {
      if (!card.isImagePreview || !card.cardPreviewUrl) return;
      candidateIdSet.add(card.item.id);
      enqueueImageHydration(card.item.id, card.cardPreviewUrl, {
        priority: card.isPriorityHydration ? "high" : "normal",
        targetLongEdgePx: card.targetLongEdgePx,
        previewQualityBand: card.previewQualityBand,
        fallbackUrl:
          resolveFirstRenderableUrl(
            card.item.previewUrl,
            card.item.fullStoragePath,
            card.item.previewStoragePath,
            card.item.resultUrls?.[0]
          ) ?? undefined,
      });
    });

    curatedVisibleCardItems.forEach((card) => {
      if (!card.isImagePreview || !card.cardPreviewUrl) return;
      if (candidateIdSet.has(card.item.id)) return;
      candidateIdSet.add(card.item.id);
      enqueueImageHydration(card.item.id, card.cardPreviewUrl, {
        priority: card.isPriorityHydration ? "high" : "normal",
        targetLongEdgePx: card.targetLongEdgePx,
        previewQualityBand: card.previewQualityBand,
        fallbackUrl:
          resolveFirstRenderableUrl(
            card.item.previewUrl,
            card.item.fullStoragePath,
            card.item.previewStoragePath,
            card.item.resultUrls?.[0]
          ) ?? undefined,
      });
    });

    nearViewportOutputs.forEach((item) => {
      if (candidateIdSet.has(item.id)) return;
      const resolved = resolveReferenceCardUrls(item, {
        strictPreviewLadder,
        adaptivePreviewQuality: adaptivePreviewRoutingEnabled,
        pressureLevel: previewQualityPressureLevel,
        surface: "reference-grid",
        cardLongEdgePx: Math.max(240, Math.round(Math.max(1, virtualRowHeight - 3))),
        devicePixelRatio: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
      });
      const previewUrl = resolved.previewUrl ?? resolved.fullUrl;
      if (!previewUrl || isOutputVideoPreview(item, previewUrl)) return;
      candidateIdSet.add(item.id);
      enqueueImageHydration(item.id, previewUrl, {
        priority: "low",
        targetLongEdgePx: resolved.targetLongEdgePx,
        previewQualityBand: resolved.previewQualityBand,
        fallbackUrl:
          resolveFirstRenderableUrl(
            resolved.fullUrl,
            item.previewUrl,
            item.fullStoragePath,
            item.previewStoragePath,
            item.resultUrls?.[0]
          ) ?? undefined,
      });
    });

    nearViewportCuratedOutputs.forEach((item) => {
      if (candidateIdSet.has(item.id)) return;
      const resolved = resolveReferenceCardUrls(item, {
        strictPreviewLadder,
        adaptivePreviewQuality: adaptivePreviewRoutingEnabled,
        pressureLevel: previewQualityPressureLevel,
        surface: quickSlotAdaptiveSurfaceEnabled ? "quick-slot" : "reference-grid",
        cardLongEdgePx: Math.max(200, Math.round(Math.max(1, curatedVirtualRowHeight - 3))),
        devicePixelRatio: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
      });
      const previewUrl = resolved.previewUrl ?? resolved.fullUrl;
      if (!previewUrl || isOutputVideoPreview(item, previewUrl)) return;
      candidateIdSet.add(item.id);
      enqueueImageHydration(item.id, previewUrl, {
        priority: "low",
        targetLongEdgePx: resolved.targetLongEdgePx,
        previewQualityBand: resolved.previewQualityBand,
        fallbackUrl:
          resolveFirstRenderableUrl(
            resolved.fullUrl,
            item.previewUrl,
            item.fullStoragePath,
            item.previewStoragePath,
            item.resultUrls?.[0]
          ) ?? undefined,
      });
    });

    pruneHydrationQueueToCandidateIds(candidateIdSet);
  }, [
    activeOutputId,
    adaptivePreviewRoutingEnabled,
    curatedVirtualRowHeight,
    curatedVisibleCardItems,
    decodeBudgetEnabled,
    enqueueImageHydration,
    nearViewportCuratedOutputs,
    nearViewportOutputs,
    outputs,
    previewQualityPressureLevel,
    pruneHydrationQueueToCandidateIds,
    quickSlotAdaptiveSurfaceEnabled,
    strictPreviewLadder,
    virtualRowHeight,
    visibleCardItems,
  ]);
};
