/**
 * Media Library runtime constants.
 * These values reflect the canonical shipped behavior across modal and panel surfaces.
 */

export const MEDIA_LIBRARY_VIRTUALIZATION_ENABLED = true;

export const MEDIA_LIBRARY_VIDEO_BUDGET_ENABLED = true;

export const MEDIA_LIBRARY_SIGN_PREFETCH_ENABLED = true;

export type MediaLibraryGridDensityConfig = {
  maxColumnCount: number;
  targetColumnWidth: number;
  previewLongEdgePx: number;
};

export const MEDIA_LIBRARY_PANEL_MAX_COLUMNS = 5;

export const MEDIA_LIBRARY_PANEL_MIN_COLUMN_WIDTH = 188;

export const MEDIA_LIBRARY_PANEL_DENSITY_CONFIG: MediaLibraryGridDensityConfig = {
  maxColumnCount: MEDIA_LIBRARY_PANEL_MAX_COLUMNS,
  targetColumnWidth: MEDIA_LIBRARY_PANEL_MIN_COLUMN_WIDTH,
  previewLongEdgePx: MEDIA_LIBRARY_PANEL_MIN_COLUMN_WIDTH,
};
