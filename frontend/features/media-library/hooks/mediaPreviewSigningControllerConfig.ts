/**
 * Static configuration for media preview signing controller queues.
 * Separates surface policy from the hook's effect orchestration.
 */
import { MEDIA_LIBRARY_PANEL_MAX_COLUMNS } from "../logic/mediaLibraryRuntimeConfig";

export type MediaPreviewSigningSurface =
  | "media-library-modal"
  | "media-library-panel"
  | "elements-media-panel"
  | "character-media-panel";

export const VISIBLE_SCOPED_SIGN_SURFACES = new Set<MediaPreviewSigningSurface>([
  "media-library-panel",
  "elements-media-panel",
  "character-media-panel",
]);

const DEFAULT_BACKGROUND_HYDRATE_FALLBACK_LIMIT = 4;

export const resolveBackgroundHydrateFallbackLimit = (
  surface: MediaPreviewSigningSurface
): number =>
  VISIBLE_SCOPED_SIGN_SURFACES.has(surface)
    ? MEDIA_LIBRARY_PANEL_MAX_COLUMNS
    : DEFAULT_BACKGROUND_HYDRATE_FALLBACK_LIMIT;
