/**
 * Card-items derivation controller for Reference Grid.
 * Resolves card URLs, hydration-aware image sources, and loading-state sets for visible card rows.
 */
import { useCallback, useMemo } from "react";
import { asCanonicalStoragePath } from "../../../../lib/adaptive-media";
import type {
  ReferenceGridMediaAuthorityTier,
  ReferenceGridPreviewQualityBand,
} from "../../logic/referenceGridMedia";
import type { StudioOutput } from "../../types";
import type { ReferenceGridMediaOutput } from "../logic/referenceGridMediaOutput";
import { isReferenceGridPlaceholderOnlyMediaOutput } from "../logic/referenceGridMediaOutput";
import {
  hasAdaptiveQueryParams,
  isNextOptimizerUrl,
  normalizeComparableUrl,
  resolveOptimizerSourceUrl,
} from "../logic/referenceGridMediaHelpers";
import { classifyReferenceGridCardVisualState } from "../logic/referenceGridCardVisualState";
import type { ReferenceGridResolvedCardMedia } from "./useReferenceGridResolvedMediaController";
import {
  incrementFreezeInvestigationCounter,
  setFreezeInvestigationGauge,
} from "../../logic/freezeInvestigationTelemetry";

export type ReferenceGridVisibleCardItem = {
  item: ReferenceGridMediaOutput;
  surface: "all-refs" | "curated";
  mediaSurface: "reference-grid" | "quick-slot";
  authorityTier: ReferenceGridMediaAuthorityTier;
  cardPreviewUrl: string | null;
  videoPosterUrl?: string | null;
  audioBackgroundImageUrl?: string | null;
  playableMediaUrl?: string | null;
  cardPlayablePreviewUrl?: string | null;
  fallbackUrl: string | null;
  previewQualityBand: ReferenceGridPreviewQualityBand;
  targetLongEdgePx: number;
  isVideoPreview: boolean;
  isImagePreview: boolean;
  isAudioPreview?: boolean;
  isPriorityHydration: boolean;
  imageSrc?: string;
  dragDisplayArtifactUrl?: string;
  dragDisplayArtifactKind?: "blob" | "data" | "url";
  isPlaceholderOnly?: boolean;
};

type UseReferenceGridCardItemsControllerArgs = {
  activeOutputId: string | null;
  decodeBudgetEnabled: boolean;
  visibleOutputs: ReferenceGridMediaOutput[];
  visibleCuratedOutputs: ReferenceGridMediaOutput[];
  visibleQuickSlotIdSet: Set<string>;
  hydrationPriorityCount: number;
  curatedHydrationPriorityCount: number;
  virtualRowHeight: number;
  curatedVirtualRowHeight: number;
  quickSlotAdaptiveSurfaceEnabled: boolean;
  resolveCardMedia: (args: {
    item: ReferenceGridMediaOutput;
    mediaSurface: "reference-grid" | "quick-slot";
    cardLongEdgePx: number;
  }) => ReferenceGridResolvedCardMedia;
  visibleOutputById: Record<string, StudioOutput>;
  loadedMap: Record<string, boolean>;
  hydratedById: Record<
    string,
    {
      sourceUrl: string;
      renderUrl: string;
    }
  >;
  signingPendingStoragePathSet?: ReadonlySet<string>;
};

type UseReferenceGridCardItemsControllerResult = {
  visibleCardItems: ReferenceGridVisibleCardItem[];
  curatedVisibleCardItems: ReferenceGridVisibleCardItem[];
  allVisibleCardItems: ReferenceGridVisibleCardItem[];
  loadingCardIdSet: Set<string>;
  generationLoadingCardIdSet: Set<string>;
  hydrationLoadingCardIdSet: Set<string>;
  generationLoadingIdsLength: number;
  hydrationLoadingIdsLength: number;
  loadingIdsLength: number;
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
  visibleOutputById,
  loadedMap,
  hydratedById,
  signingPendingStoragePathSet,
}: UseReferenceGridCardItemsControllerArgs): UseReferenceGridCardItemsControllerResult => {
  incrementFreezeInvestigationCounter("referenceGrid.cardItems.recompute");
  setFreezeInvestigationGauge("referenceGrid.cardItems.visibleOutputsCount", visibleOutputs.length);
  setFreezeInvestigationGauge(
    "referenceGrid.cardItems.visibleCuratedOutputsCount",
    visibleCuratedOutputs.length
  );
  const buildVisibleCardItems = useCallback(
    (
      rows: ReferenceGridMediaOutput[],
      priorityCount: number,
      options: {
        mediaSurface: "reference-grid" | "quick-slot";
        visualSurface: "all-refs" | "curated";
        cardLongEdgePx: number;
      },
      resolvedMediaByQuickSlotId?: Map<string, ReferenceGridResolvedCardMedia>
    ) =>
      rows.map((item, visibleIndex) => {
        const shouldPreferCuratedSurface =
          options.visualSurface === "all-refs" && visibleQuickSlotIdSet.has(item.id);
        const isPlaceholderOnly = isReferenceGridPlaceholderOnlyMediaOutput(item);
        if (isPlaceholderOnly) {
          return {
            item,
            surface: options.visualSurface,
            mediaSurface: options.mediaSurface,
            authorityTier: "preview-only" as const,
            cardPreviewUrl: null,
            videoPosterUrl: null,
            audioBackgroundImageUrl: null,
            playableMediaUrl: null,
            cardPlayablePreviewUrl: null,
            fallbackUrl: null,
            previewQualityBand: "high" as const,
            targetLongEdgePx: options.cardLongEdgePx,
            isVideoPreview: false,
            isImagePreview: false,
            isAudioPreview: false,
            isPriorityHydration: false,
            imageSrc: undefined,
            isPlaceholderOnly: true,
          };
        }
        const cachedResolvedMedia = shouldPreferCuratedSurface
          ? resolvedMediaByQuickSlotId?.get(item.id)
          : undefined;
        const resolvedMedia =
          cachedResolvedMedia ??
          resolveCardMedia({
            item,
            mediaSurface: options.mediaSurface,
            cardLongEdgePx: options.cardLongEdgePx,
          });
        if (options.visualSurface === "curated") {
          resolvedMediaByQuickSlotId?.set(item.id, resolvedMedia);
        }
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
              : isPriorityHydration
                ? (resolvedMedia.previewUrl ?? resolvedMedia.fallbackUrl ?? undefined)
                : undefined
            : (resolvedMedia.previewUrl ?? undefined);
        const dragDisplayArtifactUrl = resolvedMedia.isImagePreview
          ? hasHydratedSourceForCard
            ? (hydratedEntry?.sourceUrl ??
              resolvedMedia.fallbackUrl ??
              resolvedMedia.previewUrl ??
              undefined)
            : (resolvedMedia.fallbackUrl ?? resolvedMedia.previewUrl ?? undefined)
          : undefined;
        const dragDisplayArtifactKind = dragDisplayArtifactUrl
          ? dragDisplayArtifactUrl.startsWith("blob:")
            ? ("blob" as const)
            : dragDisplayArtifactUrl.startsWith("data:")
              ? ("data" as const)
              : ("url" as const)
          : undefined;
        return {
          item,
          surface: options.visualSurface,
          mediaSurface: options.mediaSurface,
          authorityTier: resolvedMedia.authorityTier,
          cardPreviewUrl: resolvedMedia.previewUrl,
          videoPosterUrl: resolvedMedia.posterPreviewUrl,
          audioBackgroundImageUrl: resolvedMedia.companionArtUrl,
          playableMediaUrl: resolvedMedia.playableMediaUrl,
          cardPlayablePreviewUrl: resolvedMedia.cardPlayablePreviewUrl,
          fallbackUrl: resolvedMedia.fallbackUrl,
          previewQualityBand: resolvedMedia.previewQualityBand,
          targetLongEdgePx: resolvedMedia.targetLongEdgePx,
          isVideoPreview: resolvedMedia.isVideoPreview,
          isImagePreview: resolvedMedia.isImagePreview,
          isAudioPreview: resolvedMedia.isAudioPreview,
          isPriorityHydration,
          imageSrc,
          dragDisplayArtifactUrl,
          dragDisplayArtifactKind,
          isPlaceholderOnly: false,
        };
      }),
    [activeOutputId, decodeBudgetEnabled, hydratedById, resolveCardMedia, visibleQuickSlotIdSet]
  );

  const cardItems = useMemo(() => {
    const resolvedMediaByQuickSlotId = new Map<string, ReferenceGridResolvedCardMedia>();
    const curatedVisibleCardItems = buildVisibleCardItems(
      visibleCuratedOutputs,
      curatedHydrationPriorityCount,
      {
        mediaSurface: quickSlotAdaptiveSurfaceEnabled ? "quick-slot" : "reference-grid",
        visualSurface: "curated",
        cardLongEdgePx: Math.max(200, Math.round(Math.max(1, curatedVirtualRowHeight - 3))),
      },
      resolvedMediaByQuickSlotId
    );
    const visibleCardItems = buildVisibleCardItems(
      visibleOutputs,
      hydrationPriorityCount,
      {
        mediaSurface: "reference-grid",
        visualSurface: "all-refs",
        cardLongEdgePx: Math.max(240, Math.round(Math.max(1, virtualRowHeight - 3))),
      },
      resolvedMediaByQuickSlotId
    );
    return {
      curatedVisibleCardItems,
      visibleCardItems,
    };
  }, [
    buildVisibleCardItems,
    curatedHydrationPriorityCount,
    curatedVirtualRowHeight,
    hydrationPriorityCount,
    quickSlotAdaptiveSurfaceEnabled,
    virtualRowHeight,
    visibleCuratedOutputs,
    visibleOutputs,
  ]);
  const { visibleCardItems, curatedVisibleCardItems } = cardItems;

  const allVisibleCardItems = useMemo(
    () => [...curatedVisibleCardItems, ...visibleCardItems],
    [curatedVisibleCardItems, visibleCardItems]
  );
  const loadingState = useMemo(() => {
    const nextLoadingIds: string[] = [];
    const nextGenerationLoadingIds: string[] = [];
    const nextHydrationLoadingIds: string[] = [];
    allVisibleCardItems.forEach((card) => {
      if (card.surface === "all-refs" && visibleQuickSlotIdSet.has(card.item.id)) return;
      const currentOutput = visibleOutputById[card.item.id];
      if (!currentOutput) return;
      const visualState = classifyReferenceGridCardVisualState({
        item: currentOutput,
        cardPreviewUrl: card.cardPreviewUrl,
        isLoaded: Boolean(loadedMap[card.item.id]),
        decodeBudgetEnabled,
        isImagePreview: card.isImagePreview,
        isPriorityHydration: card.isPriorityHydration,
        imageSrc: card.imageSrc,
        isStorageSigningPending: [
          currentOutput.previewStoragePath,
          currentOutput.previewPosterStoragePath,
          currentOutput.fullStoragePath,
          ...(currentOutput.resultUrls ?? []),
        ].some((value) => {
          const path = asCanonicalStoragePath(value);
          return path ? (signingPendingStoragePathSet?.has(path) ?? false) : false;
        }),
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
    signingPendingStoragePathSet,
    visibleOutputById,
    visibleQuickSlotIdSet,
  ]);
  const loadingCardIdSet = useMemo(() => new Set(loadingState.loadingIds), [loadingState]);
  const generationLoadingCardIdSet = useMemo(
    () => new Set(loadingState.generationLoadingIds),
    [loadingState]
  );
  const hydrationLoadingCardIdSet = useMemo(
    () => new Set(loadingState.hydrationLoadingIds),
    [loadingState]
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
    loadingCardIdSet,
    generationLoadingCardIdSet,
    hydrationLoadingCardIdSet,
    generationLoadingIdsLength: loadingState.generationLoadingIds.length,
    hydrationLoadingIdsLength: loadingState.hydrationLoadingIds.length,
    loadingIdsLength: loadingState.loadingIds.length,
    transformedAdaptivePreviewCount,
  };
};
