/**
 * Panel-only media preview resolver for AI Studio Media Library.
 * Keeps shared adaptive policy untouched while allowing optional fixed compression
 * for panel card rendering experiments.
 */
import { resolveMediaLibraryAdaptiveCardPreviewUrl } from "../../media-library/logic/mediaLibraryAdaptivePreview";

const BALANCED_FAST_PREVIEW_WIDTH = 512;
const BALANCED_FAST_PREVIEW_QUALITY = 34;
const SUPABASE_RENDER_IMAGE_PATH = "/storage/v1/render/image/";

const isVideoFile = (fileType?: string | null): boolean =>
  (fileType ?? "").toLowerCase().startsWith("video");

const applyRenderImageParams = (sourceUrl: string): string => {
  try {
    const parsed = new URL(sourceUrl);
    if (!parsed.pathname.includes(SUPABASE_RENDER_IMAGE_PATH)) return sourceUrl;
    parsed.searchParams.set("width", String(BALANCED_FAST_PREVIEW_WIDTH));
    parsed.searchParams.set("quality", String(BALANCED_FAST_PREVIEW_QUALITY));
    return parsed.toString();
  } catch {
    return sourceUrl;
  }
};

type ResolveMediaLibraryPanelCardPreviewUrlArgs = {
  signedUrl: string | null | undefined;
  fileType?: string | null;
  pressureLevel: 0 | 1 | 2;
  adaptivePreviewQualityEnabled: boolean;
  shouldBypassAdaptivePreview?: boolean;
  cardLongEdgePx?: number;
  devicePixelRatio?: number;
  constantCompressionEnabled: boolean;
};

/**
 * Resolves panel card preview URL using shared adaptive logic as baseline and
 * optionally applies fixed Next image compression for panel-only experiments.
 */
export const resolveMediaLibraryPanelCardPreviewUrl = ({
  signedUrl,
  fileType,
  pressureLevel,
  adaptivePreviewQualityEnabled,
  shouldBypassAdaptivePreview = false,
  cardLongEdgePx,
  devicePixelRatio,
  constantCompressionEnabled,
}: ResolveMediaLibraryPanelCardPreviewUrlArgs): string | null => {
  const baselineUrl = resolveMediaLibraryAdaptiveCardPreviewUrl({
    surface: "media-library-panel-grid",
    signedUrl,
    fileType,
    pressureLevel,
    adaptivePreviewQualityEnabled,
    shouldBypassAdaptivePreview,
    cardLongEdgePx,
    devicePixelRatio,
  });

  if (!constantCompressionEnabled) return baselineUrl;
  if (!adaptivePreviewQualityEnabled) return baselineUrl;
  if (shouldBypassAdaptivePreview) return baselineUrl;
  if (isVideoFile(fileType)) return baselineUrl;

  const sourceUrl = (baselineUrl ?? signedUrl ?? "").trim();
  if (!sourceUrl) return baselineUrl;
  return applyRenderImageParams(sourceUrl);
};
