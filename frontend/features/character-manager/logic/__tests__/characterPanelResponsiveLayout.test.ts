import { describe, expect, it } from "vitest";
import { resolveCharacterPanelResponsiveLayout } from "../characterPanelResponsiveLayout";

describe("resolveCharacterPanelResponsiveLayout", () => {
  it("grows vertical spacing and editable surfaces as the panel height increases", () => {
    const compact = resolveCharacterPanelResponsiveLayout({
      panelWidthPx: 560,
      panelHeightPx: 260,
      isEmbeddedMediaLibraryMaximized: false,
    });
    const expanded = resolveCharacterPanelResponsiveLayout({
      panelWidthPx: 560,
      panelHeightPx: 520,
      isEmbeddedMediaLibraryMaximized: false,
    });

    expect(expanded.contentPaddingTopPx).toBeGreaterThan(compact.contentPaddingTopPx);
    expect(expanded.descriptionHeightPx).toBeGreaterThan(compact.descriptionHeightPx);
    expect(expanded.referenceCardMaxWidthPx).toBeGreaterThan(compact.referenceCardMaxWidthPx);
    expect(expanded.referenceHintMinHeightPx).toBeGreaterThan(compact.referenceHintMinHeightPx);
  });

  it("keeps narrow panels in a more compact sizing mode", () => {
    const narrow = resolveCharacterPanelResponsiveLayout({
      panelWidthPx: 420,
      panelHeightPx: 360,
      isEmbeddedMediaLibraryMaximized: false,
    });
    const wide = resolveCharacterPanelResponsiveLayout({
      panelWidthPx: 760,
      panelHeightPx: 360,
      isEmbeddedMediaLibraryMaximized: false,
    });

    expect(narrow.isCompactWidth).toBe(true);
    expect(wide.isCompactWidth).toBe(false);
    expect(wide.actionButtonMinWidthPx).toBeGreaterThan(narrow.actionButtonMinWidthPx);
    expect(wide.looksTabMinWidthPx).toBeGreaterThan(narrow.looksTabMinWidthPx);
  });

  it("biases reference sizing upward when the media library is maximized", () => {
    const defaultLayout = resolveCharacterPanelResponsiveLayout({
      panelWidthPx: 600,
      panelHeightPx: 420,
      isEmbeddedMediaLibraryMaximized: false,
    });
    const maximizedLayout = resolveCharacterPanelResponsiveLayout({
      panelWidthPx: 600,
      panelHeightPx: 420,
      isEmbeddedMediaLibraryMaximized: true,
    });

    expect(maximizedLayout.referenceCardMaxWidthPx).toBeGreaterThanOrEqual(
      defaultLayout.referenceCardMaxWidthPx
    );
  });
});
