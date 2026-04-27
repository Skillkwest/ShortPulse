/**
 * Reference-grid media delivery helpers.
 * Centralizes preview/full URL resolution so card rendering can prefer lightweight variants safely.
 */
import {
  isAdaptiveShadowCompareEnabled,
  isAdaptiveSurfaceEnabled,
  resolveAdaptiveMedia,
  resolveAdaptiveSourceKind,
  isRenderableAdaptiveUrl,
  asCanonicalStoragePath,
  logAdaptivePolicyApplied,
  logAdaptiveResolveMismatch,
  type AdaptiveSurface,
} from "../../../lib/adaptive-media";
import {
  isGeneratedOutput,
  resolveReferenceOutputAuthorityTier,
  type ReferenceOutputAuthorityTier,
} from "./referenceOutputAuthority";
import {
  applyAdaptivePreviewTransform,
  resolvePreviewQualityTarget,
  type ReferenceGridMediaKindHint,
  type ReferenceGridPreviewQualityBand,
} from "./referenceGridMediaAdaptivePreview";
import type { StudioOutput } from "../types";

type ReferenceMediaCandidate = string | null | undefined;
export type ReferenceGridMediaAuthorityTier = ReferenceOutputAuthorityTier;
export type { ReferenceGridPreviewQualityBand } from "./referenceGridMediaAdaptivePreview";

/**
 * Returns true when a media candidate is directly renderable by an `<img>`/`<video>` tag.
 */
export const isRenderableReferenceMediaUrl = (value: ReferenceMediaCandidate): value is string =>
  isRenderableAdaptiveUrl(value);

const normalizeRenderableUrl = (value: ReferenceMediaCandidate): string | null => {
  if (!isRenderableReferenceMediaUrl(value)) return null;
  return value.trim();
};

const hasDistinctDurablePreviewAsset = (
  output: Pick<StudioOutput, "previewStoragePath" | "fullStoragePath">
): boolean => {
  const previewPath = asCanonicalStoragePath(output.previewStoragePath);
  if (!previewPath) return false;
  const fullPath = asCanonicalStoragePath(output.fullStoragePath);
  if (previewPath.includes("/variants/")) return true;
  if (!fullPath) return true;
  return previewPath !== fullPath;
};

const resolveReferenceCardUrlsLegacy = (
  output: Pick<
    StudioOutput,
    | "previewStoragePath"
    | "fullStoragePath"
    | "previewUrl"
    | "resultUrls"
    | "mediaSource"
    | "generationId"
    | "savedMediaIds"
  > & { mode?: StudioOutput["mode"] | null },
  options?: {
    strictPreviewLadder?: boolean;
    pressureLevel?: number;
    cardLongEdgePx?: number | null;
    devicePixelRatio?: number;
    adaptivePreviewQuality?: boolean;
    surface?: AdaptiveSurface;
  }
) => {
  const authorityTier = resolveReferenceOutputAuthorityTier(output);
  const isPreviewOnlyGenerated = authorityTier === "preview-only" && isGeneratedOutput(output);
  const strictPreviewLadder = options?.strictPreviewLadder === true;
  const adaptivePreviewQuality = options?.adaptivePreviewQuality === true;
  const shouldApplyAdaptivePreviewQuality =
    adaptivePreviewQuality && !hasDistinctDurablePreviewAsset(output);
  const pressureLevel = options?.pressureLevel ?? 0;
  const mediaKindHint: ReferenceGridMediaKindHint =
    output.mode === "video"
      ? "video"
      : output.mode === "image"
        ? "image"
        : output.mode === "audio"
          ? "audio"
          : null;
  const { qualityBand, targetLongEdgePx } = resolvePreviewQualityTarget({
    pressureLevel,
    surface: options?.surface ?? "reference-grid",
    cardLongEdgePx: options?.cardLongEdgePx ?? null,
    devicePixelRatio: options?.devicePixelRatio ?? 1,
  });
  const previewStorageUrl = normalizeRenderableUrl(output.previewStoragePath);
  const fullStorageUrl = normalizeRenderableUrl(output.fullStoragePath);
  const legacyPreviewUrl = normalizeRenderableUrl(output.previewUrl);
  const resultFallbackUrl =
    output.resultUrls
      ?.map((value) => normalizeRenderableUrl(value))
      .find((value): value is string => Boolean(value)) ?? null;

  if (strictPreviewLadder) {
    const resolvedPreviewUrl =
      previewStorageUrl ?? fullStorageUrl ?? legacyPreviewUrl ?? resultFallbackUrl ?? null;
    const previewUrl =
      shouldApplyAdaptivePreviewQuality && resolvedPreviewUrl
        ? applyAdaptivePreviewTransform({
            url: resolvedPreviewUrl,
            qualityBand,
            targetLongEdgePx,
            mediaKindHint,
            surface: options?.surface ?? "reference-grid",
          })
        : resolvedPreviewUrl;
    return {
      previewUrl,
      fullUrl: isPreviewOnlyGenerated
        ? null
        : (fullStorageUrl ?? previewStorageUrl ?? legacyPreviewUrl ?? resultFallbackUrl ?? null),
      authorityTier,
      previewQualityBand: shouldApplyAdaptivePreviewQuality ? qualityBand : "high",
      targetLongEdgePx: shouldApplyAdaptivePreviewQuality ? targetLongEdgePx : 960,
    };
  }

  const resolvedPreviewUrl = previewStorageUrl ?? legacyPreviewUrl ?? resultFallbackUrl ?? null;
  const previewUrl =
    shouldApplyAdaptivePreviewQuality && resolvedPreviewUrl
      ? applyAdaptivePreviewTransform({
          url: resolvedPreviewUrl,
          qualityBand,
          targetLongEdgePx,
          mediaKindHint,
          surface: options?.surface ?? "reference-grid",
        })
      : resolvedPreviewUrl;

  return {
    previewUrl,
    fullUrl: isPreviewOnlyGenerated
      ? null
      : (fullStorageUrl ?? legacyPreviewUrl ?? resultFallbackUrl ?? null),
    authorityTier,
    previewQualityBand: shouldApplyAdaptivePreviewQuality ? qualityBand : "high",
    targetLongEdgePx: shouldApplyAdaptivePreviewQuality ? targetLongEdgePx : 960,
  };
};

/**
 * Resolves preview/full card URLs with strict preview-ladder semantics when enabled.
 */
export const resolveReferenceCardUrls = (
  output: Pick<
    StudioOutput,
    | "previewStoragePath"
    | "fullStoragePath"
    | "previewUrl"
    | "resultUrls"
    | "mediaSource"
    | "generationId"
    | "savedMediaIds"
  > & { mode?: StudioOutput["mode"] | null },
  options?: {
    strictPreviewLadder?: boolean;
    pressureLevel?: number;
    cardLongEdgePx?: number | null;
    devicePixelRatio?: number;
    adaptivePreviewQuality?: boolean;
    surface?: AdaptiveSurface;
  }
) => {
  const authorityTier = resolveReferenceOutputAuthorityTier(output);
  const surface = options?.surface ?? "reference-grid";
  const shouldApplyAdaptivePreviewQuality =
    options?.adaptivePreviewQuality === true && !hasDistinctDurablePreviewAsset(output);
  const shouldUseV2 = isAdaptiveSurfaceEnabled(surface);
  const shouldShadowCompare = isAdaptiveShadowCompareEnabled();
  const shouldRenderV2 = shouldUseV2 && !shouldShadowCompare;
  const legacy = resolveReferenceCardUrlsLegacy(output, options);

  if (!shouldUseV2 && !shouldShadowCompare) {
    return legacy;
  }

  const mediaKind =
    output.mode === "video"
      ? "video"
      : output.mode === "image"
        ? "image"
        : output.mode === "audio"
          ? "audio"
          : "unknown";
  const source = resolveAdaptiveSourceKind(output.previewUrl ?? output.resultUrls?.[0] ?? null);

  const v2Resolved = resolveAdaptiveMedia({
    surface,
    mediaKind,
    source,
    urls: {
      previewUrl: output.previewUrl ?? null,
      resultUrls: output.resultUrls ?? null,
      fullUrl: null,
    },
    storage: {
      previewStoragePath: output.previewStoragePath ?? null,
      fullStoragePath: output.fullStoragePath ?? null,
    },
    strictPreviewLadder: options?.strictPreviewLadder === true,
    pressureLevel: options?.pressureLevel,
    cardLongEdgePx: options?.cardLongEdgePx ?? null,
    devicePixelRatio: options?.devicePixelRatio ?? 1,
    adaptivePreviewQuality: shouldApplyAdaptivePreviewQuality,
  });

  const resolved = {
    previewUrl: v2Resolved.previewUrl,
    fullUrl:
      authorityTier === "preview-only" && isGeneratedOutput(output) ? null : v2Resolved.fullUrl,
    authorityTier,
    previewQualityBand: shouldApplyAdaptivePreviewQuality
      ? v2Resolved.decision.qualityBand
      : ("high" satisfies ReferenceGridPreviewQualityBand),
    targetLongEdgePx: shouldApplyAdaptivePreviewQuality
      ? v2Resolved.decision.targetLongEdgePx
      : 960,
  };

  if (shouldRenderV2) {
    logAdaptivePolicyApplied({ result: v2Resolved });
  }

  if (shouldShadowCompare) {
    if (
      legacy.previewUrl !== resolved.previewUrl ||
      legacy.fullUrl !== resolved.fullUrl ||
      legacy.previewQualityBand !== resolved.previewQualityBand ||
      legacy.targetLongEdgePx !== resolved.targetLongEdgePx
    ) {
      logAdaptiveResolveMismatch({
        surface,
        mediaKind,
        pressureLevel: options?.pressureLevel ?? 0,
        oldPreviewUrl: legacy.previewUrl,
        newPreviewUrl: resolved.previewUrl,
      });
    }
  }

  return shouldRenderV2 ? resolved : legacy;
};

/**
 * Resolves normalized delivery fields for output state updates while preserving existing variants.
 */
export const resolveNormalizedOutputDelivery = ({
  previewStoragePath,
  fullStoragePath,
  previewUrl,
  resultUrls,
}: {
  previewStoragePath?: string | null;
  fullStoragePath?: string | null;
  previewUrl?: string | null;
  resultUrls?: string[] | null;
}) => {
  void previewUrl;
  void resultUrls;
  const normalizedPreview = asCanonicalStoragePath(previewStoragePath);
  const normalizedFull = asCanonicalStoragePath(fullStoragePath) ?? normalizedPreview;

  return {
    previewStoragePath: normalizedPreview,
    fullStoragePath: normalizedFull,
  };
};
