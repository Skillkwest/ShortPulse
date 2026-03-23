/**
 * Card-items derivation controller for Reference Grid.
 * Resolves card URLs and hydration-aware image sources for visible card rows.
 */
import { useCallback, useMemo } from "react";
import {
  resolveReferenceCardUrls,
  type ReferenceGridPreviewQualityBand,
} from "../../logic/referenceGridMedia";
import type { StudioOutput } from "../../types";
import {
  hasAdaptiveQueryParams,
  isNextOptimizerUrl,
  isOutputVideoPreview,
  normalizeComparableUrl,
  resolveFirstRenderableUrl,
  resolveOptimizerSourceUrl,
} from "../logic/referenceGridMediaHelpers";

export type ReferenceGridVisibleCardItem = {
  item: StudioOutput;
  cardPreviewUrl: string | null;
  previewQualityBand: ReferenceGridPreviewQualityBand;
  targetLongEdgePx: number;
  isVideoPreview: boolean;
  isImagePreview: boolean;
  isPriorityHydration: boolean;
  imageSrc?: string;
};

type UseReferenceGridCardItemsControllerArgs = {
  activeOutputId: string | null;
  previewQualityPressureLevel: 0 | 1 | 2;
  strictPreviewLadder: boolean;
  adaptivePreviewRoutingEnabled: boolean;
  decodeBudgetEnabled: boolean;
  visibleOutputs: StudioOutput[];
  visibleCuratedOutputs: StudioOutput[];
  hydrationPriorityCount: number;
  curatedHydrationPriorityCount: number;
  virtualRowHeight: number;
  curatedVirtualRowHeight: number;
  quickSlotAdaptiveSurfaceEnabled: boolean;
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
  previewQualityPressureLevel,
  strictPreviewLadder,
  adaptivePreviewRoutingEnabled,
  decodeBudgetEnabled,
  visibleOutputs,
  visibleCuratedOutputs,
  hydrationPriorityCount,
  curatedHydrationPriorityCount,
  virtualRowHeight,
  curatedVirtualRowHeight,
  quickSlotAdaptiveSurfaceEnabled,
  hydratedById,
}: UseReferenceGridCardItemsControllerArgs): UseReferenceGridCardItemsControllerResult => {
  const buildVisibleCardItems = useCallback(
    (
      rows: StudioOutput[],
      priorityCount: number,
      options: { surface: "reference-grid" | "quick-slot"; cardLongEdgePx: number }
    ) =>
      rows.map((item, visibleIndex) => {
        const resolvedCardUrls = resolveReferenceCardUrls(item, {
          strictPreviewLadder,
          adaptivePreviewQuality: adaptivePreviewRoutingEnabled,
          pressureLevel: previewQualityPressureLevel,
          surface: options.surface,
          cardLongEdgePx: options.cardLongEdgePx,
          devicePixelRatio: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
        });
        const cardPreviewUrl = resolvedCardUrls.previewUrl ?? resolvedCardUrls.fullUrl;
        const isVideoPreview = isOutputVideoPreview(item, cardPreviewUrl);
        const isImagePreview = cardPreviewUrl ? !isVideoPreview : false;
        const isPriorityHydration = visibleIndex < priorityCount || activeOutputId === item.id;
        const hydratedEntry = hydratedById[item.id];
        const fallbackSourceForCard = resolveFirstRenderableUrl(
          resolvedCardUrls.fullUrl ?? null,
          item.previewUrl ?? null,
          item.fullStoragePath ?? null,
          item.previewStoragePath ?? null,
          item.resultUrls?.[0] ?? null
        );
        const normalizedCardPreviewUrl = normalizeComparableUrl(cardPreviewUrl);
        const normalizedHydratedSourceUrl = normalizeComparableUrl(hydratedEntry?.sourceUrl);
        const normalizedFallbackSourceUrl = normalizeComparableUrl(fallbackSourceForCard);
        const cardOptimizerSourceUrl = resolveOptimizerSourceUrl(cardPreviewUrl);
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
          isImagePreview && decodeBudgetEnabled
            ? hasHydratedSourceForCard
              ? (hydratedEntry.renderUrl ?? undefined)
              : ((fallbackSourceForCard ?? cardPreviewUrl) ?? undefined)
            : (cardPreviewUrl ?? undefined);
        return {
          item,
          cardPreviewUrl,
          previewQualityBand: resolvedCardUrls.previewQualityBand ?? "high",
          targetLongEdgePx: resolvedCardUrls.targetLongEdgePx ?? 960,
          isVideoPreview,
          isImagePreview,
          isPriorityHydration,
          imageSrc,
        };
      }),
    [
      activeOutputId,
      adaptivePreviewRoutingEnabled,
      decodeBudgetEnabled,
      hydratedById,
      previewQualityPressureLevel,
      strictPreviewLadder,
    ]
  );

  const visibleCardItems = useMemo(
    () =>
      buildVisibleCardItems(visibleOutputs, hydrationPriorityCount, {
        surface: "reference-grid",
        cardLongEdgePx: Math.max(240, Math.round(Math.max(1, virtualRowHeight - 3))),
      }),
    [buildVisibleCardItems, hydrationPriorityCount, virtualRowHeight, visibleOutputs]
  );

  const curatedVisibleCardItems = useMemo(
    () =>
      buildVisibleCardItems(visibleCuratedOutputs, curatedHydrationPriorityCount, {
        surface: quickSlotAdaptiveSurfaceEnabled ? "quick-slot" : "reference-grid",
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
