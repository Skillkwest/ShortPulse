/**
 * Shared interaction-mode types for the Expert Edit inpaint runtime.
 * Keeps paint/selection mode ownership out of individual controller seams.
 */
export type InpaintPaintMode = "brush" | "lasso" | "auto";
export type InpaintSelectionMode = "select" | "unselect";
