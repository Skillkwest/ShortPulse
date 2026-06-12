import { describe, expect, it } from "vitest";
import {
  EDIT_PRESET_SURFACE_PRESET_IDS,
  createDeletedPresetOverride,
  resolveExpertEditPresetCatalog,
  normalizePresetPanelPresetIds,
  normalizeExpertEditCustomPresetOverrides,
  normalizeExpertEditDeletedSystemPresetIds,
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

  it("hides presets that are marked deleted by tombstone overrides", () => {
    expect(
      resolveExpertEditPresetCatalog({
        selfie: createDeletedPresetOverride(),
      }).some((preset) => preset.presetId === "selfie")
    ).toBe(false);
    expect(
      resolveExpertEditPresetCatalog({
        custom_1: createDeletedPresetOverride(),
      }).some((preset) => preset.presetId === "custom_1")
    ).toBe(false);
  });

  it("hides system presets from the catalog with a dedicated deleted-id list", () => {
    const catalog = resolveExpertEditPresetCatalog(undefined, undefined, ["selfie"]);

    expect(catalog.some((preset) => preset.presetId === "selfie")).toBe(false);
    expect(catalog.some((preset) => preset.presetId === "custom_1")).toBe(true);
    expect(
      normalizePresetPanelPresetIds(["selfie", "zoom_out"], undefined, undefined, ["selfie"])
    ).toEqual(["zoom_out"]);
  });

  it("normalizes deleted system preset ids without accepting custom presets", () => {
    expect(
      normalizeExpertEditDeletedSystemPresetIds(["selfie", "custom_1", "selfie", "unknown", 42])
    ).toEqual(["selfie"]);
  });
});
