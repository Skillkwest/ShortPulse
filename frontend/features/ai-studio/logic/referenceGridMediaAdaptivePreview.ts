import {
  REFERENCE_GRID_HEAVY_LOAD_LONG_EDGE_COMPACTION,
  type AdaptiveSurface,
} from "../../../lib/adaptive-media";
import { canUseNextImageOptimizerForUrl } from "../../../lib/mediaPreviewTrustPolicy";

export type ReferenceGridPreviewQualityBand = "high" | "balanced" | "compact";
export type ReferenceGridMediaKindHint = "image" | "video" | "audio" | null;

const SUPABASE_HOST_SUFFIX = ".supabase.co";
const IMAGE_EXTENSION_PATTERN = /\.(avif|bmp|gif|heic|heif|jpe?g|png|webp)(?:$|[?#])/i;
const VIDEO_EXTENSION_PATTERN = /\.(m4v|mov|mp4|ogg|ogv|webm)(?:$|[?#])/i;
const HTTP_PROTOCOL_PATTERN = /^https?:\/\//i;
const ROOT_RELATIVE_PATTERN = /^\//;
const NEXT_IMAGE_OPTIMIZER_PATH = "/_next/image";
const NEXT_IMAGE_ALLOWED_WIDTHS = [384, 448, 512, 576, 640, 750, 828, 1080, 1200];

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
  if (qualityBand === "compact") return 28;
  if (qualityBand === "balanced") return 30;
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
const toSupabaseRenderImageUrl = ({
  parsed,
  targetLongEdgePx,
  qualityBand,
  surface,
}: {
  parsed: URL;
  targetLongEdgePx: number;
  qualityBand: ReferenceGridPreviewQualityBand;
  surface: AdaptiveSurface;
}): string => {
  if (!isSupabaseRenderImagePath(parsed.pathname)) {
    parsed.pathname = parsed.pathname.replace("/storage/v1/object/", "/storage/v1/render/image/");
  }
  const minRenderWidth = surface === "quick-slot" ? 240 : 288;
  const maxRenderWidth = surface === "quick-slot" ? 640 : 960;
  parsed.searchParams.set(
    "width",
    String(Math.max(minRenderWidth, Math.min(maxRenderWidth, targetLongEdgePx)))
  );
  parsed.searchParams.set("quality", String(resolvePreviewQualityParam(qualityBand)));
  return parsed.toString();
};

const isSupabaseStorageUrl = (parsedUrl: URL): boolean => {
  if (!parsedUrl.pathname.includes("/storage/v1/")) return false;
  if (parsedUrl.hostname.endsWith(SUPABASE_HOST_SUFFIX)) return true;
  const configuredSupabaseOrigin = getSupabaseOrigin();
  return configuredSupabaseOrigin != null && parsedUrl.origin === configuredSupabaseOrigin;
};

export const applyAdaptivePreviewTransform = ({
  url,
  targetLongEdgePx,
  qualityBand,
  mediaKindHint,
  surface,
}: {
  url: string;
  targetLongEdgePx: number;
  qualityBand: ReferenceGridPreviewQualityBand;
  mediaKindHint: ReferenceGridMediaKindHint;
  surface: AdaptiveSurface;
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
      if (surface === "reference-grid" || surface === "quick-slot") {
        return toSupabaseRenderImageUrl({
          parsed,
          targetLongEdgePx,
          qualityBand,
          surface,
        });
      }
      return toNextImageOptimizedUrl({
        sourceUrl: url,
        targetLongEdgePx,
        qualityBand,
      });
    }
    return toSupabaseRenderImageUrl({
      parsed,
      targetLongEdgePx,
      qualityBand,
      surface,
    });
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

export const resolvePreviewQualityTarget = ({
  pressureLevel,
  surface,
}: {
  pressureLevel: number;
  surface: AdaptiveSurface;
  cardLongEdgePx: number | null;
  devicePixelRatio: number;
}) => {
  const qualityBand: ReferenceGridPreviewQualityBand =
    pressureLevel >= 2 ? "compact" : pressureLevel >= 1 ? "balanced" : "high";
  const targetLongEdgePxBase =
    qualityBand === "compact" ? 320 : qualityBand === "balanced" ? 384 : 448;
  const targetLongEdgePx = (() => {
    if (!REFERENCE_GRID_HEAVY_LOAD_LONG_EDGE_COMPACTION) return targetLongEdgePxBase;
    if (pressureLevel !== 2) return targetLongEdgePxBase;
    if (surface === "reference-grid") {
      return Math.round(Math.max(288, Math.min(960, targetLongEdgePxBase * 0.9)));
    }
    if (surface === "quick-slot") {
      return Math.round(Math.max(240, Math.min(640, targetLongEdgePxBase * 0.9)));
    }
    return targetLongEdgePxBase;
  })();
  return {
    qualityBand,
    targetLongEdgePx,
  };
};
