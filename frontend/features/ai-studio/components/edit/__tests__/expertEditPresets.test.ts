import { describe, expect, it } from "vitest";
import {
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
});
