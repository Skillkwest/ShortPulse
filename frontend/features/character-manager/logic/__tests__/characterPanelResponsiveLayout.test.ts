import { describe, expect, it } from "vitest";
import { resolveCharacterPanelResponsiveLayout } from "../characterPanelResponsiveLayout";

describe("resolveCharacterPanelResponsiveLayout", () => {
  it("keeps narrow panels in a more compact sizing mode", () => {
    const narrow = resolveCharacterPanelResponsiveLayout({
      panelWidthPx: 420,
    });
    const wide = resolveCharacterPanelResponsiveLayout({
      panelWidthPx: 760,
    });

    expect(narrow.isCompactWidth).toBe(true);
    expect(wide.isCompactWidth).toBe(false);
    expect(wide.actionButtonMinWidthPx).toBeGreaterThan(narrow.actionButtonMinWidthPx);
    expect(wide.looksTabMinWidthPx).toBeGreaterThan(narrow.looksTabMinWidthPx);
  });

  it("matches the description box height to the reference card height", () => {
    const layout = resolveCharacterPanelResponsiveLayout({
      panelWidthPx: 640,
    });

    expect(layout.descriptionHeightPx).toBe(Math.round(layout.referenceCardMaxWidthPx * (5 / 4)));
  });
});
