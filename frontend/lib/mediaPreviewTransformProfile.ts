/**
 * Media preview signing profile helpers.
 * Preserves existing surface labels without allowing Supabase transform payloads.
 */

export type MediaPreviewTransformProfile =
  | "none"
  | "media-library-modal-image-card"
  | "media-library-panel-image-card"
  | "project-card-preview";

const trimLower = (value: string | null | undefined): string => (value ?? "").trim().toLowerCase();

/**
 * Resolves default preview signing profile from a media signing surface label.
 */
export const resolvePreviewProfileForSurface = (
  surface?: string | null
): MediaPreviewTransformProfile => {
  const normalized = trimLower(surface);
  if (
    normalized === "media-library-panel" ||
    normalized === "elements-media-panel" ||
    normalized === "character-media-panel"
  ) {
    return "media-library-panel-image-card";
  }
  if (normalized === "media-library-modal") return "media-library-modal-image-card";
  return "none";
};
