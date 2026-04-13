/**
 * Properties panel routing tests.
 * Protects tool -> panel mapping so workflow surfaces do not regress.
 */
import { describe, expect, it } from "vitest";
import { resolvePropertiesPanelKind } from "../propertiesPanelRouting";

describe("resolvePropertiesPanelKind", () => {
  it("routes create and text tools to the create workflow panel", () => {
    expect(resolvePropertiesPanelKind("create")).toBe("create");
    expect(resolvePropertiesPanelKind("text")).toBe("create");
  });

  it("routes edit and image tools to the dedicated edit panel", () => {
    expect(resolvePropertiesPanelKind("edit")).toBe("edit");
    expect(resolvePropertiesPanelKind("image")).toBe("edit");
  });

  it("routes video aliases and auxiliary tools to the expected panels", () => {
    expect(resolvePropertiesPanelKind("video")).toBe("video");
    expect(resolvePropertiesPanelKind("kling")).toBe("video");
    expect(resolvePropertiesPanelKind("character")).toBe("character");
    expect(resolvePropertiesPanelKind("elements")).toBe("elements");
    expect(resolvePropertiesPanelKind("presets")).toBe("presets");
    expect(resolvePropertiesPanelKind("styles")).toBe("styles");
    expect(resolvePropertiesPanelKind("media-library")).toBe("media-library");
    expect(resolvePropertiesPanelKind("sound")).toBe("sound");
    expect(resolvePropertiesPanelKind("voices")).toBe("voices");
    expect(resolvePropertiesPanelKind("text-to-speech")).toBe("text-to-speech");
    expect(resolvePropertiesPanelKind("voice-changer")).toBe("voice-changer");
    expect(resolvePropertiesPanelKind("sound-effects")).toBe("sound");
    expect(resolvePropertiesPanelKind("music")).toBe("sound");
  });

  it("falls back to none for null", () => {
    expect(resolvePropertiesPanelKind(null)).toBe("none");
  });
});
