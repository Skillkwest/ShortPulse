/**
 * Media preview transform profile helpers.
 * Centralizes per-surface image transform presets for signed preview URLs.
 */

export type MediaPreviewTransformProfile =
  | "none"
  | "media-library-modal-image-card"
  | "media-library-panel-image-card"
  | "project-card-preview";

export type MediaPreviewImageTransform = {
  width: number;
  quality: number;
  resize: "contain";
};

const IMAGE_PATH_EXTENSION_PATTERN = /\.(avif|bmp|gif|heic|heif|jpe?g|png|webp|svg)(?:$|[?#])/i;

const PROFILE_TRANSFORM_PRESETS: Record<
  Exclude<MediaPreviewTransformProfile, "none">,
  MediaPreviewImageTransform
> = {
  "media-library-modal-image-card": {
    width: 512,
    quality: 52,
    resize: "contain",
  },
  "media-library-panel-image-card": {
    width: 256,
    quality: 46,
    resize: "contain",
  },
  "project-card-preview": {
    width: 160,
    quality: 36,
    resize: "contain",
  },
};

const trimLower = (value: string | null | undefined): string => (value ?? "").trim().toLowerCase();

/**
 * Resolves default preview transform profile from a media signing surface label.
 */
export const resolvePreviewProfileForSurface = (
  surface?: string | null
): MediaPreviewTransformProfile => {
  const normalized = trimLower(surface);
  if (normalized === "media-library-panel") return "media-library-panel-image-card";
  if (normalized === "media-library-modal") return "media-library-modal-image-card";
  return "none";
};

/**
 * Returns true when a storage path appears to reference an image object.
 */
export const isLikelyImageStoragePath = (storagePath: string): boolean =>
  IMAGE_PATH_EXTENSION_PATTERN.test(storagePath);

/**
 * Resolves the transform payload for `createSignedUrl`, or null when no transform should apply.
 */
export const resolveSignedImageTransform = (
  profile: MediaPreviewTransformProfile,
  storagePath: string
): MediaPreviewImageTransform | null => {
  if (profile === "none") return null;
  if (!isLikelyImageStoragePath(storagePath)) return null;
  return PROFILE_TRANSFORM_PRESETS[profile];
};
