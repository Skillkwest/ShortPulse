import { resolveAdaptivePolicyDecision, resolveAdaptivePressureLevel } from "./policy";
import type {
  AdaptiveDecision,
  AdaptiveInput,
  AdaptiveMediaKind,
  AdaptiveResolvedMedia,
  AdaptiveSourceKind,
} from "./types";
import { canUseNextImageOptimizerForUrl } from "../mediaPreviewTrustPolicy";

const HTTP_LIKE_PATTERN = /^https?:\/\//i;
const DATA_LIKE_PATTERN = /^data:(image|video)\//i;
const BLOB_LIKE_PATTERN = /^blob:/i;
const WORKSPACE_STORAGE_KEY_ROOT_PATH_PATTERN =
  /^\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\//i;
const STORAGE_PATH_LIKE_PATTERN = /\//;
const STORAGE_PATH_INVALID_PATTERN = /^(?:https?:\/\/|blob:|data:)/i;
const SUPABASE_HOST_SUFFIX = ".supabase.co";
const IMAGE_EXTENSION_PATTERN = /\.(avif|bmp|gif|heic|heif|jpe?g|png|webp|svg)(?:$|[?#])/i;
const VIDEO_EXTENSION_PATTERN = /\.(m4v|mov|mp4|ogg|ogv|webm)(?:$|[?#])/i;
const HTTP_PROTOCOL_PATTERN = /^https?:\/\//i;
const ROOT_RELATIVE_PATTERN = /^\//;
const NEXT_IMAGE_OPTIMIZER_PATH = "/_next/image";
const NEXT_IMAGE_ALLOWED_WIDTHS = [384, 448, 512, 576, 640, 750, 828, 1080, 1200];

export const isRenderableAdaptiveUrl = (value: string | null | undefined): value is string => {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (HTTP_LIKE_PATTERN.test(trimmed)) return true;
  if (DATA_LIKE_PATTERN.test(trimmed)) return true;
  if (BLOB_LIKE_PATTERN.test(trimmed)) return true;
  if (trimmed.startsWith("/")) {
    if (WORKSPACE_STORAGE_KEY_ROOT_PATH_PATTERN.test(trimmed)) return false;
    return true;
  }
  return false;
};

export const asCanonicalStoragePath = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (STORAGE_PATH_INVALID_PATTERN.test(trimmed)) return null;
  if (!STORAGE_PATH_LIKE_PATTERN.test(trimmed)) return null;
  return trimmed.replace(/^\/+/, "");
};

const normalizeRenderableUrl = (value: string | null | undefined): string | null => {
  if (!isRenderableAdaptiveUrl(value)) return null;
  return value.trim();
};

const resolveNextImageWidth = (targetLongEdgePx: number): number =>
  NEXT_IMAGE_ALLOWED_WIDTHS.find((candidate) => candidate >= targetLongEdgePx) ??
  NEXT_IMAGE_ALLOWED_WIDTHS[NEXT_IMAGE_ALLOWED_WIDTHS.length - 1]!;

const toNextImageOptimizedUrl = ({
  sourceUrl,
  targetLongEdgePx,
  decision,
}: {
  sourceUrl: string;
  targetLongEdgePx: number;
  decision: AdaptiveDecision;
}): string => {
  const width = resolveNextImageWidth(targetLongEdgePx);
  return `/_next/image?url=${encodeURIComponent(sourceUrl)}&w=${width}&q=${decision.qualityParam}`;
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

const getSupabaseOrigin = (): string | null => {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
};

const isSupabaseStorageUrl = (parsedUrl: URL): boolean => {
  if (!parsedUrl.pathname.includes("/storage/v1/")) return false;
  if (parsedUrl.hostname.endsWith(SUPABASE_HOST_SUFFIX)) return true;
  const configuredSupabaseOrigin = getSupabaseOrigin();
  return configuredSupabaseOrigin != null && parsedUrl.origin === configuredSupabaseOrigin;
};

const inferMediaKind = (url: string, hint: AdaptiveMediaKind): AdaptiveMediaKind => {
  if (hint === "image" || hint === "video") return hint;
  if (VIDEO_EXTENSION_PATTERN.test(url)) return "video";
  if (IMAGE_EXTENSION_PATTERN.test(url)) return "image";
  return "unknown";
};

const applyAdaptivePreviewTransform = ({
  url,
  decision,
  mediaKindHint,
  surface,
}: {
  url: string;
  decision: AdaptiveDecision;
  mediaKindHint: AdaptiveMediaKind;
  surface: AdaptiveInput["surface"];
}): { url: string; usedOptimizerTransform: boolean } => {
  const parsedCandidate = parseTransformCandidateUrl(url);
  if (!parsedCandidate) return { url, usedOptimizerTransform: false };

  const { parsed, isRelativeInput } = parsedCandidate;
  if (isRelativeInput && parsed.pathname.startsWith(NEXT_IMAGE_OPTIMIZER_PATH)) {
    return { url, usedOptimizerTransform: false };
  }

  const inferredKind = inferMediaKind(url, mediaKindHint);
  if (inferredKind === "video" || isLikelyVideoPath(parsed.pathname)) {
    return { url, usedOptimizerTransform: false };
  }

  const isRenderImagePath = isSupabaseRenderImagePath(parsed.pathname);
  const hasImageSignal =
    inferredKind === "image" || isLikelyImagePath(parsed.pathname) || isRenderImagePath;

  if (isSupabaseStorageUrl(parsed)) {
    if (!hasImageSignal) return { url, usedOptimizerTransform: false };
    if (!isRenderImagePath) {
      if (surface === "reference-grid" || surface === "quick-slot") {
        return { url, usedOptimizerTransform: false };
      }
      const nextUrl = toNextImageOptimizedUrl({
        sourceUrl: url,
        targetLongEdgePx: decision.targetLongEdgePx,
        decision,
      });
      return { url: nextUrl, usedOptimizerTransform: true };
    }

    parsed.searchParams.set(
      "width",
      String(Math.max(320, Math.min(1280, decision.targetLongEdgePx)))
    );
    parsed.searchParams.set("quality", String(decision.qualityParam));
    return {
      url: parsed.toString(),
      usedOptimizerTransform: true,
    };
  }

  const nextSourceUrl = isRelativeInput ? `${parsed.pathname}${parsed.search}` : url;
  if (!canUseNextImageOptimizerForUrl(nextSourceUrl)) {
    return { url, usedOptimizerTransform: false };
  }

  const nextUrl = toNextImageOptimizedUrl({
    sourceUrl: nextSourceUrl,
    targetLongEdgePx: decision.targetLongEdgePx,
    decision,
  });
  return { url: nextUrl, usedOptimizerTransform: true };
};

const dedupe = (values: Array<string | null | undefined>): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
};

export const resolveAdaptiveSourceKind = (value: string | null | undefined): AdaptiveSourceKind => {
  const trimmed = value?.trim() ?? "";
  if (/^blob:/i.test(trimmed)) return "local-blob";
  if (/^data:/i.test(trimmed)) return "data-url";
  return "remote";
};

export const resolveAdaptiveMedia = (input: AdaptiveInput): AdaptiveResolvedMedia => {
  const strictPreviewLadder = input.strictPreviewLadder === true;
  const decision = resolveAdaptivePolicyDecision(input);
  const pressureLevel = resolveAdaptivePressureLevel(input.pressureLevel);

  const previewStorageUrl = normalizeRenderableUrl(input.storage.previewStoragePath);
  const fullStorageUrl = normalizeRenderableUrl(input.storage.fullStoragePath);
  const previewUrl = normalizeRenderableUrl(input.urls.previewUrl);
  const fullUrl = normalizeRenderableUrl(input.urls.fullUrl);
  const resultUrls = (input.urls.resultUrls ?? [])
    .map((value) => normalizeRenderableUrl(value))
    .filter((value): value is string => Boolean(value));
  const firstResultUrl = resultUrls[0] ?? null;

  const previewCandidates = strictPreviewLadder
    ? [previewStorageUrl, fullStorageUrl, previewUrl, firstResultUrl]
    : [previewStorageUrl, previewUrl, firstResultUrl];

  const fullCandidates = strictPreviewLadder
    ? [fullStorageUrl, previewStorageUrl, fullUrl, previewUrl, firstResultUrl]
    : [fullStorageUrl, fullUrl, previewUrl, firstResultUrl];

  const resolvedPreviewBase =
    previewCandidates.find((candidate): candidate is string => Boolean(candidate)) ?? null;
  const resolvedFull =
    fullCandidates.find((candidate): candidate is string => Boolean(candidate)) ?? null;

  let resolvedPreview = resolvedPreviewBase;
  let usedOptimizerTransform = false;

  if (decision.adaptationEnabled && resolvedPreviewBase) {
    const transformed = applyAdaptivePreviewTransform({
      url: resolvedPreviewBase,
      decision,
      mediaKindHint: input.mediaKind,
      surface: input.surface,
    });
    resolvedPreview = transformed.url;
    usedOptimizerTransform = transformed.usedOptimizerTransform;
  }

  const fallbackChain = dedupe([
    resolvedPreview,
    resolvedFull,
    previewStorageUrl,
    fullStorageUrl,
    previewUrl,
    fullUrl,
    ...resultUrls,
  ]);

  return {
    previewUrl: resolvedPreview,
    fullUrl: resolvedFull,
    fallbackChain,
    decision,
    decisionMeta: {
      surface: input.surface,
      mediaKind: input.mediaKind,
      source: input.source,
      pressureLevel,
      usedFallback: Boolean(
        resolvedPreviewBase && previewCandidates[0] && resolvedPreviewBase !== previewCandidates[0]
      ),
      usedOptimizerTransform,
      strictPreviewLadder,
    },
  };
};
