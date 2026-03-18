/**
 * Shared adaptive preview resolution for Media Library route/modal card grids.
 * Keeps pressure-aware preview URL selection consistent across both surfaces.
 */
import {
  resolveAdaptiveMedia,
  resolveAdaptiveSourceKind,
  type AdaptiveSurface,
} from "../../../lib/adaptive-media";

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

const SUPABASE_SIGNED_STORAGE_PATH_PATTERN = /\/storage\/v1\/(?:object|render\/image)\/sign\//i;

const isSupabaseSignedStorageUrl = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return SUPABASE_SIGNED_STORAGE_PATH_PATTERN.test(trimmed);
};

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
  if (shouldBypassAdaptivePreview) return signedUrl;
  if (isSupabaseSignedStorageUrl(signedUrl)) return signedUrl;

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
