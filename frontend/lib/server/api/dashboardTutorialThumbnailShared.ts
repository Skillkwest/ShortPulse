/**
 * Lightweight dashboard tutorial thumbnail constants and validators.
 * Keep this free of media-processing imports so public dashboard bundles can use it safely.
 */
export const DASHBOARD_TUTORIAL_THUMBNAIL_BUCKET = "dashboard_tutorial_thumbnails";
export const DASHBOARD_TUTORIAL_THUMBNAIL_STORAGE_PREFIX = "tutorial-thumbnails";
export const DASHBOARD_TUTORIAL_THUMBNAIL_VARIANT_STORAGE_PREFIX = "tutorial-thumbnail-variants";
export const DASHBOARD_TUTORIAL_THUMBNAIL_SIGNED_URL_TTL_SECONDS = 24 * 60 * 60;

export const DASHBOARD_TUTORIAL_THUMBNAIL_MIME_TYPES = [
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const;

export type DashboardTutorialThumbnailContentType =
  (typeof DASHBOARD_TUTORIAL_THUMBNAIL_MIME_TYPES)[number];
export type DashboardTutorialThumbnailDisplayContentType =
  | "image/jpeg"
  | "image/webp"
  | "video/mp4";

const ALLOWED_MIME_TYPES = new Set<string>(DASHBOARD_TUTORIAL_THUMBNAIL_MIME_TYPES);

export const normalizeDashboardTutorialThumbnailContentType = (
  value: unknown
): DashboardTutorialThumbnailContentType | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return ALLOWED_MIME_TYPES.has(normalized)
    ? (normalized as DashboardTutorialThumbnailContentType)
    : null;
};

export const isDashboardTutorialThumbnailStoragePath = (value: string): boolean => {
  if (!value || value.length > 500) return false;
  if (!value.startsWith(`${DASHBOARD_TUTORIAL_THUMBNAIL_STORAGE_PREFIX}/`)) return false;
  if (
    value.startsWith("/") ||
    value.includes("//") ||
    value.includes("..") ||
    value.includes("\\")
  ) {
    return false;
  }
  return true;
};

export const isDashboardTutorialThumbnailVariantStoragePath = (value: string): boolean => {
  if (!value || value.length > 500) return false;
  if (!value.startsWith(`${DASHBOARD_TUTORIAL_THUMBNAIL_VARIANT_STORAGE_PREFIX}/`)) return false;
  if (
    value.startsWith("/") ||
    value.includes("//") ||
    value.includes("..") ||
    value.includes("\\")
  ) {
    return false;
  }
  return true;
};

export const isDashboardTutorialThumbnailObjectStoragePath = (value: string): boolean =>
  isDashboardTutorialThumbnailStoragePath(value) ||
  isDashboardTutorialThumbnailVariantStoragePath(value);

export const resolveDashboardTutorialThumbnailMediaType = (
  mimeType: DashboardTutorialThumbnailContentType
): "image" | "video" => (mimeType.startsWith("video/") ? "video" : "image");
