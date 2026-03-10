/**
 * Panel-only media preview resolver for AI Studio Media Library.
 * Keeps shared adaptive policy untouched while allowing optional fixed compression
 * for panel card rendering experiments.
 */
import { canUseNextImageOptimizerForUrl } from "../../../lib/mediaPreviewTrustPolicy";
import { resolveMediaLibraryAdaptiveCardPreviewUrl } from "../../media-library/logic/mediaLibraryAdaptivePreview";

const FIXED_PANEL_PREVIEW_WIDTH = 512;
const FIXED_PANEL_PREVIEW_QUALITY = 40;
const NEXT_IMAGE_OPTIMIZER_PREFIX = "/_next/image";

const isVideoFile = (fileType?: string | null): boolean =>
  (fileType ?? "").toLowerCase().startsWith("video");

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
    surface: "media-library-modal-grid",
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

  const sourceUrl = (signedUrl ?? "").trim();
  if (!sourceUrl) return baselineUrl;
  if (sourceUrl.startsWith(NEXT_IMAGE_OPTIMIZER_PREFIX)) return baselineUrl;
  if (!canUseNextImageOptimizerForUrl(sourceUrl)) return baselineUrl;

  return `/_next/image?url=${encodeURIComponent(sourceUrl)}&w=${FIXED_PANEL_PREVIEW_WIDTH}&q=${FIXED_PANEL_PREVIEW_QUALITY}`;
};
