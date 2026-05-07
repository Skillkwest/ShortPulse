/**
 * Reference-grid media delivery helpers.
 * Centralizes preview/full URL resolution so card rendering can prefer lightweight variants safely.
 */
import {
  isAdaptiveSurfaceEnabled,
  resolveAdaptiveMedia,
  resolveAdaptiveSourceKind,
  isRenderableAdaptiveUrl,
  asCanonicalStoragePath,
  logAdaptivePolicyApplied,
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

const IMAGE_EXTENSION_PATTERN = /\.(avif|bmp|gif|heic|heif|jpe?g|png|webp|svg)(?:$|[?#])/i;
const AUDIO_EXTENSION_PATTERN = /\.(aac|flac|m4a|mp3|oga|ogg|wav)(?:$|[?#])/i;
const VIDEO_EXTENSION_PATTERN = /\.(m4v|mov|mp4|ogg|ogv|webm)(?:$|[?#])/i;
const RELATIVE_IMAGE_PREVIEW_ROUTE_PATTERN = /^\/api\/media\/preview(?:\/|\?|$)/i;

const inferReferenceMediaKind = ({
  mode,
  previewStoragePath,
  fullStoragePath,
  previewUrl,
  resultUrls,
}: {
  mode?: StudioOutput["mode"] | null;
  previewStoragePath?: string | null;
  fullStoragePath?: string | null;
  previewUrl?: string | null;
  resultUrls?: string[] | null;
}): ReferenceGridMediaKindHint => {
  if (mode === "image" || mode === "video" || mode === "audio") {
    return mode;
  }

  const candidates = [previewStoragePath, fullStoragePath, previewUrl, ...(resultUrls ?? [])];
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (AUDIO_EXTENSION_PATTERN.test(candidate)) return "audio";
    if (VIDEO_EXTENSION_PATTERN.test(candidate)) return "video";
    if (RELATIVE_IMAGE_PREVIEW_ROUTE_PATTERN.test(candidate)) return "image";
    if (
      IMAGE_EXTENSION_PATTERN.test(candidate) ||
      candidate.includes("/storage/v1/render/image/")
    ) {
      return "image";
    }
  }

  return null;
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
  const mediaKindHint = inferReferenceMediaKind(output);
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
  const legacy = resolveReferenceCardUrlsLegacy(output, options);

  if (!shouldUseV2) {
    return legacy;
  }

  const mediaKind = inferReferenceMediaKind(output) ?? "unknown";
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

  logAdaptivePolicyApplied({ result: v2Resolved });
  return resolved;
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
