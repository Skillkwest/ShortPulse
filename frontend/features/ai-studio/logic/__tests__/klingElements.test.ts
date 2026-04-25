import { describe, expect, it } from "vitest";
import {
  resolveAiStudioKlingElementDisplayLabel,
  resolveAiStudioKlingElementLegacyTokens,
  resolveAiStudioKlingElementToken,
  resolveAiStudioKlingElementTokens,
  resolveKieKlingElementToken,
  resolveKieKlingElementTokens,
  resolveLegacyKieKlingElementToken,
} from "../klingElements";

describe("klingElements token resolution", () => {
  it("renames a colliding element token to name_element when a character shares the same alias", () => {
    const elements = [
      { sourceKind: "character" as const, name: "Taylor", alias: "taylor" },
      { sourceKind: "element" as const, name: "Taylor", alias: "taylor" },
    ];

    expect(resolveAiStudioKlingElementTokens(elements)).toEqual(["taylor", "taylor_element"]);
    expect(resolveAiStudioKlingElementToken(elements[0], 0, elements)).toBe("taylor");
    expect(resolveAiStudioKlingElementToken(elements[1], 1, elements)).toBe("taylor_element");
  });

  it("keeps non-colliding aliases unchanged", () => {
    const elements = [
      { sourceKind: "character" as const, name: "Taylor", alias: "taylor" },
      { sourceKind: "element" as const, name: "Lantern", alias: "lantern" },
    ];

    expect(resolveAiStudioKlingElementTokens(elements)).toEqual(["taylor", "lantern"]);
  });

  it("uses the element name as the canonical workflow token even when a legacy alias differs", () => {
    const elements = [{ sourceKind: "element" as const, name: "Red Lantern", alias: "legacylamp" }];

    expect(resolveAiStudioKlingElementTokens(elements)).toEqual(["redlantern"]);
    expect(resolveAiStudioKlingElementToken(elements[0], 0, elements)).toBe("redlantern");
  });

  it("resolves canonical provider tokens from stable slot positions", () => {
    const elements = [
      { slotIndex: 0, sourceKind: "character" as const, name: "Taylor", alias: "taylor" },
      { slotIndex: 2, sourceKind: "element" as const, name: "Taylor", alias: "taylor" },
    ];

    expect(resolveKieKlingElementTokens(elements)).toEqual(["element1", "element3"]);
    expect(resolveKieKlingElementToken(elements[0], 0, elements)).toBe("element1");
    expect(resolveKieKlingElementToken(elements[1], 1, elements)).toBe("element3");
  });

  it("keeps the legacy provider token resolver available for prompt migration", () => {
    const elements = [
      { slotIndex: 0, sourceKind: "character" as const, name: "Taylor", alias: "taylor" },
      { slotIndex: 1, sourceKind: "element" as const, name: "Taylor", alias: "taylor" },
    ];

    expect(resolveLegacyKieKlingElementToken(elements[1], 1, elements)).toBe(
      "element_taylor_element"
    );
  });

  it("collects deduped legacy compatibility tokens for restored prompt matching", () => {
    const elements = [
      { slotIndex: 0, sourceKind: "element" as const, name: "Red Lantern", alias: "legacylamp" },
    ];

    expect(resolveAiStudioKlingElementLegacyTokens(elements[0], 0, elements)).toEqual([
      "redlantern",
      "element_redlantern",
      "legacylamp",
    ]);
  });

  it("uses the current name as the display label before falling back to compatibility tokens", () => {
    const elements = [
      { slotIndex: 0, sourceKind: "element" as const, name: "Red Lantern", alias: "legacylamp" },
      { slotIndex: 1, sourceKind: "element" as const, name: "", alias: "legacylamp" },
    ];

    expect(resolveAiStudioKlingElementDisplayLabel(elements[0], 0, elements)).toBe("Red Lantern");
    expect(resolveAiStudioKlingElementDisplayLabel(elements[1], 1, elements)).toBe("legacylamp");
  });
});
