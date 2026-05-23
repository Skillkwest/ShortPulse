/**
 * Panel visibility logic tests.
 * Verifies global initialization, availability-gated derivation, independent shortcut toggles,
 * and the separate isolate-mode visibility contract.
 */
import { describe, expect, it } from "vitest";
import {
  createInitialPanelVisibility,
  resolveExpandedRightRailVisibility,
  resolveEffectivePanelVisibility,
  resolveHeaderShortcutStateMap,
  togglePanelVisibilityByShortcut,
} from "../panelVisibility";

const AVAILABLE_TOGGLES = { quickSlot: true, styles: true } as const;

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

  it("builds header shortcut pressed state from actual visible sections", () => {
    const state = resolveHeaderShortcutStateMap({
      effectiveVisibility: {
        quickSlot: true,
        referenceGrid: true,
        styles: true,
      },
      availability: {
        quickSlot: true,
        styles: true,
      },
    });

    expect(state["quick-slot-inventory"]).toEqual({ pressed: true, disabled: false });
    expect(state["reference-grid"]).toEqual({ pressed: true, disabled: false });
    expect(state.styles).toEqual({ pressed: true, disabled: false });
  });

  it("selects named shortcut surfaces and respects availability", () => {
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

  it("toggles quick slot inventory independently", () => {
    expect(
      togglePanelVisibilityByShortcut({
        panelVisibility: {
          quickSlot: false,
          referenceGrid: true,
          styles: true,
        },
        shortcutId: "quick-slot-inventory",
        availability: AVAILABLE_TOGGLES,
      })
    ).toEqual({
      quickSlot: true,
      referenceGrid: true,
      styles: true,
    });
  });

  it("toggles reference grid independently", () => {
    expect(
      togglePanelVisibilityByShortcut({
        panelVisibility: {
          quickSlot: true,
          referenceGrid: false,
          styles: true,
        },
        shortcutId: "reference-grid",
        availability: AVAILABLE_TOGGLES,
      })
    ).toEqual({
      quickSlot: true,
      referenceGrid: true,
      styles: true,
    });
  });

  it("can reach every normal-mode quick-slot/reference-grid combination from the default state", () => {
    const seen = new Set<string>();
    const queue = [createInitialPanelVisibility()];

    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) continue;
      const key = `${next.quickSlot ? 1 : 0}${next.referenceGrid ? 1 : 0}`;
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push(
        togglePanelVisibilityByShortcut({
          panelVisibility: next,
          shortcutId: "quick-slot-inventory",
          availability: AVAILABLE_TOGGLES,
        })
      );
      queue.push(
        togglePanelVisibilityByShortcut({
          panelVisibility: next,
          shortcutId: "reference-grid",
          availability: AVAILABLE_TOGGLES,
        })
      );
    }

    expect([...seen].sort()).toEqual(["00", "01", "10", "11"]);
  });

  it("supports all 8 canvas, quick-slot, and reference-grid normal-mode combinations", () => {
    const seen = new Set<string>();
    const queue = [{ canvasVisible: false, panelVisibility: createInitialPanelVisibility() }];

    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) continue;
      const key = `${next.canvasVisible ? 1 : 0}${next.panelVisibility.quickSlot ? 1 : 0}${next.panelVisibility.referenceGrid ? 1 : 0}`;
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({
        canvasVisible: !next.canvasVisible,
        panelVisibility: next.panelVisibility,
      });
      queue.push({
        canvasVisible: next.canvasVisible,
        panelVisibility: togglePanelVisibilityByShortcut({
          panelVisibility: next.panelVisibility,
          shortcutId: "quick-slot-inventory",
          availability: AVAILABLE_TOGGLES,
        }),
      });
      queue.push({
        canvasVisible: next.canvasVisible,
        panelVisibility: togglePanelVisibilityByShortcut({
          panelVisibility: next.panelVisibility,
          shortcutId: "reference-grid",
          availability: AVAILABLE_TOGGLES,
        }),
      });
    }

    expect([...seen].sort()).toEqual(["000", "001", "010", "011", "100", "101", "110", "111"]);
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
        availability: AVAILABLE_TOGGLES,
      })
    ).toEqual(expected);
  });
});
