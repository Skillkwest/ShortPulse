import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useMediaAspectRatioCache } from "../media-library-modal/useMediaAspectRatioCache";

describe("useMediaAspectRatioCache", () => {
  it("stores valid aspect ratios and ignores invalid values", () => {
    const { result } = renderHook(() => useMediaAspectRatioCache([{ id: "media-1" }]));

    act(() => {
      result.current.cacheAspectRatio("media-1", 16 / 9);
      result.current.cacheAspectRatio("media-1", 0);
      result.current.cacheAspectRatio("media-1", Number.NaN);
    });

    expect(result.current.aspectRatioById).toEqual({
      "media-1": 16 / 9,
    });
  });

  it("prunes cached ratios for rows that are no longer active", () => {
    const { result, rerender } = renderHook(
      ({ rows }: { rows: Array<{ id: string }> }) => useMediaAspectRatioCache(rows),
      {
        initialProps: {
          rows: [{ id: "media-1" }, { id: "media-2" }],
        },
      }
    );

    act(() => {
      result.current.cacheAspectRatio("media-1", 4 / 5);
      result.current.cacheAspectRatio("media-2", 16 / 9);
    });

    rerender({
      rows: [{ id: "media-2" }],
    });

    expect(result.current.aspectRatioById).toEqual({
      "media-2": 16 / 9,
    });
  });
});
