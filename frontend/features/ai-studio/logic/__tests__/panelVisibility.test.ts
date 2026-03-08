/**
 * Panel visibility logic tests.
 * Verifies workflow mapping, availability-gated derivation, and per-workflow shortcut toggles.
 */
import { describe, expect, it } from "vitest";
import {
  createInitialWorkflowPanelVisibility,
  resolveEffectivePanelVisibility,
  resolveHeaderShortcutStateMap,
  resolvePanelVisibilityWorkflowKey,
  toggleWorkflowPanelVisibilityByShortcut,
} from "../panelVisibility";

describe("panelVisibility", () => {
  it("resolves workflow buckets for tool aliases", () => {
    expect(resolvePanelVisibilityWorkflowKey("create")).toBe("create");
    expect(resolvePanelVisibilityWorkflowKey("text")).toBe("create");
    expect(resolvePanelVisibilityWorkflowKey("kling")).toBe("create");
    expect(resolvePanelVisibilityWorkflowKey("edit")).toBe("edit");
    expect(resolvePanelVisibilityWorkflowKey("image")).toBe("edit");
    expect(resolvePanelVisibilityWorkflowKey("video")).toBe("video");
    expect(resolvePanelVisibilityWorkflowKey("canvas")).toBe("canvas");
    expect(resolvePanelVisibilityWorkflowKey(null)).toBe("create");
  });

  it("creates a fresh state map per initialization call", () => {
    const first = createInitialWorkflowPanelVisibility();
    const second = createInitialWorkflowPanelVisibility();

    first.create.canvas = false;

    expect(second.create.canvas).toBe(true);
  });

  it("resolves effective visibility using availability gates", () => {
    const byWorkflow = createInitialWorkflowPanelVisibility();
    const resolved = resolveEffectivePanelVisibility({
      workflowVisibility: byWorkflow.create,
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

  it("toggles shortcuts for only the active workflow and respects availability", () => {
    const initial = createInitialWorkflowPanelVisibility();
    const availability = { canvas: true, quickSlot: false, styles: true };

    const toggledCanvas = toggleWorkflowPanelVisibilityByShortcut({
      byWorkflow: initial,
      workflowKey: "edit",
      shortcutId: "canvas",
      availability,
    });
    expect(toggledCanvas.edit.canvas).toBe(false);
    expect(toggledCanvas.create.canvas).toBe(true);

    const noQuickSlotChange = toggleWorkflowPanelVisibilityByShortcut({
      byWorkflow: toggledCanvas,
      workflowKey: "edit",
      shortcutId: "quick-slot-inventory",
      availability,
    });
    expect(noQuickSlotChange).toBe(toggledCanvas);

    const toggledStyles = toggleWorkflowPanelVisibilityByShortcut({
      byWorkflow: toggledCanvas,
      workflowKey: "edit",
      shortcutId: "styles",
      availability,
    });
    expect(toggledStyles.edit.styles).toBe(true);
  });
});
