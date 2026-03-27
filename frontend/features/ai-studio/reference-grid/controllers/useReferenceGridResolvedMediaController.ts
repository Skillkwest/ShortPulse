/**
 * Shared resolved-media controller for Reference Grid.
 * Centralizes preview/full/fallback URL derivation so card rendering and hydration
 * scheduling reuse the same media policy decisions.
 */
import { useCallback, useEffect, useRef } from "react";
import {
  resolveReferenceCardUrls,
  type ReferenceGridMediaAuthorityTier,
  type ReferenceGridPreviewQualityBand,
} from "../../logic/referenceGridMedia";
import { isGeneratedOutput } from "../../logic/referenceOutputAuthority";
import type { StudioOutput } from "../../types";
import {
  isOutputVideoPreview,
  normalizeComparableUrl,
  resolveFirstRenderableUrl,
  resolveOptimizerSourceUrl,
} from "../logic/referenceGridMediaHelpers";

export type ReferenceGridResolvedCardMedia = {
  previewUrl: string | null;
  fullUrl: string | null;
  fallbackUrl: string | null;
  authorityTier: ReferenceGridMediaAuthorityTier;
  previewQualityBand: ReferenceGridPreviewQualityBand;
  targetLongEdgePx: number;
  isVideoPreview: boolean;
  isImagePreview: boolean;
  normalizedPreviewUrl: string | null;
  normalizedFallbackUrl: string | null;
  previewOptimizerSourceUrl: string | null;
};

type UseReferenceGridResolvedMediaControllerArgs = {
  previewQualityPressureLevel: 0 | 1 | 2;
  strictPreviewLadder: boolean;
  adaptivePreviewRoutingEnabled: boolean;
};

type ResolveReferenceGridCardMediaArgs = {
  item: StudioOutput;
  mediaSurface: "reference-grid" | "quick-slot";
  cardLongEdgePx: number;
};

const getResolvedMediaCacheKey = ({
  item,
  mediaSurface,
  cardLongEdgePx,
}: ResolveReferenceGridCardMediaArgs): string =>
  [
    item.id,
    item.mode ?? "",
    item.previewStoragePath ?? "",
    item.fullStoragePath ?? "",
    item.previewUrl ?? "",
    item.resultUrls?.[0] ?? "",
    item.mediaSource ?? "",
    item.generationId ?? "",
    item.savedMediaIds?.[0] ?? "",
    mediaSurface,
    cardLongEdgePx,
  ].join("::");

/**
 * Returns a memoized card-media resolver that caches repeated output/surface derivations.
 */
export const useReferenceGridResolvedMediaController = ({
  previewQualityPressureLevel,
  strictPreviewLadder,
  adaptivePreviewRoutingEnabled,
}: UseReferenceGridResolvedMediaControllerArgs) => {
  const devicePixelRatio = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const cacheRef = useRef(new Map<string, ReferenceGridResolvedCardMedia>());

  useEffect(() => {
    cacheRef.current.clear();
  }, [
    adaptivePreviewRoutingEnabled,
    devicePixelRatio,
    previewQualityPressureLevel,
    strictPreviewLadder,
  ]);

  const resolveCardMedia = useCallback(
    ({ item, mediaSurface, cardLongEdgePx }: ResolveReferenceGridCardMediaArgs) => {
      const cacheKey = getResolvedMediaCacheKey({
        item,
        mediaSurface,
        cardLongEdgePx,
      });
      const cached = cacheRef.current.get(cacheKey);
      if (cached) {
        return cached;
      }

      const resolvedCardUrls = resolveReferenceCardUrls(item, {
        strictPreviewLadder,
        adaptivePreviewQuality: adaptivePreviewRoutingEnabled,
        pressureLevel: previewQualityPressureLevel,
        surface: mediaSurface,
        cardLongEdgePx,
        devicePixelRatio,
      });
      const previewUrl = resolvedCardUrls.previewUrl ?? resolvedCardUrls.fullUrl;
      const fullUrl = resolvedCardUrls.fullUrl ?? null;
      const fallbackUrl =
        resolvedCardUrls.authorityTier === "preview-only" && isGeneratedOutput(item)
          ? (resolveFirstRenderableUrl(
              resolvedCardUrls.previewUrl ?? null,
              item.previewUrl ?? null,
              item.resultUrls?.[0] ?? null
            ) ?? null)
          : (resolveFirstRenderableUrl(
              resolvedCardUrls.fullUrl ?? null,
              item.previewUrl ?? null,
              item.fullStoragePath ?? null,
              item.previewStoragePath ?? null,
              item.resultUrls?.[0] ?? null
            ) ?? null);
      const isVideoPreview = isOutputVideoPreview(item, previewUrl);

      const resolvedMedia: ReferenceGridResolvedCardMedia = {
        previewUrl,
        fullUrl,
        fallbackUrl,
        authorityTier: resolvedCardUrls.authorityTier,
        previewQualityBand: resolvedCardUrls.previewQualityBand ?? "high",
        targetLongEdgePx: resolvedCardUrls.targetLongEdgePx ?? 960,
        isVideoPreview,
        isImagePreview: previewUrl ? !isVideoPreview : false,
        normalizedPreviewUrl: normalizeComparableUrl(previewUrl),
        normalizedFallbackUrl: normalizeComparableUrl(fallbackUrl),
        previewOptimizerSourceUrl: resolveOptimizerSourceUrl(previewUrl),
      };

      cacheRef.current.set(cacheKey, resolvedMedia);
      return resolvedMedia;
    },
    [
      adaptivePreviewRoutingEnabled,
      devicePixelRatio,
      previewQualityPressureLevel,
      strictPreviewLadder,
    ]
  );

  return {
    resolveCardMedia,
  };
};
