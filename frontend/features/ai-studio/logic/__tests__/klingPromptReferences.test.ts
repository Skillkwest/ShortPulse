import { describe, expect, it } from "vitest";
import {
  analyzeKlingPromptTokens,
  buildKlingPromptHighlightSegments,
} from "../klingPromptReferences";

describe("klingPromptReferences", () => {
  it("marks attached aliases as valid prompt tokens", () => {
    expect(
      analyzeKlingPromptTokens("Stage @taylor by @lamp", [
        { alias: "taylor", sourceKind: "character" },
      ])
    ).toEqual([
      {
        token: "@taylor",
        normalizedToken: "taylor",
        start: 6,
        end: 13,
        isValid: true,
        slotIndex: 0,
        sourceKind: "character",
      },
      {
        token: "@lamp",
        normalizedToken: "lamp",
        start: 17,
        end: 22,
        isValid: false,
        slotIndex: null,
        sourceKind: null,
      },
    ]);
  });

  it("builds character, element, and invalid highlight segments from prompt tokens", () => {
    const diagnostics = analyzeKlingPromptTokens("Stage @taylor by @lantern by @lamp", [
      { alias: "taylor", sourceKind: "character" },
      { alias: "lantern", sourceKind: "element" },
    ]);
    expect(
      buildKlingPromptHighlightSegments("Stage @taylor by @lantern by @lamp", diagnostics)
    ).toEqual([
      { text: "Stage ", kind: "plain" },
      { text: "@taylor", kind: "character-token" },
      { text: " by ", kind: "plain" },
      { text: "@lantern", kind: "token" },
      { text: " by ", kind: "plain" },
      { text: "@lamp", kind: "invalid-token" },
    ]);
  });

  it("prefers character matches over element matches for duplicate aliases regardless of slot order", () => {
    expect(
      analyzeKlingPromptTokens("Use @taylor", [
        { alias: "taylor", sourceKind: "element" },
        { alias: "taylor", sourceKind: "character" },
      ])
    ).toEqual([
      {
        token: "@taylor",
        normalizedToken: "taylor",
        start: 4,
        end: 11,
        isValid: true,
        slotIndex: 1,
        sourceKind: "character",
      },
    ]);
  });
});
