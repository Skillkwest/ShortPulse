/**
 * AI Studio right-rail panel visibility domain helpers.
 * Centralizes global visibility state, derived render visibility, and header toggle behavior.
 */

export type HeaderShortcutId = "canvas" | "quick-slot-inventory" | "reference-grid" | "styles";
export type PanelVisibilityState = {
  canvas: boolean;
  quickSlot: boolean;
  referenceGrid: boolean;
  styles: boolean;
};
export type PanelToggleAvailability = {
  canvas: boolean;
  quickSlot: boolean;
  styles: boolean;
};
export type EffectivePanelVisibility = {
  canvas: boolean;
  quickSlot: boolean;
  referenceGrid: boolean;
  styles: boolean;
};
export type HeaderShortcutState = {
  pressed: boolean;
  disabled: boolean;
};
export type HeaderShortcutStateMap = Record<HeaderShortcutId, HeaderShortcutState>;

const DEFAULT_PANEL_VISIBILITY_STATE: PanelVisibilityState = {
  // Canvas rail panel starts hidden by default on fresh loads/sessions.
  canvas: false,
  quickSlot: true,
  referenceGrid: true,
  styles: false,
};

const clonePanelVisibilityState = (state: PanelVisibilityState): PanelVisibilityState => ({
  canvas: state.canvas,
  quickSlot: state.quickSlot,
  referenceGrid: state.referenceGrid,
  styles: state.styles,
});

/**
 * Creates a fresh visibility snapshot for local UI state initialization.
 */
export const createInitialPanelVisibility = (): PanelVisibilityState =>
  clonePanelVisibilityState(DEFAULT_PANEL_VISIBILITY_STATE);

/**
 * Applies runtime availability gates to panel visibility to produce render visibility.
 */
export const resolveEffectivePanelVisibility = ({
  panelVisibility,
  availability,
}: {
  panelVisibility: PanelVisibilityState;
  availability: PanelToggleAvailability;
}): EffectivePanelVisibility => ({
  canvas: availability.canvas && panelVisibility.canvas,
  quickSlot: availability.quickSlot && panelVisibility.quickSlot,
  referenceGrid: panelVisibility.referenceGrid,
  styles: availability.styles && panelVisibility.styles,
});

/**
 * Computes header toggle pressed/disabled state from effective visibility and availability.
 */
export const resolveHeaderShortcutStateMap = ({
  effectiveVisibility,
  availability,
}: {
  effectiveVisibility: EffectivePanelVisibility;
  availability: PanelToggleAvailability;
}): HeaderShortcutStateMap => ({
  canvas: {
    pressed: effectiveVisibility.canvas,
    disabled: !availability.canvas,
  },
  "quick-slot-inventory": {
    pressed: effectiveVisibility.quickSlot,
    disabled: !availability.quickSlot,
  },
  "reference-grid": {
    pressed: effectiveVisibility.referenceGrid,
    disabled: false,
  },
  styles: {
    pressed: effectiveVisibility.styles,
    disabled: !availability.styles,
  },
});

/**
 * Toggles a single header shortcut while respecting toggle availability.
 */
export const togglePanelVisibilityByShortcut = ({
  panelVisibility,
  shortcutId,
  availability,
}: {
  panelVisibility: PanelVisibilityState;
  shortcutId: HeaderShortcutId;
  availability: PanelToggleAvailability;
}): PanelVisibilityState => {
  if (shortcutId === "styles") {
    if (!availability.styles) return panelVisibility;
    return {
      ...panelVisibility,
      styles: !panelVisibility.styles,
    };
  }
  if (shortcutId === "canvas" && !availability.canvas) return panelVisibility;
  if (shortcutId === "quick-slot-inventory" && !availability.quickSlot) return panelVisibility;
  return {
    ...panelVisibility,
    canvas: shortcutId === "canvas" ? !panelVisibility.canvas : panelVisibility.canvas,
    quickSlot:
      shortcutId === "quick-slot-inventory"
        ? !panelVisibility.quickSlot
        : panelVisibility.quickSlot,
    referenceGrid:
      shortcutId === "reference-grid"
        ? !panelVisibility.referenceGrid
        : panelVisibility.referenceGrid,
  };
};
