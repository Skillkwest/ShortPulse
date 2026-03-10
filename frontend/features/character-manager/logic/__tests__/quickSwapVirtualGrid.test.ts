import { describe, expect, it } from "vitest";
import { resolveVirtualGridWindow, sliceVirtualGridEntries } from "../quickSwapVirtualGrid";

describe("quickSwapVirtualGrid", () => {
  it("returns empty ranges for empty datasets", () => {
    const windowed = resolveVirtualGridWindow({
      itemCount: 0,
      columnCount: 3,
      viewportHeight: 400,
      scrollTop: 0,
      rowHeight: 180,
      rowGap: 4,
      overscanRows: 1,
    });
    expect(windowed).toEqual({
      startIndex: 0,
      endIndexExclusive: 0,
      paddingTop: 0,
      paddingBottom: 0,
    });
  });

  it("computes a stable visible window with overscan and spacer heights", () => {
    const windowed = resolveVirtualGridWindow({
      itemCount: 100,
      columnCount: 3,
      viewportHeight: 720,
      scrollTop: 760,
      rowHeight: 240,
      rowGap: 4,
      overscanRows: 1,
    });

    expect(windowed.startIndex).toBe(6);
    expect(windowed.endIndexExclusive).toBe(21);
    expect(windowed.paddingTop).toBe(488);
    expect(windowed.paddingBottom).toBeGreaterThan(0);
  });

  it("preserves absolute indices when slicing visible entries", () => {
    const items = Array.from({ length: 12 }, (_, index) => `item-${index}`);
    const sliced = sliceVirtualGridEntries(items, 5, 9);
    expect(sliced).toEqual([
      { item: "item-5", absoluteIndex: 5 },
      { item: "item-6", absoluteIndex: 6 },
      { item: "item-7", absoluteIndex: 7 },
      { item: "item-8", absoluteIndex: 8 },
    ]);
  });
});
