import { describe, expect, it } from "vitest";
import {
  CHARACTER_SHEET_PRESET_TAB_LABEL_MAX_LENGTH,
  createNormalizedCharacterSheetPresetTabLabels,
  deriveLegacyCharacterSheetPresetTabOrder,
  getNextCharacterSheetPresetId,
  normalizeCharacterSheetPresetTabOrder,
  sanitizeCharacterSheetPresetTabLabel,
} from "../characterSheetPresetTabs";

describe("characterSheetPresetTabs helpers", () => {
  it("allocates the next hidden preset id and enforces max cap", () => {
    expect(getNextCharacterSheetPresetId(["1"])).toBe("2");
    expect(
      getNextCharacterSheetPresetId(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"])
    ).toBeNull();
  });

  it("sanitizes tab labels and falls back to preset id", () => {
    expect(
      sanitizeCharacterSheetPresetTabLabel({
        presetId: "3",
        label: "   Cinematic   Closeups   ",
      })
    ).toBe("Cinematic Closeups");
    expect(
      sanitizeCharacterSheetPresetTabLabel({
        presetId: "3",
        label: "   ",
      })
    ).toBe("3");
    expect(
      sanitizeCharacterSheetPresetTabLabel({
        presetId: "3",
        label: "x".repeat(CHARACTER_SHEET_PRESET_TAB_LABEL_MAX_LENGTH + 10),
      }).length
    ).toBe(CHARACTER_SHEET_PRESET_TAB_LABEL_MAX_LENGTH);
  });

  it("normalizes tab order and guarantees active tab visibility", () => {
    expect(
      normalizeCharacterSheetPresetTabOrder({
        tabOrder: ["1", "2", "2", "3"],
        activePresetId: "4",
      })
    ).toEqual(["1", "2", "3", "4"]);
    expect(
      normalizeCharacterSheetPresetTabOrder({
        tabOrder: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
        activePresetId: "8",
      })
    ).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
    expect(
      normalizeCharacterSheetPresetTabOrder({
        tabOrder: ["2", "3", "4", "5", "6", "7", "8", "9", "10", "1"],
        activePresetId: "1",
      })
    ).toEqual(["2", "3", "4", "5", "6", "7", "8", "9", "10", "1"]);
  });

  it("derives legacy visible tabs from preset keys and keeps ascending stable order", () => {
    expect(
      deriveLegacyCharacterSheetPresetTabOrder({
        rawPresetIds: ["4", "2", "1", "2"],
        activePresetId: "3",
      })
    ).toEqual(["1", "2", "4", "3"]);
  });

  it("normalizes labels across all preset ids with defaults", () => {
    const labels = createNormalizedCharacterSheetPresetTabLabels({
      labels: {
        "1": "Hero",
        "2": "   ",
      },
    });
    expect(labels["1"]).toBe("Hero");
    expect(labels["2"]).toBe("2");
    expect(labels["10"]).toBe("10");
  });
});
