/**
 * Card-items derivation controller for Reference Grid.
 * Resolves card URLs and hydration-aware image sources for visible card rows.
 */
import { useCallback, useMemo } from "react";
import type {
  ReferenceGridMediaAuthorityTier,
  ReferenceGridPreviewQualityBand,
} from "../../logic/referenceGridMedia";
import type { StudioOutput } from "../../types";
import {
  hasAdaptiveQueryParams,
  isNextOptimizerUrl,
  normalizeComparableUrl,
  resolveOptimizerSourceUrl,
} from "../logic/referenceGridMediaHelpers";
import type { ReferenceGridResolvedCardMedia } from "./useReferenceGridResolvedMediaController";

export type ReferenceGridVisibleCardItem = {
  item: StudioOutput;
  surface: "all-refs" | "curated";
  mediaSurface: "reference-grid" | "quick-slot";
  authorityTier: ReferenceGridMediaAuthorityTier;
  cardPreviewUrl: string | null;
  fallbackUrl: string | null;
  previewQualityBand: ReferenceGridPreviewQualityBand;
  targetLongEdgePx: number;
  isVideoPreview: boolean;
  isImagePreview: boolean;
  isPriorityHydration: boolean;
  imageSrc?: string;
};

type UseReferenceGridCardItemsControllerArgs = {
  activeOutputId: string | null;
  decodeBudgetEnabled: boolean;
  visibleOutputs: StudioOutput[];
  visibleCuratedOutputs: StudioOutput[];
  visibleQuickSlotIdSet: Set<string>;
  hydrationPriorityCount: number;
  curatedHydrationPriorityCount: number;
  virtualRowHeight: number;
  curatedVirtualRowHeight: number;
  quickSlotAdaptiveSurfaceEnabled: boolean;
  resolveCardMedia: (args: {
    item: StudioOutput;
    mediaSurface: "reference-grid" | "quick-slot";
    cardLongEdgePx: number;
  }) => ReferenceGridResolvedCardMedia;
  hydratedById: Record<
    string,
    {
      sourceUrl: string;
      renderUrl: string;
    }
  >;
};

type UseReferenceGridCardItemsControllerResult = {
  visibleCardItems: ReferenceGridVisibleCardItem[];
  curatedVisibleCardItems: ReferenceGridVisibleCardItem[];
  allVisibleCardItems: ReferenceGridVisibleCardItem[];
  transformedAdaptivePreviewCount: number;
};

/**
 * Builds card-item projections used by rendering, loading visuals, telemetry, and hydration queueing.
 */
export const useReferenceGridCardItemsController = ({
  activeOutputId,
  decodeBudgetEnabled,
  visibleOutputs,
  visibleCuratedOutputs,
  visibleQuickSlotIdSet,
  hydrationPriorityCount,
  curatedHydrationPriorityCount,
  virtualRowHeight,
  curatedVirtualRowHeight,
  quickSlotAdaptiveSurfaceEnabled,
  resolveCardMedia,
  hydratedById,
}: UseReferenceGridCardItemsControllerArgs): UseReferenceGridCardItemsControllerResult => {
  const buildVisibleCardItems = useCallback(
    (
      rows: StudioOutput[],
      priorityCount: number,
      options: {
        mediaSurface: "reference-grid" | "quick-slot";
        visualSurface: "all-refs" | "curated";
        cardLongEdgePx: number;
      }
    ) =>
      rows.map((item, visibleIndex) => {
        const shouldPreferCuratedSurface =
          options.visualSurface === "all-refs" && visibleQuickSlotIdSet.has(item.id);
        const resolvedMedia = resolveCardMedia({
          item,
          mediaSurface: options.mediaSurface,
          cardLongEdgePx: options.cardLongEdgePx,
        });
        const isPriorityHydration =
          !shouldPreferCuratedSurface &&
          (visibleIndex < priorityCount || activeOutputId === item.id);
        const hydratedEntry = hydratedById[item.id];
        const normalizedCardPreviewUrl = normalizeComparableUrl(resolvedMedia.previewUrl);
        const normalizedHydratedSourceUrl = normalizeComparableUrl(hydratedEntry?.sourceUrl);
        const normalizedFallbackSourceUrl = resolvedMedia.normalizedFallbackUrl;
        const cardOptimizerSourceUrl = resolvedMedia.previewOptimizerSourceUrl;
        const hydratedOptimizerSourceUrl = resolveOptimizerSourceUrl(hydratedEntry?.sourceUrl);
        const hasHydratedSourceForCard =
          Boolean(hydratedEntry) &&
          (normalizedHydratedSourceUrl === normalizedCardPreviewUrl ||
            (cardOptimizerSourceUrl != null &&
              hydratedOptimizerSourceUrl != null &&
              cardOptimizerSourceUrl === hydratedOptimizerSourceUrl) ||
            (cardOptimizerSourceUrl != null &&
              normalizedHydratedSourceUrl != null &&
              cardOptimizerSourceUrl === normalizedHydratedSourceUrl) ||
            (hydratedOptimizerSourceUrl != null &&
              normalizedCardPreviewUrl != null &&
              hydratedOptimizerSourceUrl === normalizedCardPreviewUrl) ||
            (normalizedFallbackSourceUrl != null &&
              (normalizedHydratedSourceUrl === normalizedFallbackSourceUrl ||
                cardOptimizerSourceUrl === normalizedFallbackSourceUrl ||
                hydratedOptimizerSourceUrl === normalizedFallbackSourceUrl)));
        const imageSrc =
          resolvedMedia.isImagePreview && decodeBudgetEnabled
            ? hasHydratedSourceForCard
              ? (hydratedEntry.renderUrl ?? undefined)
              : (resolvedMedia.fallbackUrl ?? resolvedMedia.previewUrl ?? undefined)
            : (resolvedMedia.previewUrl ?? undefined);
        return {
          item,
          surface: options.visualSurface,
          mediaSurface: options.mediaSurface,
          authorityTier: resolvedMedia.authorityTier,
          cardPreviewUrl: resolvedMedia.previewUrl,
          fallbackUrl: resolvedMedia.fallbackUrl,
          previewQualityBand: resolvedMedia.previewQualityBand,
          targetLongEdgePx: resolvedMedia.targetLongEdgePx,
          isVideoPreview: resolvedMedia.isVideoPreview,
          isImagePreview: resolvedMedia.isImagePreview,
          isPriorityHydration,
          imageSrc,
        };
      }),
    [activeOutputId, decodeBudgetEnabled, hydratedById, resolveCardMedia, visibleQuickSlotIdSet]
  );

  const visibleCardItems = useMemo(
    () =>
      buildVisibleCardItems(visibleOutputs, hydrationPriorityCount, {
        mediaSurface: "reference-grid",
        visualSurface: "all-refs",
        cardLongEdgePx: Math.max(240, Math.round(Math.max(1, virtualRowHeight - 3))),
      }),
    [buildVisibleCardItems, hydrationPriorityCount, virtualRowHeight, visibleOutputs]
  );

  const curatedVisibleCardItems = useMemo(
    () =>
      buildVisibleCardItems(visibleCuratedOutputs, curatedHydrationPriorityCount, {
        mediaSurface: quickSlotAdaptiveSurfaceEnabled ? "quick-slot" : "reference-grid",
        visualSurface: "curated",
        cardLongEdgePx: Math.max(200, Math.round(Math.max(1, curatedVirtualRowHeight - 3))),
      }),
    [
      buildVisibleCardItems,
      curatedHydrationPriorityCount,
      curatedVirtualRowHeight,
      quickSlotAdaptiveSurfaceEnabled,
      visibleCuratedOutputs,
    ]
  );

  const allVisibleCardItems = useMemo(
    () => [...curatedVisibleCardItems, ...visibleCardItems],
    [curatedVisibleCardItems, visibleCardItems]
  );

  const transformedAdaptivePreviewCount = useMemo(() => {
    let count = 0;
    visibleCardItems.forEach((card) => {
      const url = card.cardPreviewUrl;
      if (!url) return;
      if (hasAdaptiveQueryParams(url) || isNextOptimizerUrl(url)) {
        count += 1;
        return;
      }
      const hydratedEntry = hydratedById[card.item.id];
      if (!hydratedEntry) return;
      if (hydratedEntry.sourceUrl !== url) return;
      if (hydratedEntry.renderUrl === hydratedEntry.sourceUrl) return;
      if (!hydratedEntry.renderUrl.startsWith("blob:")) return;
      count += 1;
    });
    return count;
  }, [hydratedById, visibleCardItems]);

  return {
    visibleCardItems,
    curatedVisibleCardItems,
    allVisibleCardItems,
    transformedAdaptivePreviewCount,
  };
};
