/**
 * Properties panel routing tests.
 * Protects tool -> panel mapping so workflow surfaces do not regress.
 */
import { describe, expect, it } from "vitest";
import { resolvePropertiesPanelKind } from "../propertiesPanelRouting";

describe("resolvePropertiesPanelKind", () => {
  it("routes create and text tools to the text properties surface", () => {
    expect(resolvePropertiesPanelKind("create")).toBe("text");
    expect(resolvePropertiesPanelKind("text")).toBe("text");
  });

  it("routes edit and image tools to the dedicated edit properties panel", () => {
    expect(resolvePropertiesPanelKind("edit")).toBe("edit");
    expect(resolvePropertiesPanelKind("image")).toBe("edit");
  });

  it("routes video to video and falls back to none for null", () => {
    expect(resolvePropertiesPanelKind("video")).toBe("video");
    expect(resolvePropertiesPanelKind(null)).toBe("none");
  });
});
