/**
 * Unit tests for Styles Library catalog ordering helpers.
 */
import { describe, expect, it } from "vitest";
import {
  normalizeStylesLibraryOrderedIds,
  normalizeStylesLibraryStyleId,
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
});
