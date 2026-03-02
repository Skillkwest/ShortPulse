import { describe, expect, it } from "vitest";
import { computeMediaVirtualLayout } from "../mediaGridVirtualization";

const makeItems = (aspects: number[]) =>
  aspects.map((aspectRatio, index) => ({
    id: `item-${index + 1}`,
    aspectRatio,
  }));

describe("mediaGridVirtualization", () => {
  it("computes stable masonry order for mixed aspect ratios", () => {
    const layout = computeMediaVirtualLayout({
      items: makeItems([1.6, 1, 0.75, 1.2, 0.9, 1.8]),
      containerWidth: 900,
      viewportTop: 0,
      viewportHeight: 1200,
      targetColumnWidth: 220,
      gap: 8,
      overscanPx: 0,
    });

    expect(layout.columnCount).toBeGreaterThan(1);
    expect(layout.items.map((entry) => entry.id)).toEqual([
      "item-1",
      "item-2",
      "item-3",
      "item-4",
      "item-5",
      "item-6",
    ]);
    expect(layout.totalHeight).toBeGreaterThan(0);
  });

  it("reflows columns when container width changes", () => {
    const items = makeItems([1, 1, 1, 1, 1, 1, 1, 1]);
    const narrow = computeMediaVirtualLayout({
      items,
      containerWidth: 520,
      viewportTop: 0,
      viewportHeight: 800,
      targetColumnWidth: 220,
      gap: 8,
      overscanPx: 0,
    });
    const wide = computeMediaVirtualLayout({
      items,
      containerWidth: 1200,
      viewportTop: 0,
      viewportHeight: 800,
      targetColumnWidth: 220,
      gap: 8,
      overscanPx: 0,
    });

    expect(wide.columnCount).toBeGreaterThan(narrow.columnCount);
    expect(wide.columnWidth).toBeGreaterThan(0);
    expect(narrow.columnWidth).toBeGreaterThan(0);
  });

  it("applies overscan bounds to visible windows", () => {
    const layoutNoOverscan = computeMediaVirtualLayout({
      items: makeItems(new Array(40).fill(1)),
      containerWidth: 900,
      viewportTop: 900,
      viewportHeight: 300,
      targetColumnWidth: 220,
      gap: 8,
      overscanPx: 0,
    });
    const layoutOverscan = computeMediaVirtualLayout({
      items: makeItems(new Array(40).fill(1)),
      containerWidth: 900,
      viewportTop: 900,
      viewportHeight: 300,
      targetColumnWidth: 220,
      gap: 8,
      overscanPx: 500,
    });

    expect(layoutOverscan.visibleItems.length).toBeGreaterThan(
      layoutNoOverscan.visibleItems.length
    );
  });

  it("keeps visible ordering stable within the virtual window", () => {
    const layout = computeMediaVirtualLayout({
      items: makeItems([1.3, 1.1, 0.8, 1.4, 1, 0.7, 1.6, 1.2]),
      containerWidth: 840,
      viewportTop: 0,
      viewportHeight: 600,
      targetColumnWidth: 220,
      gap: 8,
      overscanPx: 120,
    });
    const indexes = layout.visibleItems.map((entry) => entry.index);

    expect(indexes).toEqual([...indexes].sort((left, right) => left - right));
  });
});
