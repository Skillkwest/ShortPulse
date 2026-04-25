import { describe, expect, it } from "vitest";
import {
  CHARACTER_LIBRARY_EXPAND_STEP,
  CHARACTER_LIBRARY_SMOOTH_TARGET,
  resolveCharacterLibraryWindow,
} from "../characterLibraryWindow";

describe("resolveCharacterLibraryWindow", () => {
  it("fully renders smaller libraries up through the smooth target", () => {
    const scenarios = [10, 20, 30, 50];
    for (const total of scenarios) {
      expect(
        resolveCharacterLibraryWindow({
          totalCharacterCount: total,
          selectedCharacterIndex: 0,
          requestedVisibleCount: CHARACTER_LIBRARY_SMOOTH_TARGET,
        })
      ).toEqual({
        startIndex: 0,
        endIndexExclusive: total,
        visibleCount: total,
        hiddenCount: 0,
      });
    }
  });

  it("progressively windows larger libraries by default", () => {
    expect(
      resolveCharacterLibraryWindow({
        totalCharacterCount: 100,
        selectedCharacterIndex: 0,
        requestedVisibleCount: CHARACTER_LIBRARY_SMOOTH_TARGET,
      })
    ).toEqual({
      startIndex: 0,
      endIndexExclusive: 50,
      visibleCount: 50,
      hiddenCount: 50,
    });
  });

  it("expands visibility in fixed steps", () => {
    const nextVisible = CHARACTER_LIBRARY_SMOOTH_TARGET + CHARACTER_LIBRARY_EXPAND_STEP;
    expect(
      resolveCharacterLibraryWindow({
        totalCharacterCount: 100,
        selectedCharacterIndex: 0,
        requestedVisibleCount: nextVisible,
      })
    ).toEqual({
      startIndex: 0,
      endIndexExclusive: 75,
      visibleCount: 75,
      hiddenCount: 25,
    });
  });

  it("keeps the selected character visible without widening the visible count", () => {
    expect(
      resolveCharacterLibraryWindow({
        totalCharacterCount: 100,
        selectedCharacterIndex: 90,
        requestedVisibleCount: CHARACTER_LIBRARY_SMOOTH_TARGET,
      })
    ).toEqual({
      startIndex: 41,
      endIndexExclusive: 91,
      visibleCount: 50,
      hiddenCount: 50,
    });
  });
});
