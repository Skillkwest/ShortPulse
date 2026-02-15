/**
 * AI Studio shell resize helpers.
 * Computes bounds/defaults for the properties-vs-reference split layout.
 */

export const AI_SHELL_LEFT_MIN_PX = 540;
export const AI_SHELL_LEFT_CHARACTER_MIN_PX = 1080;
export const AI_SHELL_RIGHT_MIN_PX = 320;
export const AI_SHELL_DIVIDER_TRACK_PX = 16;
export const AI_SHELL_RESIZE_BREAKPOINT_PX = 960;
export const AI_SHELL_LEFT_DEFAULT_RATIO = 0.4;
export const AI_SHELL_LEFT_MIN_FALLBACK_PX = 420;
export const AI_SHELL_LEFT_WIDTH_STORAGE_KEY = "shortpulse.aiStudio.shellLeftWidthPx";

type ShellResizeBoundsOptions = {
  minLeftWidthPx?: number;
};

/**
 * Returns left-column min/max bounds for a container width.
 * Inputs: container width in pixels.
 * Output: clamped bounds used by drag and keyboard resizing.
 */
export const getAiShellLeftWidthBounds = (
  containerWidth: number,
  options?: ShellResizeBoundsOptions
): { min: number; max: number } => {
  if (!Number.isFinite(containerWidth) || containerWidth <= 0) {
    return {
      min: AI_SHELL_LEFT_MIN_FALLBACK_PX,
      max: AI_SHELL_LEFT_MIN_FALLBACK_PX,
    };
  }
  const safeContainerWidth = Math.floor(containerWidth);
  const requestedMin = Math.max(
    AI_SHELL_LEFT_MIN_FALLBACK_PX,
    options?.minLeftWidthPx ?? AI_SHELL_LEFT_MIN_PX
  );
  const min = Math.min(
    requestedMin,
    Math.max(
      AI_SHELL_LEFT_MIN_FALLBACK_PX,
      safeContainerWidth - AI_SHELL_RIGHT_MIN_PX - AI_SHELL_DIVIDER_TRACK_PX
    )
  );
  const max = Math.max(min, safeContainerWidth - AI_SHELL_RIGHT_MIN_PX - AI_SHELL_DIVIDER_TRACK_PX);
  return { min, max };
};

/**
 * Clamps a requested left width into valid bounds.
 * Inputs: requested width and container width.
 * Output: safe width that preserves minimum space for both columns.
 */
export const clampAiShellLeftWidth = (
  requestedWidth: number,
  containerWidth: number,
  options?: ShellResizeBoundsOptions
): number => {
  const { min, max } = getAiShellLeftWidthBounds(containerWidth, options);
  if (!Number.isFinite(requestedWidth)) {
    return min;
  }
  return Math.min(max, Math.max(min, Math.round(requestedWidth)));
};

/**
 * Computes the default left width for a container.
 * Inputs: container width.
 * Output: clamped default used for first-load and reset.
 */
export const getDefaultAiShellLeftWidth = (
  containerWidth: number,
  options?: ShellResizeBoundsOptions
): number => {
  const preferredWidth = containerWidth * AI_SHELL_LEFT_DEFAULT_RATIO;
  return clampAiShellLeftWidth(preferredWidth, containerWidth, options);
};

/**
 * Parses a stored width value from localStorage.
 * Inputs: raw localStorage string.
 * Output: numeric width or null when invalid.
 */
export const parseStoredAiShellLeftWidth = (rawValue: string | null): number | null => {
  if (!rawValue) return null;
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

/**
 * Indicates whether horizontal shell resizing should be enabled for a viewport width.
 */
export const isAiShellResizeViewport = (viewportWidth: number): boolean =>
  Number.isFinite(viewportWidth) && viewportWidth > AI_SHELL_RESIZE_BREAKPOINT_PX;
