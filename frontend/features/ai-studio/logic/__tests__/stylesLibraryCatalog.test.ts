/**
 * Unit tests for Styles Library catalog ordering helpers.
 */
import { describe, expect, it } from "vitest";
import {
  normalizeStylesLibraryOrderedIds,
  normalizeStylesLibraryStyleId,
  removeStylesLibraryOrderedId,
  reorderStylesLibraryOrderedIds,
} from "../stylesLibraryCatalog";

describe("stylesLibraryCatalog", () => {
  it("normalizes individual style ids for persistence-safe use", () => {
    expect(normalizeStylesLibraryStyleId(" style-library-custom-1 ")).toBe(
      "style-library-custom-1"
    );
    expect(normalizeStylesLibraryStyleId("")).toBeNull();
    expect(normalizeStylesLibraryStyleId("x".repeat(161))).toBeNull();
  });

  it("drops duplicate, invalid, and over-budget style ids from ordered preferences", () => {
    expect(
      normalizeStylesLibraryOrderedIds([
        " cinematic ",
        "cinematic",
        "style-library-custom-1",
        "x".repeat(161),
        42,
      ])
    ).toEqual(["cinematic", "style-library-custom-1"]);
  });

  it("normalizes removed style ids before updating persisted order", () => {
    expect(removeStylesLibraryOrderedId(["cinematic", "anime"], " anime ")).toEqual(["cinematic"]);
    expect(removeStylesLibraryOrderedId(["cinematic", "anime"], "x".repeat(161))).toEqual([
      "cinematic",
      "anime",
    ]);
  });

  it("normalizes dragged style ids before reordering persisted order", () => {
    expect(
      reorderStylesLibraryOrderedIds(
        ["cinematic", "anime", "style-library-custom-1"],
        " anime ",
        " cinematic ",
        "before"
      )
    ).toEqual(["anime", "cinematic", "style-library-custom-1"]);

    expect(
      reorderStylesLibraryOrderedIds(["cinematic", "anime"], "x".repeat(161), "cinematic")
    ).toEqual(["cinematic", "anime"]);
  });

  it("supports explicit before and after drop placement", () => {
    expect(
      reorderStylesLibraryOrderedIds(
        ["cinematic", "anime", "soft-bloom"],
        "cinematic",
        "anime",
        "after"
      )
    ).toEqual(["anime", "cinematic", "soft-bloom"]);

    expect(
      reorderStylesLibraryOrderedIds(
        ["cinematic", "anime", "soft-bloom"],
        "soft-bloom",
        "anime",
        "before"
      )
    ).toEqual(["cinematic", "soft-bloom", "anime"]);
  });
});
