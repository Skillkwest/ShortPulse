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
  REFERENCE_GRID_HEAVY_LOAD_LONG_EDGE_COMPACTION,
  type AdaptiveSurface,
} from "../../../lib/adaptive-media";
import { canUseNextImageOptimizerForUrl } from "../../../lib/mediaPreviewTrustPolicy";
import type { StudioOutput } from "../types";

type ReferenceMediaCandidate = string | null | undefined;
export type ReferenceGridPreviewQualityBand = "high" | "balanced" | "compact";
type ReferenceGridMediaKindHint = "image" | "video" | null;

const SUPABASE_HOST_SUFFIX = ".supabase.co";
const IMAGE_EXTENSION_PATTERN = /\.(avif|bmp|gif|heic|heif|jpe?g|png|webp)(?:$|[?#])/i;
const VIDEO_EXTENSION_PATTERN = /\.(m4v|mov|mp4|ogg|ogv|webm)(?:$|[?#])/i;
const HTTP_PROTOCOL_PATTERN = /^https?:\/\//i;
const ROOT_RELATIVE_PATTERN = /^\//;
const NEXT_IMAGE_OPTIMIZER_PATH = "/_next/image";
const NEXT_IMAGE_ALLOWED_WIDTHS = [384, 448, 512, 576, 640, 750, 828, 1080, 1200];

/**
 * Returns true when a media candidate is directly renderable by an `<img>`/`<video>` tag.
 */
export const isRenderableReferenceMediaUrl = (value: ReferenceMediaCandidate): value is string =>
  isRenderableAdaptiveUrl(value);

const normalizeRenderableUrl = (value: ReferenceMediaCandidate): string | null => {
  if (!isRenderableReferenceMediaUrl(value)) return null;
  return value.trim();
};

const getSupabaseOrigin = (): string | null => {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
};

const resolvePreviewQualityParam = (qualityBand: ReferenceGridPreviewQualityBand): number => {
  if (qualityBand === "compact") return 34;
  if (qualityBand === "balanced") return 34;
  return 40;
};

const resolveNextImageWidth = (targetLongEdgePx: number): number =>
  NEXT_IMAGE_ALLOWED_WIDTHS.find((candidate) => candidate >= targetLongEdgePx) ??
  NEXT_IMAGE_ALLOWED_WIDTHS[NEXT_IMAGE_ALLOWED_WIDTHS.length - 1]!;

const toNextImageOptimizedUrl = ({
  sourceUrl,
  targetLongEdgePx,
  qualityBand,
}: {
  sourceUrl: string;
  targetLongEdgePx: number;
  qualityBand: ReferenceGridPreviewQualityBand;
}): string => {
  const width = resolveNextImageWidth(targetLongEdgePx);
  const quality = resolvePreviewQualityParam(qualityBand);
  return `/_next/image?url=${encodeURIComponent(sourceUrl)}&w=${width}&q=${quality}`;
};

const parseTransformCandidateUrl = (
  url: string
): { parsed: URL; isRelativeInput: boolean } | null => {
  if (HTTP_PROTOCOL_PATTERN.test(url)) {
    try {
      return { parsed: new URL(url), isRelativeInput: false };
    } catch {
      return null;
    }
  }
  if (ROOT_RELATIVE_PATTERN.test(url)) {
    try {
      return { parsed: new URL(url, "https://shortpulse.local"), isRelativeInput: true };
    } catch {
      return null;
    }
  }
  return null;
};

const isLikelyVideoPath = (pathname: string): boolean => VIDEO_EXTENSION_PATTERN.test(pathname);

const isLikelyImagePath = (pathname: string): boolean => IMAGE_EXTENSION_PATTERN.test(pathname);
const isSupabaseRenderImagePath = (pathname: string): boolean =>
  pathname.includes("/storage/v1/render/image/");

const isSupabaseStorageUrl = (parsedUrl: URL): boolean => {
  if (!parsedUrl.pathname.includes("/storage/v1/")) return false;
  if (parsedUrl.hostname.endsWith(SUPABASE_HOST_SUFFIX)) return true;
  const configuredSupabaseOrigin = getSupabaseOrigin();
  return configuredSupabaseOrigin != null && parsedUrl.origin === configuredSupabaseOrigin;
};

const applyAdaptivePreviewTransform = ({
  url,
  targetLongEdgePx,
  qualityBand,
  mediaKindHint,
}: {
  url: string;
  targetLongEdgePx: number;
  qualityBand: ReferenceGridPreviewQualityBand;
  mediaKindHint: ReferenceGridMediaKindHint;
}): string => {
  const parsedCandidate = parseTransformCandidateUrl(url);
  if (!parsedCandidate) {
    return url;
  }
  const { parsed, isRelativeInput } = parsedCandidate;
  if (isRelativeInput && parsed.pathname.startsWith(NEXT_IMAGE_OPTIMIZER_PATH)) {
    return url;
  }
  const hintedIsVideo = mediaKindHint === "video";
  const hintedIsImage = mediaKindHint === "image";
  if (hintedIsVideo || isLikelyVideoPath(parsed.pathname)) return url;
  const isRenderImagePath = isSupabaseRenderImagePath(parsed.pathname);
  const hasImageSignal = hintedIsImage || isLikelyImagePath(parsed.pathname) || isRenderImagePath;
  if (isSupabaseStorageUrl(parsed)) {
    if (!hasImageSignal) return url;
    if (!isRenderImagePath) {
      // Signed/object URLs often ignore width/quality params; force Next optimizer for reliable
      // downsampling and compression in the reference grid.
      return toNextImageOptimizedUrl({
        sourceUrl: url,
        targetLongEdgePx,
        qualityBand,
      });
    }
    parsed.searchParams.set("width", String(Math.max(320, Math.min(1280, targetLongEdgePx))));
    parsed.searchParams.set("quality", String(resolvePreviewQualityParam(qualityBand)));
    return parsed.toString();
  }
  const nextSourceUrl = isRelativeInput ? `${parsed.pathname}${parsed.search}` : url;
  if (!canUseNextImageOptimizerForUrl(nextSourceUrl)) {
    return url;
  }
  return toNextImageOptimizedUrl({
    sourceUrl: nextSourceUrl,
    targetLongEdgePx,
    qualityBand,
  });
};

const resolvePreviewQualityTarget = ({
  pressureLevel,
}: {
  pressureLevel: number;
  cardLongEdgePx: number | null;
  devicePixelRatio: number;
}) => {
  const qualityBand: ReferenceGridPreviewQualityBand =
    pressureLevel >= 2 ? "compact" : pressureLevel >= 1 ? "balanced" : "high";
  const targetLongEdgePxBase =
    qualityBand === "compact" ? 448 : qualityBand === "balanced" ? 512 : 640;
  const targetLongEdgePx =
    REFERENCE_GRID_HEAVY_LOAD_LONG_EDGE_COMPACTION && pressureLevel >= 2
      ? Math.round(Math.max(320, Math.min(1280, targetLongEdgePxBase * 0.86)))
      : targetLongEdgePxBase;
  return {
    qualityBand,
    targetLongEdgePx,
  };
};

const resolveReferenceCardUrlsLegacy = (
  output: Pick<
    StudioOutput,
    "previewStoragePath" | "fullStoragePath" | "previewUrl" | "resultUrls"
  > & { mode?: StudioOutput["mode"] | null },
  options?: {
    strictPreviewLadder?: boolean;
    pressureLevel?: number;
    cardLongEdgePx?: number | null;
    devicePixelRatio?: number;
    adaptivePreviewQuality?: boolean;
  }
) => {
  const strictPreviewLadder = options?.strictPreviewLadder === true;
  const adaptivePreviewQuality = options?.adaptivePreviewQuality === true;
  const pressureLevel = options?.pressureLevel ?? 0;
  const mediaKindHint: ReferenceGridMediaKindHint =
    output.mode === "video" ? "video" : output.mode === "image" ? "image" : null;
  const { qualityBand, targetLongEdgePx } = resolvePreviewQualityTarget({
    pressureLevel,
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
      adaptivePreviewQuality && resolvedPreviewUrl
        ? applyAdaptivePreviewTransform({
            url: resolvedPreviewUrl,
            qualityBand,
            targetLongEdgePx,
            mediaKindHint,
          })
        : resolvedPreviewUrl;
    return {
      previewUrl,
      fullUrl: fullStorageUrl ?? previewStorageUrl ?? legacyPreviewUrl ?? resultFallbackUrl ?? null,
      previewQualityBand: adaptivePreviewQuality ? qualityBand : "high",
      targetLongEdgePx: adaptivePreviewQuality ? targetLongEdgePx : 960,
    };
  }

  const resolvedPreviewUrl = previewStorageUrl ?? legacyPreviewUrl ?? resultFallbackUrl ?? null;
  const previewUrl =
    adaptivePreviewQuality && resolvedPreviewUrl
      ? applyAdaptivePreviewTransform({
          url: resolvedPreviewUrl,
          qualityBand,
          targetLongEdgePx,
          mediaKindHint,
        })
      : resolvedPreviewUrl;

  return {
    previewUrl,
    fullUrl: fullStorageUrl ?? legacyPreviewUrl ?? resultFallbackUrl ?? null,
    previewQualityBand: adaptivePreviewQuality ? qualityBand : "high",
    targetLongEdgePx: adaptivePreviewQuality ? targetLongEdgePx : 960,
  };
};

/**
 * Resolves preview/full card URLs with strict preview-ladder semantics when enabled.
 */
export const resolveReferenceCardUrls = (
  output: Pick<
    StudioOutput,
    "previewStoragePath" | "fullStoragePath" | "previewUrl" | "resultUrls"
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
  const surface = options?.surface ?? "reference-grid";
  const shouldUseV2 = isAdaptiveSurfaceEnabled(surface);
  const shouldShadowCompare = isAdaptiveShadowCompareEnabled();
  const shouldRenderV2 = shouldUseV2 && !shouldShadowCompare;
  const legacy = resolveReferenceCardUrlsLegacy(output, options);

  if (!shouldUseV2 && !shouldShadowCompare) {
    return legacy;
  }

  const mediaKind =
    output.mode === "video" ? "video" : output.mode === "image" ? "image" : "unknown";
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
    adaptivePreviewQuality: options?.adaptivePreviewQuality === true,
  });

  const resolved = {
    previewUrl: v2Resolved.previewUrl,
    fullUrl: v2Resolved.fullUrl,
    previewQualityBand: options?.adaptivePreviewQuality
      ? v2Resolved.decision.qualityBand
      : ("high" satisfies ReferenceGridPreviewQualityBand),
    targetLongEdgePx: options?.adaptivePreviewQuality ? v2Resolved.decision.targetLongEdgePx : 960,
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
