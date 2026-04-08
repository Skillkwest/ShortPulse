import { describe, expect, it } from "vitest";
import {
  resolveAiStudioKlingElementToken,
  resolveAiStudioKlingElementTokens,
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
});
