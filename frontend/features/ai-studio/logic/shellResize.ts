/**
 * AI Studio shell resize helpers.
 * Computes bounds/defaults for the properties-vs-reference split layout.
 */

export const AI_SHELL_LEFT_MIN_PX = 640;
export const AI_SHELL_LEFT_SOUND_MIN_PX = 760;
export const AI_SHELL_LEFT_VIDEO_MIN_PX = 820;
export const AI_SHELL_LEFT_VIDEO_DEFAULT_RATIO = 0.6;
export const AI_SHELL_LEFT_CHARACTER_DEFAULT_RATIO = 0.75;
export const AI_SHELL_LEFT_EXPERT_CREATE_MIN_PX = 840;
export const AI_SHELL_LEFT_EXPERT_EDIT_MIN_PX = 970;
export const AI_SHELL_LEFT_EXPERT_CREATE_MAX_PX = 1120;
export const AI_SHELL_LEFT_CHARACTER_MIN_PX = 920;
export const AI_SHELL_RIGHT_MIN_PX = 320;
export const AI_SHELL_RIGHT_CANVAS_MIN_PX = 0;
export const AI_SHELL_DIVIDER_TRACK_PX = 16;
export const AI_SHELL_RESIZE_BREAKPOINT_PX = 960;
export const AI_SHELL_LEFT_DEFAULT_RATIO = 0.4;
export const AI_SHELL_LEFT_CANVAS_DEFAULT_RATIO = 0.64;
export const AI_SHELL_LEFT_MIN_FALLBACK_PX = 420;
export const AI_SHELL_LEFT_WIDTH_STORAGE_KEY = "shortpulse.aiStudio.shellLeftWidthPx.v5";

type ShellResizeBoundsOptions = {
  minLeftWidthPx?: number;
  maxLeftWidthPx?: number;
  minRightWidthPx?: number;
  preferredRatio?: number;
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
  const minRightWidthPx =
    typeof options?.minRightWidthPx === "number" && Number.isFinite(options.minRightWidthPx)
      ? Math.max(0, Math.floor(options.minRightWidthPx))
      : AI_SHELL_RIGHT_MIN_PX;
  const requestedMin = Math.max(
    AI_SHELL_LEFT_MIN_FALLBACK_PX,
    options?.minLeftWidthPx ?? AI_SHELL_LEFT_MIN_PX
  );
  const min = Math.min(
    requestedMin,
    Math.max(
      AI_SHELL_LEFT_MIN_FALLBACK_PX,
      safeContainerWidth - minRightWidthPx - AI_SHELL_DIVIDER_TRACK_PX
    )
  );
  const containerMax = safeContainerWidth - minRightWidthPx - AI_SHELL_DIVIDER_TRACK_PX;
  const requestedMaxCandidate = options?.maxLeftWidthPx;
  const requestedMax =
    typeof requestedMaxCandidate === "number" && Number.isFinite(requestedMaxCandidate)
      ? Math.max(AI_SHELL_LEFT_MIN_FALLBACK_PX, Math.floor(requestedMaxCandidate))
      : containerMax;
  const max = Math.max(min, Math.min(containerMax, requestedMax));
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
  const preferredRatio =
    typeof options?.preferredRatio === "number" &&
    Number.isFinite(options.preferredRatio) &&
    options.preferredRatio > 0
      ? options.preferredRatio
      : AI_SHELL_LEFT_DEFAULT_RATIO;
  const preferredWidth = containerWidth * preferredRatio;
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

/**
 * Indicates whether selecting the next tool should collapse the properties column to its minimum.
 * Inputs: previous and next tool ids.
 * Output: true only for a new video-tool selection.
 */
export const shouldCollapseAiShellOnToolSelect = (
  previousTool: string | null,
  nextTool: string | null
): boolean => nextTool === "video" && nextTool !== previousTool;

/**
 * Indicates whether selecting the next tool should expand the properties column to its maximum.
 * Inputs: previous and next tool ids.
 * Output: true only for a new create-tool selection.
 */
export const shouldExpandAiShellOnToolSelect = (
  previousTool: string | null,
  nextTool: string | null
): boolean => nextTool === "create" && nextTool !== previousTool;
