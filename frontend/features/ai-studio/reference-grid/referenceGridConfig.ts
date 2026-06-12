/**
 * Shared Reference Grid config and helper exports.
 * Keeps view/controller constants out of the top-level grid component so size-budgeted surfaces stay orchestration-only.
 */
import type { StudioOutput, ToolId } from "../types";

export const REFERENCE_VIRTUAL_OVERSCAN_ROWS = 4;
export const REFERENCE_VIRTUALIZE_MIN_ITEMS = 12;
export const FALLBACK_REFERENCE_ROW_HEIGHT = 220;
export const REFERENCE_GRID_MIN_CARD_PX = 124;
export const REFERENCE_GRID_MIN_CARD_PX_WIDE = 124;
export const REFERENCE_GRID_MIN_COLUMNS = 2;
export const REFERENCE_GRID_MAX_COLUMNS = 6;
export const REFERENCE_GRID_MAX_COLUMNS_WIDE = 8;
export const QUICK_SLOT_INVENTORY_MAX_COLUMNS = 8;
export const REFERENCE_AUTOPLAY_VISIBILITY_THRESHOLD = 0.6;
export const REFERENCE_AUTOPLAY_MAX_DESKTOP = 3;
export const REFERENCE_AUTOPLAY_MAX_SMALL_SCREEN = 2;
export const REFERENCE_AUTOPLAY_MAX_CONSTRAINED = 1;
export const REFERENCE_AUTOPLAY_SMALL_SCREEN_QUERY = "(max-width: 900px)";
export const REFERENCE_AUTOPLAY_DETACH_DELAY_MS = 1400;
export const REFERENCE_HIGH_DENSITY_CARD_COUNT = 180;
export const REFERENCE_PRIORITY_HYDRATION_ROWS = 3;
export const DEFAULT_CURATED_SPLIT_TOP_RATIO = 0.28;
export const DEFAULT_STYLES_SPLIT_TOP_RATIO = 0.3;
export const STYLES_REFERENCE_GRID_COLLAPSE_TOP_HEIGHT_PX = 22;
export const STYLES_MIN_BOTTOM_SECTION_HEIGHT_PX_REFERENCE_GRID = 132;
export const STYLES_MIN_BOTTOM_SECTION_HEIGHT_PX_QUICK_SLOT = 96;
export const STYLES_MIN_BOTTOM_HEADER_BUFFER_PX_REFERENCE_GRID = 84;
export const STYLES_MIN_BOTTOM_HEADER_BUFFER_PX_QUICK_SLOT = 52;
export const HORIZONTAL_DIVIDER_TRACK_MIN_HEIGHT_PX = 14;
export const CURATED_MIN_BOTTOM_STACK_HEIGHT_PX = 12;

export type ReferenceSelectionTheme = "create" | "edit" | "video" | "sound";

export type ReferenceGridPanelVisibility = {
  quickSlot: boolean;
  referenceGrid: boolean;
  styles: boolean;
};

export const DEFAULT_PANEL_VISIBILITY: ReferenceGridPanelVisibility = {
  quickSlot: true,
  referenceGrid: true,
  styles: false,
};

export const EMPTY_OUTPUTS: StudioOutput[] = [];

/**
 * Resolves the reference-grid selection theme from the active tool.
 */
export const resolveReferenceSelectionTheme = (
  selectedTool: ToolId | null
): ReferenceSelectionTheme => {
  if (selectedTool === "image" || selectedTool === "edit") return "edit";
  if (selectedTool === "video" || selectedTool === "kling") return "video";
  if (
    selectedTool === "sound" ||
    selectedTool === "voices" ||
    selectedTool === "text-to-speech" ||
    selectedTool === "voice-changer" ||
    selectedTool === "sound-effects" ||
    selectedTool === "music"
  ) {
    return "sound";
  }
  return "create";
};

/**
 * Provides a stable list-identity comparator for output-store selectors.
 */
export const areOutputListsEqual = (left: StudioOutput[], right: StudioOutput[]) => {
  if (left === right) return true;
  if (left.length !== right.length) return false;
  return left.every((item, index) => item === right[index]);
};
