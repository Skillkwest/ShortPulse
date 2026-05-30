import {
  REFERENCE_GRID_HEAVY_LOAD_LONG_EDGE_COMPACTION,
  type AdaptiveSurface,
} from "../../../lib/adaptive-media";
import { canUseNextImageOptimizerForUrl } from "../../../lib/mediaPreviewTrustPolicy";

export type ReferenceGridPreviewQualityBand = "high" | "balanced" | "compact";
export type ReferenceGridMediaKindHint = "image" | "video" | "audio" | null;

const VIDEO_EXTENSION_PATTERN = /\.(m4v|mov|mp4|ogg|ogv|webm)(?:$|[?#])/i;
const HTTP_PROTOCOL_PATTERN = /^https?:\/\//i;
const ROOT_RELATIVE_PATTERN = /^\//;
const NEXT_IMAGE_OPTIMIZER_PATH = "/_next/image";
const NEXT_IMAGE_ALLOWED_WIDTHS = [384, 448, 512, 576, 640, 750, 828, 1080, 1200];

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
  void surface;
  const parsedCandidate = parseTransformCandidateUrl(url);
  if (!parsedCandidate) {
    return url;
  }
  const { parsed, isRelativeInput } = parsedCandidate;
  if (isRelativeInput && parsed.pathname.startsWith(NEXT_IMAGE_OPTIMIZER_PATH)) {
    return url;
  }
  const hintedIsVideo = mediaKindHint === "video";
  if (hintedIsVideo || isLikelyVideoPath(parsed.pathname)) return url;
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
