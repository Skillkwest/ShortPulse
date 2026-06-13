import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isReferenceGridDocumentVisible,
  resolveReferenceGridValidHydrationOutputIds,
  shouldSuspendReferenceGridResizeMeasurements,
} from "../useReferenceGridRuntimeScaffold";

const mockDocumentVisibility = (visibilityState: DocumentVisibilityState) =>
  vi.spyOn(document, "visibilityState", "get").mockReturnValue(visibilityState);

afterEach(() => {
  vi.restoreAllMocks();
});

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

describe("isReferenceGridDocumentVisible", () => {
  it("treats hidden tabs as ineligible for reference-grid visual work", () => {
    mockDocumentVisibility("hidden");
    expect(isReferenceGridDocumentVisible()).toBe(false);

    vi.restoreAllMocks();
    mockDocumentVisibility("visible");
    expect(isReferenceGridDocumentVisible()).toBe(true);
  });
});
