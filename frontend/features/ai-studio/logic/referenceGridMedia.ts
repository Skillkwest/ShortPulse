/**
 * Reference-grid media delivery helpers.
 * Centralizes preview/full URL resolution so card rendering can prefer lightweight variants safely.
 */
import type { StudioOutput } from "../types";

type ReferenceMediaCandidate = string | null | undefined;
export type ReferenceGridPreviewQualityBand = "high" | "balanced" | "compact";

const HTTP_LIKE_PATTERN = /^https?:\/\//i;
const DATA_LIKE_PATTERN = /^data:(image|video)\//i;
const BLOB_LIKE_PATTERN = /^blob:/i;
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
export const isRenderableReferenceMediaUrl = (value: ReferenceMediaCandidate): value is string => {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (HTTP_LIKE_PATTERN.test(trimmed)) return true;
  if (DATA_LIKE_PATTERN.test(trimmed)) return true;
  if (BLOB_LIKE_PATTERN.test(trimmed)) return true;
  if (trimmed.startsWith("/")) return true;
  return false;
};

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
  if (qualityBand === "compact") return 24;
  if (qualityBand === "balanced") return 26;
  return 34;
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
}: {
  url: string;
  targetLongEdgePx: number;
  qualityBand: ReferenceGridPreviewQualityBand;
}): string => {
  const parsedCandidate = parseTransformCandidateUrl(url);
  if (!parsedCandidate) {
    return url;
  }
  const { parsed, isRelativeInput } = parsedCandidate;
  if (isRelativeInput && parsed.pathname.startsWith(NEXT_IMAGE_OPTIMIZER_PATH)) {
    return url;
  }
  if (isLikelyVideoPath(parsed.pathname)) return url;
  if (isSupabaseStorageUrl(parsed)) {
    if (!isLikelyImagePath(parsed.pathname)) return url;
    if (!isSupabaseRenderImagePath(parsed.pathname)) {
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
  if (!HTTP_PROTOCOL_PATTERN.test(url) && !isRelativeInput) {
    return url;
  }
  return toNextImageOptimizedUrl({
    sourceUrl: isRelativeInput ? `${parsed.pathname}${parsed.search}` : url,
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
  const targetLongEdgePx = qualityBand === "compact" ? 448 : qualityBand === "balanced" ? 512 : 640;
  return {
    qualityBand,
    targetLongEdgePx,
  };
};

/**
 * Resolves preview/full card URLs with strict preview-ladder semantics when enabled.
 */
export const resolveReferenceCardUrls = (
  output: Pick<
    StudioOutput,
    "previewStoragePath" | "fullStoragePath" | "previewUrl" | "resultUrls"
  >,
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
  const primaryResultUrl = resultUrls?.find(
    (value) => typeof value === "string" && value.length > 0
  );
  const normalizedFull =
    fullStoragePath ?? previewStoragePath ?? primaryResultUrl ?? previewUrl ?? null;
  const normalizedPreview =
    previewStoragePath ?? normalizedFull ?? primaryResultUrl ?? previewUrl ?? null;

  return {
    previewStoragePath: normalizedPreview,
    fullStoragePath: normalizedFull,
  };
};
