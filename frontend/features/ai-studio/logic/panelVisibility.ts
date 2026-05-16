/**
 * AI Studio right-rail panel visibility domain helpers.
 * Centralizes global visibility state, derived render visibility, and header toggle behavior.
 */

export type HeaderShortcutId = "quick-slot-inventory" | "reference-grid" | "styles";
export type ExpandableRightRailHeaderButtonId =
  | "canvas"
  | "quick-slot-inventory"
  | "reference-grid";
export type PanelVisibilityState = {
  quickSlot: boolean;
  referenceGrid: boolean;
  styles: boolean;
};
export type PanelToggleAvailability = {
  quickSlot: boolean;
  styles: boolean;
};
export type EffectivePanelVisibility = {
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
  quickSlot: true,
  referenceGrid: true,
  styles: false,
};

const clonePanelVisibilityState = (state: PanelVisibilityState): PanelVisibilityState => ({
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
}): HeaderShortcutStateMap => {
  const activeShortcutId: HeaderShortcutId | null = effectiveVisibility.quickSlot
    ? "quick-slot-inventory"
    : effectiveVisibility.referenceGrid
      ? "reference-grid"
      : effectiveVisibility.styles
        ? "styles"
        : null;
  return {
    "quick-slot-inventory": {
      pressed: activeShortcutId === "quick-slot-inventory",
      disabled: !availability.quickSlot,
    },
    "reference-grid": {
      pressed: activeShortcutId === "reference-grid",
      disabled: false,
    },
    styles: {
      pressed: activeShortcutId === "styles",
      disabled: !availability.styles,
    },
  };
};

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
  if (shortcutId === "quick-slot-inventory") {
    if (!availability.quickSlot) return panelVisibility;
    return {
      ...panelVisibility,
      quickSlot: true,
      referenceGrid: false,
    };
  }
  return {
    ...panelVisibility,
    quickSlot: false,
    referenceGrid: true,
  };
};

/**
 * Resolves the exclusive right-rail state used by header-button expand mode.
 */
export const resolveExpandedRightRailVisibility = ({
  target,
  availability,
}: {
  target: ExpandableRightRailHeaderButtonId;
  availability: PanelToggleAvailability;
}): {
  isCanvasVisible: boolean;
  panelVisibility: PanelVisibilityState;
} => ({
  isCanvasVisible: target === "canvas",
  panelVisibility: {
    quickSlot: target === "quick-slot-inventory" && availability.quickSlot,
    referenceGrid: target === "reference-grid",
    styles: false,
  },
});
