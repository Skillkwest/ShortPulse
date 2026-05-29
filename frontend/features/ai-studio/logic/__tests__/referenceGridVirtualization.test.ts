import { describe, expect, it } from "vitest";
import {
  calculateReferenceGridWindow,
  resolveReferenceGridDensityPressureLevel,
  resolveReferenceGridMaxColumns,
  resolveReferenceGridOverscanRows,
  resolveReferenceGridPrependAnchorScrollTop,
} from "../referenceGridVirtualization";

describe("referenceGridVirtualization", () => {
  it("resolves adaptive overscan rows for 20/50/60/100/300 scenarios", () => {
    expect(resolveReferenceGridOverscanRows(20)).toBe(2);
    expect(resolveReferenceGridOverscanRows(50)).toBe(0);
    expect(resolveReferenceGridOverscanRows(60)).toBe(1);
    expect(resolveReferenceGridOverscanRows(100)).toBe(1);
    expect(resolveReferenceGridOverscanRows(300)).toBe(1);
    expect(resolveReferenceGridOverscanRows(50, { pressureLevel: 2 })).toBe(0);
    expect(resolveReferenceGridOverscanRows(300, { pressureLevel: 1 })).toBe(0);
  });

  it("caps wide column counts in high-density modes", () => {
    expect(
      resolveReferenceGridMaxColumns({
        requestedMaxColumns: 8,
        itemCount: 20,
        pressureLevel: 0,
      })
    ).toBe(8);
    expect(
      resolveReferenceGridMaxColumns({
        requestedMaxColumns: 8,
        itemCount: 60,
        pressureLevel: 0,
      })
    ).toBe(4);
    expect(
      resolveReferenceGridMaxColumns({
        requestedMaxColumns: 8,
        itemCount: 60,
        pressureLevel: 2,
      })
    ).toBe(3);
  });

  it("resolves density pressure before watchdog samples under large grids", () => {
    expect(resolveReferenceGridDensityPressureLevel({ itemCount: 80 })).toBe(0);
    expect(resolveReferenceGridDensityPressureLevel({ itemCount: 120 })).toBe(1);
    expect(resolveReferenceGridDensityPressureLevel({ itemCount: 240 })).toBe(2);
    expect(
      resolveReferenceGridDensityPressureLevel({
        itemCount: 20,
        curatedItemCount: 240,
      })
    ).toBe(2);
  });

  it("disables virtualization below threshold", () => {
    const window = calculateReferenceGridWindow({
      itemCount: 10,
      columnCount: 5,
      rowHeight: 200,
      scrollTop: 0,
      viewportHeight: 600,
      overscanRows: 2,
    });

    expect(window.shouldVirtualize).toBe(false);
    expect(window.startIndex).toBe(0);
    expect(window.endIndex).toBe(10);
  });

  it("returns bounded index windows for larger counts", () => {
    const window = calculateReferenceGridWindow({
      itemCount: 300,
      columnCount: 5,
      rowHeight: 200,
      scrollTop: 2400,
      viewportHeight: 800,
      overscanRows: 1,
    });

    expect(window.shouldVirtualize).toBe(true);
    expect(window.startIndex).toBeGreaterThanOrEqual(0);
    expect(window.endIndex).toBeLessThanOrEqual(300);
    expect(window.endIndex).toBeGreaterThan(window.startIndex);
    expect(window.topSpacerHeight).toBeGreaterThanOrEqual(0);
    expect(window.bottomSpacerHeight).toBeGreaterThanOrEqual(0);
  });

  it("pins prepends to the top when the user is already at the top", () => {
    expect(
      resolveReferenceGridPrependAnchorScrollTop({
        previousOutputIds: ["out-1", "out-2"],
        nextOutputIds: ["out-new", "out-1", "out-2"],
        previousScrollTop: 0,
        measuredScrollTop: 180,
        previousColumnCount: 2,
        nextColumnCount: 2,
        previousRowHeight: 220,
        nextRowHeight: 220,
      })
    ).toBe(0);
  });

  it("pins prepends to the top when the live DOM is at top but cached scroll metrics lag", () => {
    expect(
      resolveReferenceGridPrependAnchorScrollTop({
        previousOutputIds: ["out-1", "out-2", "out-3"],
        nextOutputIds: ["out-new", "out-1", "out-2", "out-3"],
        previousScrollTop: 120,
        measuredScrollTop: 0,
        previousColumnCount: 3,
        nextColumnCount: 3,
        previousRowHeight: 220,
        nextRowHeight: 220,
      })
    ).toBe(0);
  });

  it("preserves the first visible row when outputs are prepended above the viewport", () => {
    expect(
      resolveReferenceGridPrependAnchorScrollTop({
        previousOutputIds: ["out-1", "out-2", "out-3", "out-4"],
        nextOutputIds: ["out-new-1", "out-new-2", "out-1", "out-2", "out-3", "out-4"],
        previousScrollTop: 250,
        measuredScrollTop: 250,
        previousColumnCount: 2,
        nextColumnCount: 2,
        previousRowHeight: 220,
        nextRowHeight: 220,
      })
    ).toBe(470);
  });
});
