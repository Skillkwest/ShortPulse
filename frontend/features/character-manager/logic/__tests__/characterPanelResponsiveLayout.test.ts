import { describe, expect, it } from "vitest";
import { resolveCharacterPanelResponsiveLayout } from "../characterPanelResponsiveLayout";

describe("resolveCharacterPanelResponsiveLayout", () => {
  it("keeps upper-panel sizing stable when only the panel height changes", () => {
    const compact = resolveCharacterPanelResponsiveLayout({
      panelWidthPx: 560,
      panelHeightPx: 260,
    });
    const expanded = resolveCharacterPanelResponsiveLayout({
      panelWidthPx: 560,
      panelHeightPx: 520,
    });

    expect(expanded.contentPaddingTopPx).toBe(compact.contentPaddingTopPx);
    expect(expanded.descriptionHeightPx).toBe(compact.descriptionHeightPx);
    expect(expanded.referenceCardMaxWidthPx).toBe(compact.referenceCardMaxWidthPx);
    expect(expanded.referenceHintMinHeightPx).toBe(compact.referenceHintMinHeightPx);
  });

  it("keeps narrow panels in a more compact sizing mode", () => {
    const narrow = resolveCharacterPanelResponsiveLayout({
      panelWidthPx: 420,
      panelHeightPx: 360,
    });
    const wide = resolveCharacterPanelResponsiveLayout({
      panelWidthPx: 760,
      panelHeightPx: 360,
    });

    expect(narrow.isCompactWidth).toBe(true);
    expect(wide.isCompactWidth).toBe(false);
    expect(wide.actionButtonMinWidthPx).toBeGreaterThan(narrow.actionButtonMinWidthPx);
    expect(wide.looksTabMinWidthPx).toBeGreaterThan(narrow.looksTabMinWidthPx);
  });

  it("matches the description box height to the reference card height", () => {
    const layout = resolveCharacterPanelResponsiveLayout({
      panelWidthPx: 640,
      panelHeightPx: 420,
    });

    expect(layout.descriptionHeightPx).toBe(Math.round(layout.referenceCardMaxWidthPx * (5 / 4)));
  });
});
