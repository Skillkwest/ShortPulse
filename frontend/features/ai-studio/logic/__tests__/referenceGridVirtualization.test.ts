import { describe, expect, it } from "vitest";
import {
  calculateReferenceGridWindow,
  resolveReferenceGridMaxColumns,
  resolveReferenceGridOverscanRows,
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
});
