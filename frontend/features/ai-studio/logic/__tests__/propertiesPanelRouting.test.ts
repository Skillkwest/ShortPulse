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

  it("routes video aliases to video and canvas to its dedicated panel", () => {
    expect(resolvePropertiesPanelKind("video")).toBe("video");
    expect(resolvePropertiesPanelKind("kling")).toBe("video");
    expect(resolvePropertiesPanelKind("character")).toBe("character");
    expect(resolvePropertiesPanelKind("canvas")).toBe("canvas");
    expect(resolvePropertiesPanelKind("presets")).toBe("presets");
    expect(resolvePropertiesPanelKind("styles")).toBe("styles");
    expect(resolvePropertiesPanelKind("media-library")).toBe("media-library");
  });

  it("falls back to none for null", () => {
    expect(resolvePropertiesPanelKind(null)).toBe("none");
  });
});
