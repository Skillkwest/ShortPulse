/**
 * Panel visibility logic tests.
 * Verifies global initialization, availability-gated derivation, and shortcut toggles.
 */
import { describe, expect, it } from "vitest";
import {
  createInitialPanelVisibility,
  resolveExpandedRightRailVisibility,
  resolveEffectivePanelVisibility,
  resolveHeaderShortcutStateMap,
  togglePanelVisibilityByShortcut,
} from "../panelVisibility";

describe("panelVisibility", () => {
  it("creates a fresh panel visibility state per initialization call", () => {
    const first = createInitialPanelVisibility();
    const second = createInitialPanelVisibility();

    first.quickSlot = false;

    expect(second.quickSlot).toBe(true);
  });

  it("resolves effective visibility using availability gates", () => {
    const panelVisibility = createInitialPanelVisibility();
    const resolved = resolveEffectivePanelVisibility({
      panelVisibility,
      availability: {
        quickSlot: true,
        styles: false,
      },
    });

    expect(resolved).toEqual({
      quickSlot: true,
      referenceGrid: true,
      styles: false,
    });
  });

  it("builds header shortcut pressed/disabled state", () => {
    const state = resolveHeaderShortcutStateMap({
      effectiveVisibility: {
        quickSlot: false,
        referenceGrid: true,
        styles: false,
      },
      availability: {
        quickSlot: false,
        styles: true,
      },
    });

    expect(state["quick-slot-inventory"]).toEqual({ pressed: false, disabled: true });
    expect(state["reference-grid"]).toEqual({ pressed: true, disabled: false });
    expect(state.styles).toEqual({ pressed: false, disabled: false });
  });

  it("toggles shortcuts globally and respects availability", () => {
    const initial = createInitialPanelVisibility();
    const availability = { quickSlot: false, styles: true };

    const noQuickSlotChange = togglePanelVisibilityByShortcut({
      panelVisibility: initial,
      shortcutId: "quick-slot-inventory",
      availability,
    });
    expect(noQuickSlotChange).toBe(initial);

    const toggledStyles = togglePanelVisibilityByShortcut({
      panelVisibility: initial,
      shortcutId: "styles",
      availability,
    });
    expect(toggledStyles.styles).toBe(true);
  });

  it.each([
    [
      "canvas",
      {
        isCanvasVisible: true,
        panelVisibility: { quickSlot: false, referenceGrid: false, styles: false },
      },
    ],
    [
      "quick-slot-inventory",
      {
        isCanvasVisible: false,
        panelVisibility: { quickSlot: true, referenceGrid: false, styles: false },
      },
    ],
    [
      "reference-grid",
      {
        isCanvasVisible: false,
        panelVisibility: { quickSlot: false, referenceGrid: true, styles: false },
      },
    ],
  ] as const)("resolves exclusive expand visibility for %s", (target, expected) => {
    expect(
      resolveExpandedRightRailVisibility({
        target,
        availability: { quickSlot: true, styles: true },
      })
    ).toEqual(expected);
  });
});
