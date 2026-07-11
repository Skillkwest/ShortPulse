/**
 * Shared resolved-media controller for Reference Grid.
 * Centralizes preview/full/fallback URL derivation so card rendering and hydration
 * scheduling reuse the same media policy decisions.
 */
import { useCallback, useRef } from "react";
import {
  resolveReferenceCardUrls,
  resolveStudioOutputMediaDisplayAuthority,
  type ReferenceGridMediaAuthorityTier,
  type ReferenceGridPreviewQualityBand,
} from "../../logic/referenceGridMedia";
import { isGeneratedOutput } from "../../logic/referenceOutputAuthority";
import { asCanonicalStoragePath } from "../../../../lib/adaptive-media";
import type { ReferenceGridMediaOutput } from "../logic/referenceGridMediaOutput";
import {
  applySignedMediaAuthorityToReferenceGridMediaOutput,
  applySignedStorageUrlsToReferenceGridMediaOutput,
} from "./useReferenceGridSignedStorageUrlController";
import type { SessionSignedMediaRestoreAuthority } from "../../logic/sessionRestoreMediaSigning";
import {
  isOutputAudioPreview,
  isOutputVideoPreview,
  normalizeComparableUrl,
  resolveFirstRenderableUrl,
  resolveOptimizerSourceUrl,
} from "../logic/referenceGridMediaHelpers";
import { firstPlayableCandidate } from "../../logic/referenceGridMediaCandidates";

export type ReferenceGridResolvedCardMedia = {
  previewUrl: string | null;
  fullUrl: string | null;
  posterPreviewUrl: string | null;
  companionArtUrl: string | null;
  playableMediaUrl: string | null;
  cardPlayablePreviewUrl: string | null;
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
  signedMediaAuthorityByMediaId?: ReadonlyMap<string, SessionSignedMediaRestoreAuthority>;
};

type ResolveReferenceGridCardMediaArgs = {
  item: ReferenceGridMediaOutput;
  mediaSurface: "reference-grid" | "quick-slot";
  cardLongEdgePx: number;
};

export const REFERENCE_GRID_RESOLVED_MEDIA_CACHE_ENTRY_LIMIT = 512;

const getResolvedMediaCacheKey = ({
  item,
  mediaSurface,
  cardLongEdgePx,
  previewQualityPressureLevel,
  strictPreviewLadder,
  adaptivePreviewRoutingEnabled,
  devicePixelRatio,
  signedStorageUrlByPath,
  signedMediaAuthorityByMediaId,
}: ResolveReferenceGridCardMediaArgs & {
  previewQualityPressureLevel: 0 | 1 | 2;
  strictPreviewLadder: boolean;
  adaptivePreviewRoutingEnabled: boolean;
  devicePixelRatio: number;
  signedStorageUrlByPath?: ReadonlyMap<string, string>;
  signedMediaAuthorityByMediaId?: ReadonlyMap<string, SessionSignedMediaRestoreAuthority>;
}): string => {
  const signedStorageKey = [
    item.previewStoragePath,
    item.previewPosterStoragePath,
    item.companionArtStoragePath,
    item.fullStoragePath,
    ...(item.resultUrls ?? []),
  ]
    .map((value) => {
      const path = asCanonicalStoragePath(value);
      return path ? (signedStorageUrlByPath?.get(path) ?? "") : "";
    })
    .join("||");
  const signedMediaAuthority = item.savedMediaIds
    ?.map((mediaId) => {
      const authority = signedMediaAuthorityByMediaId?.get(mediaId);
      return authority
        ? [
            mediaId,
            authority.signedPreviewUrl ?? "",
            authority.signedFullUrl ?? "",
            authority.signedPreviewPosterUrl ?? "",
          ].join("|")
        : "";
    })
    .join("||");
  return [
    item.id,
    item.mode ?? "",
    item.previewStoragePath ?? "",
    item.previewPosterStoragePath ?? "",
    item.companionArtStoragePath ?? "",
    item.companionArtUrl ?? "",
    item.fullStoragePath ?? "",
    item.previewUrl ?? "",
    item.previewPosterUrl ?? "",
    item.resultUrls?.[0] ?? "",
    item.mediaSource ?? "",
    item.generationId ?? "",
    item.savedMediaIds?.[0] ?? "",
    signedStorageKey,
    signedMediaAuthority ?? "",
    mediaSurface,
    cardLongEdgePx,
    previewQualityPressureLevel,
    strictPreviewLadder ? "strict" : "relaxed",
    adaptivePreviewRoutingEnabled ? "adaptive" : "direct",
    devicePixelRatio,
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
  signedMediaAuthorityByMediaId,
}: UseReferenceGridResolvedMediaControllerArgs) => {
  const devicePixelRatio = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const cacheRef = useRef(new Map<string, ReferenceGridResolvedCardMedia>());

  const resolveCardMedia = useCallback(
    ({ item, mediaSurface, cardLongEdgePx }: ResolveReferenceGridCardMediaArgs) => {
      const cacheKey = getResolvedMediaCacheKey({
        item,
        mediaSurface,
        cardLongEdgePx,
        previewQualityPressureLevel,
        strictPreviewLadder,
        adaptivePreviewRoutingEnabled,
        devicePixelRatio,
        signedStorageUrlByPath,
        signedMediaAuthorityByMediaId,
      });
      const cached = cacheRef.current.get(cacheKey);
      if (cached) {
        cacheRef.current.delete(cacheKey);
        cacheRef.current.set(cacheKey, cached);
        return cached;
      }

      const storageSignedMediaItem =
        signedStorageUrlByPath && signedStorageUrlByPath.size > 0
          ? applySignedStorageUrlsToReferenceGridMediaOutput(item, signedStorageUrlByPath)
          : item;
      const mediaItem =
        signedMediaAuthorityByMediaId && signedMediaAuthorityByMediaId.size > 0
          ? applySignedMediaAuthorityToReferenceGridMediaOutput(
              storageSignedMediaItem,
              signedMediaAuthorityByMediaId
            )
          : storageSignedMediaItem;
      const resolvedCardUrls = resolveReferenceCardUrls(mediaItem, {
        strictPreviewLadder,
        adaptivePreviewQuality: adaptivePreviewRoutingEnabled,
        pressureLevel: previewQualityPressureLevel,
        surface: mediaSurface,
        cardLongEdgePx,
        devicePixelRatio,
      });
      const displayAuthority = resolveStudioOutputMediaDisplayAuthority(mediaItem, {
        strictPreviewLadder,
        adaptivePreviewQuality: adaptivePreviewRoutingEnabled,
        pressureLevel: previewQualityPressureLevel,
        surface: mediaSurface,
        cardLongEdgePx,
        devicePixelRatio,
      });
      const shouldPreferKindAwareDisplay = mediaItem.mode === "video" || mediaItem.mode === "audio";
      const previewUrl = shouldPreferKindAwareDisplay
        ? (displayAuthority.cardDisplayUrl ??
          resolvedCardUrls.previewUrl ??
          resolvedCardUrls.fullUrl)
        : (resolvedCardUrls.previewUrl ??
          displayAuthority.cardDisplayUrl ??
          resolvedCardUrls.fullUrl);
      const fullUrl = shouldPreferKindAwareDisplay
        ? displayAuthority.fullMediaUrl && displayAuthority.fullMediaUrl !== previewUrl
          ? displayAuthority.fullMediaUrl
          : resolvedCardUrls.fullUrl && resolvedCardUrls.fullUrl !== resolvedCardUrls.previewUrl
            ? resolvedCardUrls.fullUrl
            : null
        : resolvedCardUrls.fullUrl && resolvedCardUrls.fullUrl !== resolvedCardUrls.previewUrl
          ? resolvedCardUrls.fullUrl
          : displayAuthority.fullMediaUrl && displayAuthority.fullMediaUrl !== previewUrl
            ? displayAuthority.fullMediaUrl
            : null;
      const posterPreviewUrl = displayAuthority.posterPreviewUrl;
      const companionArtUrl = mediaItem.companionArtUrl?.trim() || null;
      const playableMediaUrl = displayAuthority.playableMediaUrl;
      const cardPlayablePreviewCandidate =
        mediaItem.mode === "video"
          ? firstPlayableCandidate("video", mediaItem.previewUrl, resolvedCardUrls.previewUrl)
          : null;
      const cardPlayablePreviewUrl =
        cardPlayablePreviewCandidate &&
        normalizeComparableUrl(cardPlayablePreviewCandidate) !==
          normalizeComparableUrl(playableMediaUrl)
          ? cardPlayablePreviewCandidate
          : null;
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
      const isVideoPreview = isOutputVideoPreview(mediaItem, playableMediaUrl ?? previewUrl);
      const isAudioPreview = isOutputAudioPreview(mediaItem, playableMediaUrl ?? previewUrl);

      const resolvedMedia: ReferenceGridResolvedCardMedia = {
        previewUrl,
        fullUrl,
        posterPreviewUrl,
        companionArtUrl,
        playableMediaUrl,
        cardPlayablePreviewUrl,
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
      while (cacheRef.current.size > REFERENCE_GRID_RESOLVED_MEDIA_CACHE_ENTRY_LIMIT) {
        const oldestCacheKey = cacheRef.current.keys().next().value;
        if (oldestCacheKey === undefined) break;
        cacheRef.current.delete(oldestCacheKey);
      }
      return resolvedMedia;
    },
    [
      adaptivePreviewRoutingEnabled,
      devicePixelRatio,
      previewQualityPressureLevel,
      signedMediaAuthorityByMediaId,
      signedStorageUrlByPath,
      strictPreviewLadder,
    ]
  );

  return {
    resolveCardMedia,
  };
};
