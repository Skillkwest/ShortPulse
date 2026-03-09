import { describe, expect, it } from "vitest";
import {
  EDIT_PRESET_SURFACE_PRESET_IDS,
  resolveExpertEditPresetCatalog,
  normalizePresetPanelPresetIds,
  normalizeExpertEditCustomPresetOverrides,
  resolveExpertEditPresetById,
} from "../expertEditPresets";

describe("expertEditPresets overrides", () => {
  it("normalizes overrides for canonical preset ids (including non-custom ids)", () => {
    const normalized = normalizeExpertEditCustomPresetOverrides({
      selfie: { label: "Selfie Renamed", prompt: "Updated selfie prompt." },
      custom_2: { label: "Custom Two", prompt: "Updated custom prompt." },
      unknown: { label: "Ignore", prompt: "Ignore" },
    });

    expect(normalized).toEqual({
      selfie: { label: "Selfie Renamed", prompt: "Updated selfie prompt." },
      custom_2: { label: "Custom Two", prompt: "Updated custom prompt." },
    });
  });

  it("applies overrides for non-custom presets during resolution", () => {
    const resolved = resolveExpertEditPresetById("selfie", {
      selfie: { label: "Selfie Renamed", prompt: "Updated selfie prompt." },
    });

    expect(resolved.label).toBe("Selfie Renamed");
    expect(resolved.prompt).toBe("Updated selfie prompt.");
    expect(resolved.hasOverride).toBe(true);
  });

  it("only exposes custom 1-3 in UI-facing preset lists", () => {
    expect(EDIT_PRESET_SURFACE_PRESET_IDS).toContain("custom_3");
    expect(EDIT_PRESET_SURFACE_PRESET_IDS).not.toContain("custom_4");

    expect(normalizePresetPanelPresetIds(["custom_1", "custom_4", "custom_18"])).toEqual([
      "custom_1",
    ]);
    expect(
      normalizePresetPanelPresetIds(["custom_1", "custom_4"], {
        custom_4: { label: "Saved Custom 4", prompt: "Saved prompt" },
      })
    ).toEqual(["custom_1", "custom_4"]);
  });

  it("adds custom_4 to the catalog once a saved override exists", () => {
    expect(resolveExpertEditPresetCatalog().some((preset) => preset.presetId === "custom_4")).toBe(
      false
    );
    expect(
      resolveExpertEditPresetCatalog({
        custom_4: { label: "Saved Custom 4", prompt: "Saved prompt" },
      }).some((preset) => preset.presetId === "custom_4")
    ).toBe(true);
  });
});
