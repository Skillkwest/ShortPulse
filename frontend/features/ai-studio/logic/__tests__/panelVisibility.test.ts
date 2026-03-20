/**
 * Panel visibility logic tests.
 * Verifies global initialization, availability-gated derivation, and shortcut toggles.
 */
import { describe, expect, it } from "vitest";
import {
  createInitialPanelVisibility,
  resolveEffectivePanelVisibility,
  resolveHeaderShortcutStateMap,
  togglePanelVisibilityByShortcut,
} from "../panelVisibility";

describe("panelVisibility", () => {
  it("creates a fresh panel visibility state per initialization call", () => {
    const first = createInitialPanelVisibility();
    const second = createInitialPanelVisibility();

    first.canvas = true;

    expect(second.canvas).toBe(false);
  });

  it("resolves effective visibility using availability gates", () => {
    const panelVisibility = createInitialPanelVisibility();
    const resolved = resolveEffectivePanelVisibility({
      panelVisibility,
      availability: {
        canvas: false,
        quickSlot: true,
        styles: false,
      },
    });

    expect(resolved).toEqual({
      canvas: false,
      quickSlot: true,
      referenceGrid: true,
      styles: false,
    });
  });

  it("builds header shortcut pressed/disabled state", () => {
    const state = resolveHeaderShortcutStateMap({
      effectiveVisibility: {
        canvas: true,
        quickSlot: false,
        referenceGrid: true,
        styles: false,
      },
      availability: {
        canvas: true,
        quickSlot: false,
        styles: true,
      },
    });

    expect(state.canvas).toEqual({ pressed: true, disabled: false });
    expect(state["quick-slot-inventory"]).toEqual({ pressed: false, disabled: true });
    expect(state["reference-grid"]).toEqual({ pressed: true, disabled: false });
    expect(state.styles).toEqual({ pressed: false, disabled: false });
  });

  it("toggles shortcuts globally and respects availability", () => {
    const initial = createInitialPanelVisibility();
    const availability = { canvas: true, quickSlot: false, styles: true };

    const toggledCanvas = togglePanelVisibilityByShortcut({
      panelVisibility: initial,
      shortcutId: "canvas",
      availability,
    });
    expect(toggledCanvas.canvas).toBe(true);

    const noQuickSlotChange = togglePanelVisibilityByShortcut({
      panelVisibility: toggledCanvas,
      shortcutId: "quick-slot-inventory",
      availability,
    });
    expect(noQuickSlotChange).toBe(toggledCanvas);

    const toggledStyles = togglePanelVisibilityByShortcut({
      panelVisibility: toggledCanvas,
      shortcutId: "styles",
      availability,
    });
    expect(toggledStyles.styles).toBe(true);
  });
});
