/**
 * Shared adaptive preview resolution for Media Library modal/panel card grids.
 * Keeps pressure-aware preview URL selection consistent across both surfaces.
 */
import {
  resolveAdaptiveMedia,
  resolveAdaptiveSourceKind,
  type AdaptiveSurface,
} from "../../../lib/adaptive-media";
import {
  isSupabaseObjectSignedStorageUrl,
  isSupabaseRenderImageUrl,
} from "../../../lib/mediaPreviewTrustPolicy";

type MediaLibraryAdaptiveSurface = Extract<
  AdaptiveSurface,
  "media-library-grid" | "media-library-modal-grid" | "media-library-panel-grid"
>;

type ResolveMediaLibraryAdaptiveCardPreviewArgs = {
  surface: MediaLibraryAdaptiveSurface;
  signedUrl: string | null | undefined;
  fileType?: string | null;
  pressureLevel: 0 | 1 | 2;
  adaptivePreviewQualityEnabled: boolean;
  shouldBypassAdaptivePreview?: boolean;
  cardLongEdgePx?: number;
  devicePixelRatio?: number;
};

const DEFAULT_CARD_LONG_EDGE_PX = 320;

const isVideoFile = (fileType?: string | null): boolean =>
  (fileType ?? "").toLowerCase().startsWith("video");

const isAudioFile = (fileType?: string | null): boolean =>
  (fileType ?? "").toLowerCase().startsWith("audio");

/**
 * Resolves a card preview URL for media-library grids using adaptive media policy.
 */
export const resolveMediaLibraryAdaptiveCardPreviewUrl = ({
  surface,
  signedUrl,
  fileType,
  pressureLevel,
  adaptivePreviewQualityEnabled,
  shouldBypassAdaptivePreview = false,
  cardLongEdgePx = DEFAULT_CARD_LONG_EDGE_PX,
  devicePixelRatio = 1,
}: ResolveMediaLibraryAdaptiveCardPreviewArgs): string | null => {
  if (!signedUrl) return null;
  if (isSupabaseRenderImageUrl(signedUrl)) return null;
  if (shouldBypassAdaptivePreview) return signedUrl;
  if (isSupabaseObjectSignedStorageUrl(signedUrl)) return signedUrl;
  if (isAudioFile(fileType)) return signedUrl;

  const adaptiveResult = resolveAdaptiveMedia({
    surface,
    mediaKind: isVideoFile(fileType) ? "video" : "image",
    source: resolveAdaptiveSourceKind(signedUrl),
    urls: {
      previewUrl: signedUrl,
      fullUrl: signedUrl,
    },
    storage: {},
    pressureLevel,
    cardLongEdgePx,
    devicePixelRatio,
    strictPreviewLadder: true,
    adaptivePreviewQuality: adaptivePreviewQualityEnabled,
  });

  return adaptiveResult.previewUrl ?? signedUrl;
};
