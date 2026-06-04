import { describe, expect, it } from "vitest";
import {
  resolveReferenceGridValidHydrationOutputIds,
  shouldSuspendReferenceGridResizeMeasurements,
} from "../useReferenceGridRuntimeScaffold";

describe("resolveReferenceGridValidHydrationOutputIds", () => {
  it("keeps Quick Slot-only and active outputs valid for hydration pruning", () => {
    expect(
      resolveReferenceGridValidHydrationOutputIds({
        allOutputIds: ["all-1", "shared-1"],
        curatedOutputIds: ["quick-only-1", "shared-1"],
        activeOutputId: "active-restored-1",
      })
    ).toEqual(["all-1", "shared-1", "quick-only-1", "active-restored-1"]);
  });
});

describe("shouldSuspendReferenceGridResizeMeasurements", () => {
  it("suspends only dense grids during active divider resizing", () => {
    expect(
      shouldSuspendReferenceGridResizeMeasurements({
        outputCount: 39,
        highDensityCardCount: 40,
        isShellResizeActive: true,
        isHorizontalSplitResizeActive: false,
        isStylesSplitResizeActive: false,
        isRailCanvasSplitResizeActive: false,
      })
    ).toBe(false);

    expect(
      shouldSuspendReferenceGridResizeMeasurements({
        outputCount: 40,
        highDensityCardCount: 40,
        isShellResizeActive: false,
        isHorizontalSplitResizeActive: false,
        isStylesSplitResizeActive: false,
        isRailCanvasSplitResizeActive: true,
      })
    ).toBe(true);

    expect(
      shouldSuspendReferenceGridResizeMeasurements({
        outputCount: 120,
        highDensityCardCount: 40,
        isShellResizeActive: false,
        isHorizontalSplitResizeActive: false,
        isStylesSplitResizeActive: false,
        isRailCanvasSplitResizeActive: false,
      })
    ).toBe(false);
  });
});
