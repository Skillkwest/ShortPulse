/**
 * AI Studio shell resize helpers.
 * Computes bounds/defaults for the properties-vs-reference split layout.
 */
import { isSoundWorkflow } from "./workflowIdentity";
import { resolvePropertiesPanelKind } from "./propertiesPanelRouting";
import type { ToolId } from "../types";

export const AI_SHELL_LEFT_MIN_PX = 640;
export const AI_SHELL_LEFT_SOUND_MIN_PX = 760;
export const AI_SHELL_LEFT_VIDEO_MIN_PX = 820;
export const AI_SHELL_LEFT_VIDEO_DEFAULT_RATIO = 0.6;
export const AI_SHELL_LEFT_CHARACTER_DEFAULT_RATIO = 0.75;
export const AI_SHELL_LEFT_CREATE_MIN_PX = 920;
export const AI_SHELL_LEFT_EXPERT_EDIT_MIN_PX = 860;
export const AI_SHELL_LEFT_PRESETS_MIN_PX = 760;
export const AI_SHELL_LEFT_CREATE_MAX_PX = 1120;
export const AI_SHELL_LEFT_CHARACTER_MIN_PX = 920;
export const AI_SHELL_LEFT_COLLAPSED_MIN_PX = 0;
export const AI_SHELL_RIGHT_MIN_PX = 440;
export const AI_SHELL_RIGHT_COLLAPSED_MIN_PX = 0;
export const AI_SHELL_RIGHT_CANVAS_MIN_PX = AI_SHELL_RIGHT_COLLAPSED_MIN_PX;
export const AI_SHELL_RIGHT_COMPACT_MIN_PX = 260;
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
  preserveMinLeftWidth?: boolean;
};

export type AiShellLayoutMode = "split" | "compact-split" | "stacked" | "right-rail-focus";

type ShellLayoutModeOptions = ShellResizeBoundsOptions & {
  enabled: boolean;
  isResizableViewport: boolean;
};

/**
 * Resolves the adaptive shell mode from measured available width.
 * Inputs: shell container width plus caller-owned minimums.
 * Output: presentation mode used by CSS and resize affordances.
 */
export const resolveAiShellLayoutMode = (
  containerWidth: number,
  options: ShellLayoutModeOptions
): AiShellLayoutMode => {
  if (!options.enabled) return "right-rail-focus";
  if (!options.isResizableViewport) return "stacked";
  if (!Number.isFinite(containerWidth) || containerWidth <= 0) return "split";

  const requestedLeftMin = Math.max(
    AI_SHELL_LEFT_MIN_FALLBACK_PX,
    options.minLeftWidthPx ?? AI_SHELL_LEFT_MIN_PX
  );
  const requestedRightMin =
    typeof options.minRightWidthPx === "number" && Number.isFinite(options.minRightWidthPx)
      ? Math.max(0, Math.floor(options.minRightWidthPx))
      : AI_SHELL_RIGHT_MIN_PX;
  const fullSplitMin = requestedLeftMin + requestedRightMin + AI_SHELL_DIVIDER_TRACK_PX;
  if (containerWidth >= fullSplitMin) return "split";

  const compactSplitMin =
    AI_SHELL_LEFT_MIN_FALLBACK_PX + AI_SHELL_RIGHT_COMPACT_MIN_PX + AI_SHELL_DIVIDER_TRACK_PX;
  if (containerWidth >= compactSplitMin) return "compact-split";

  return "stacked";
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
  const constrainedMin = Math.min(
    requestedMin,
    Math.max(
      AI_SHELL_LEFT_MIN_FALLBACK_PX,
      safeContainerWidth - minRightWidthPx - AI_SHELL_DIVIDER_TRACK_PX
    )
  );
  const min = options?.preserveMinLeftWidth === true ? requestedMin : constrainedMin;
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
 * Indicates whether entering the Sound workspace should open at minimum width.
 * Inputs: previous and next tool ids.
 * Output: true only when crossing into the sound tool family from a non-sound tool.
 */
export const shouldCollapseAiShellOnInitialSoundSelection = (
  previousTool: ToolId | null,
  nextTool: ToolId | null
): boolean =>
  previousTool !== nextTool && isSoundWorkflow(nextTool) && !isSoundWorkflow(previousTool);

/**
 * Indicates whether entering the shared Expert Edit panel family should open at minimum width.
 * Inputs: previous and next tool ids.
 * Output: true when crossing from a non-edit-panel tool into the edit/image panel family.
 */
export const shouldCollapseAiShellOnExpertEditPanelSelect = (
  previousTool: ToolId | null,
  nextTool: ToolId | null
): boolean =>
  resolvePropertiesPanelKind(nextTool) === "edit" &&
  resolvePropertiesPanelKind(previousTool) !== "edit";

/**
 * Indicates whether selecting the next tool should expand the properties column to its maximum.
 * Inputs: previous and next tool ids.
 * Output: true only for a new create-tool selection.
 */
export const shouldExpandAiShellOnToolSelect = (
  previousTool: string | null,
  nextTool: string | null
): boolean => nextTool === "create" && nextTool !== previousTool;

/**
 * Indicates whether selecting the next toolbar tab should move the shell divider
 * back to that tab's computed default position.
 */
export const shouldResetAiShellToDefaultOnToolSelect = (
  previousTool: ToolId | null,
  nextTool: ToolId | null
): boolean => {
  if (previousTool === nextTool || nextTool == null) return false;
  return (
    nextTool === "create" ||
    nextTool === "text" ||
    nextTool === "edit" ||
    nextTool === "image" ||
    nextTool === "video" ||
    nextTool === "kling" ||
    nextTool === "sound" ||
    nextTool === "media-library" ||
    nextTool === "character" ||
    nextTool === "elements" ||
    nextTool === "presets" ||
    nextTool === "styles"
  );
};

/**
 * Resolves the shell resize action for Create based on tool navigation and mode changes.
 */
export const resolveCreateShellResizeAction = ({
  previousTool,
  nextTool,
  previousMode,
  nextMode,
  createModeEnabled,
}: {
  previousTool: string | null;
  nextTool: string | null;
  previousMode: "standard" | "pulse";
  nextMode: "standard" | "pulse";
  createModeEnabled: boolean;
}): "collapse" | null => {
  if (!createModeEnabled || nextTool !== "create") return null;
  const isEnteringCreate = shouldExpandAiShellOnToolSelect(previousTool, nextTool);
  const isModeChangeWhileInCreate = previousTool === "create" && previousMode !== nextMode;
  if (!isEnteringCreate && !isModeChangeWhileInCreate) return null;
  if (isEnteringCreate) return "collapse";
  return nextMode === "standard" ? "collapse" : null;
};

/**
 * Indicates whether a new Create session should re-collapse the shell.
 */
export const shouldCollapseCreateOnSessionChange = ({
  previousSessionId,
  nextSessionId,
  nextTool,
  createModeEnabled,
}: {
  previousSessionId: string | null;
  nextSessionId: string | null;
  nextTool: string | null;
  nextMode: "standard" | "pulse";
  createModeEnabled: boolean;
}): boolean => previousSessionId !== nextSessionId && nextTool === "create" && createModeEnabled;
