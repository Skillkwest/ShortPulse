import { describe, expect, it } from "vitest";
import {
  computeMediaVirtualLayout,
  computeMediaVirtualLayoutFrame,
  resolveVisibleMediaVirtualItems,
} from "../mediaGridVirtualization";

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
    expect(layout.visibleItems.map((entry) => entry.id)).toEqual([
      "item-1",
      "item-2",
      "item-3",
      "item-4",
      "item-5",
      "item-6",
    ]);
    expect(layout.totalHeight).toBeGreaterThan(0);
  });

  it("can preserve chronological row order for display-scanned media grids", () => {
    const layout = computeMediaVirtualLayout({
      items: makeItems([0.5, 2, 0.75, 1.4, 3, 0.8]),
      containerWidth: 900,
      viewportTop: 0,
      viewportHeight: 1200,
      targetColumnWidth: 220,
      gap: 8,
      overscanPx: 0,
      layoutMode: "chronological-grid",
    });

    expect(layout.columnCount).toBe(3);
    expect(layout.visibleItems.map((entry) => entry.id)).toEqual([
      "item-1",
      "item-2",
      "item-3",
      "item-4",
      "item-5",
      "item-6",
    ]);
    expect(layout.visibleItems.slice(0, 3).map((entry) => entry.top)).toEqual([0, 0, 0]);
    expect(layout.visibleItems[3]?.top).toBeGreaterThan(layout.visibleItems[0]?.top ?? 0);
    expect(layout.visibleItems[4]?.top).toBe(layout.visibleItems[3]?.top);
    expect(layout.visibleItems[5]?.top).toBe(layout.visibleItems[3]?.top);
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

  it("caps wide panel layouts when a max column count is provided", () => {
    const layout = computeMediaVirtualLayout({
      items: makeItems(new Array(24).fill(1)),
      containerWidth: 1600,
      viewportTop: 0,
      viewportHeight: 800,
      targetColumnWidth: 188,
      maxColumnCount: 5,
      gap: 1,
      overscanPx: 0,
    });

    expect(layout.columnCount).toBe(5);
    expect(layout.columnWidth).toBeCloseTo((1600 - 4) / 5);
  });

  it("keeps fewer columns when the panel is below the five-column width threshold", () => {
    const layout = computeMediaVirtualLayout({
      items: makeItems(new Array(24).fill(1)),
      containerWidth: 800,
      viewportTop: 0,
      viewportHeight: 800,
      targetColumnWidth: 188,
      maxColumnCount: 5,
      gap: 1,
      overscanPx: 0,
    });

    expect(layout.columnCount).toBe(4);
  });

  it("reaches five columns at the current panel minimum width threshold", () => {
    const layout = computeMediaVirtualLayout({
      items: makeItems(new Array(24).fill(1)),
      containerWidth: 944,
      viewportTop: 0,
      viewportHeight: 800,
      targetColumnWidth: 188,
      maxColumnCount: 5,
      gap: 1,
      overscanPx: 0,
    });

    expect(layout.columnCount).toBe(5);
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

  it("reuses full-layout coordinates across different viewport windows", () => {
    const frame = computeMediaVirtualLayoutFrame({
      items: makeItems(new Array(24).fill(1)),
      containerWidth: 900,
      targetColumnWidth: 220,
      gap: 8,
    });
    const upperWindow = resolveVisibleMediaVirtualItems({
      layout: frame,
      viewportTop: 0,
      viewportHeight: 300,
      overscanPx: 0,
    });
    const lowerWindow = resolveVisibleMediaVirtualItems({
      layout: frame,
      viewportTop: 900,
      viewportHeight: 300,
      overscanPx: 0,
    });

    expect(frame.items).toHaveLength(24);
    expect(upperWindow.length).toBeGreaterThan(0);
    expect(lowerWindow.length).toBeGreaterThan(0);
    expect(upperWindow.map((entry) => entry.id)).not.toEqual(lowerWindow.map((entry) => entry.id));
  });
});
