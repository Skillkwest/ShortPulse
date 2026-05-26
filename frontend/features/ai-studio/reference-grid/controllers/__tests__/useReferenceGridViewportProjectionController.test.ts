import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useReferenceGridViewportProjectionController } from "../useReferenceGridViewportProjectionController";

describe("useReferenceGridViewportProjectionController", () => {
  it("does not inject an offscreen active output into the capped visible slice", () => {
    const outputIds = Array.from({ length: 30 }, (_, index) => `out-${index + 1}`);

    const { result } = renderHook(() =>
      useReferenceGridViewportProjectionController({
        outputIds,
        curatedOutputIds: [],
        activeOutputId: "out-2",
        isCuratedSplitEnabled: false,
        perfDegradeLevel: 0,
        virtualMetrics: {
          scrollTop: 400,
          viewportHeight: 100,
          columnCount: 3,
          rowHeight: 100,
        },
        curatedVirtualMetrics: {
          scrollTop: 0,
          viewportHeight: 0,
          columnCount: 3,
          rowHeight: 100,
        },
        config: {
          dynamicVirtualizationEnabled: false,
          hardViewportCapEnabled: true,
          denseVisualSimplifyEnabled: false,
          virtualOverscanRows: 1,
          virtualizeMinItems: 12,
          fallbackReferenceRowHeight: 100,
          referenceGridMinColumns: 2,
          highDensityCardCount: 40,
        },
      })
    );

    expect(result.current.visibleOutputIds).toEqual([
      "out-10",
      "out-11",
      "out-12",
      "out-13",
      "out-14",
      "out-15",
      "out-16",
      "out-17",
      "out-18",
    ]);
    expect(result.current.visibleOutputIds).not.toContain("out-2");
  });
});
