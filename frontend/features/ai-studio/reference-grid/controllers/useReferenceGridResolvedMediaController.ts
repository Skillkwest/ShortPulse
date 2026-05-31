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
import { asCanonicalStoragePath } from "../../../../lib/adaptive-media";
import type { ReferenceGridMediaOutput } from "../logic/referenceGridMediaOutput";
import { applySignedStorageUrlsToReferenceGridMediaOutput } from "./useReferenceGridSignedStorageUrlController";
import {
  isOutputAudioPreview,
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
  isAudioPreview?: boolean;
  normalizedPreviewUrl: string | null;
  normalizedFallbackUrl: string | null;
  previewOptimizerSourceUrl: string | null;
};

type UseReferenceGridResolvedMediaControllerArgs = {
  previewQualityPressureLevel: 0 | 1 | 2;
  strictPreviewLadder: boolean;
  adaptivePreviewRoutingEnabled: boolean;
  signedStorageUrlByPath?: ReadonlyMap<string, string>;
};

type ResolveReferenceGridCardMediaArgs = {
  item: ReferenceGridMediaOutput;
  mediaSurface: "reference-grid" | "quick-slot";
  cardLongEdgePx: number;
};

const getResolvedMediaCacheKey = ({
  item,
  mediaSurface,
  cardLongEdgePx,
  signedStorageUrlByPath,
}: ResolveReferenceGridCardMediaArgs & {
  signedStorageUrlByPath?: ReadonlyMap<string, string>;
}): string => {
  const signedStorageKey = [
    item.previewStoragePath,
    item.previewPosterStoragePath,
    item.fullStoragePath,
    ...(item.resultUrls ?? []),
  ]
    .map((value) => {
      const path = asCanonicalStoragePath(value);
      return path ? (signedStorageUrlByPath?.get(path) ?? "") : "";
    })
    .join("||");
  return [
    item.id,
    item.mode ?? "",
    item.previewStoragePath ?? "",
    item.previewPosterStoragePath ?? "",
    item.fullStoragePath ?? "",
    item.previewUrl ?? "",
    item.previewPosterUrl ?? "",
    item.resultUrls?.[0] ?? "",
    item.mediaSource ?? "",
    item.generationId ?? "",
    item.savedMediaIds?.[0] ?? "",
    signedStorageKey,
    mediaSurface,
    cardLongEdgePx,
  ].join("::");
};

/**
 * Returns a memoized card-media resolver that caches repeated output/surface derivations.
 */
export const useReferenceGridResolvedMediaController = ({
  previewQualityPressureLevel,
  strictPreviewLadder,
  adaptivePreviewRoutingEnabled,
  signedStorageUrlByPath,
}: UseReferenceGridResolvedMediaControllerArgs) => {
  const devicePixelRatio = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const cacheRef = useRef(new Map<string, ReferenceGridResolvedCardMedia>());

  useEffect(() => {
    cacheRef.current.clear();
  }, [
    adaptivePreviewRoutingEnabled,
    devicePixelRatio,
    previewQualityPressureLevel,
    signedStorageUrlByPath,
    strictPreviewLadder,
  ]);

  const resolveCardMedia = useCallback(
    ({ item, mediaSurface, cardLongEdgePx }: ResolveReferenceGridCardMediaArgs) => {
      const cacheKey = getResolvedMediaCacheKey({
        item,
        mediaSurface,
        cardLongEdgePx,
        signedStorageUrlByPath,
      });
      const cached = cacheRef.current.get(cacheKey);
      if (cached) {
        return cached;
      }

      const mediaItem =
        signedStorageUrlByPath && signedStorageUrlByPath.size > 0
          ? applySignedStorageUrlsToReferenceGridMediaOutput(item, signedStorageUrlByPath)
          : item;
      const resolvedCardUrls = resolveReferenceCardUrls(mediaItem, {
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
              mediaItem.previewUrl ?? null,
              mediaItem.resultUrls?.[0] ?? null
            ) ?? null)
          : (resolveFirstRenderableUrl(
              resolvedCardUrls.fullUrl ?? null,
              resolvedCardUrls.previewUrl ?? null
            ) ?? null);
      const isVideoPreview = isOutputVideoPreview(mediaItem, previewUrl);
      const isAudioPreview = isOutputAudioPreview(mediaItem, previewUrl);

      const resolvedMedia: ReferenceGridResolvedCardMedia = {
        previewUrl,
        fullUrl,
        fallbackUrl,
        authorityTier: resolvedCardUrls.authorityTier,
        previewQualityBand: resolvedCardUrls.previewQualityBand ?? "high",
        targetLongEdgePx: resolvedCardUrls.targetLongEdgePx ?? 960,
        isVideoPreview,
        isAudioPreview,
        isImagePreview: previewUrl ? !isVideoPreview && !isAudioPreview : false,
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
      signedStorageUrlByPath,
      strictPreviewLadder,
    ]
  );

  return {
    resolveCardMedia,
  };
};
