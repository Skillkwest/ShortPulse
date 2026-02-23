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

  it("routes video aliases to video and character aliases to character", () => {
    expect(resolvePropertiesPanelKind("video")).toBe("video");
    expect(resolvePropertiesPanelKind("kling")).toBe("video");
    expect(resolvePropertiesPanelKind("character")).toBe("character");
    expect(resolvePropertiesPanelKind("canvas")).toBe("character");
  });

  it("falls back to none for null", () => {
    expect(resolvePropertiesPanelKind(null)).toBe("none");
  });
});
