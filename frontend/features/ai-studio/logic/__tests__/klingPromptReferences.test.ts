import { describe, expect, it } from "vitest";
import {
  analyzeKlingPromptTokens,
  buildKlingPromptHighlightSegments,
} from "../klingPromptReferences";

describe("klingPromptReferences", () => {
  it("marks attached canonical tokens as valid prompt tokens", () => {
    expect(
      analyzeKlingPromptTokens("Stage @element1 by @lamp", [
        { token: "element1", legacyAliases: ["taylor"], sourceKind: "character" },
      ])
    ).toEqual([
      {
        token: "@element1",
        normalizedToken: "element1",
        start: 6,
        end: 15,
        isValid: true,
        slotIndex: 0,
        sourceKind: "character",
      },
      {
        token: "@lamp",
        normalizedToken: "lamp",
        start: 19,
        end: 24,
        isValid: false,
        slotIndex: null,
        sourceKind: null,
      },
    ]);
  });

  it("builds character, element, and invalid highlight segments from canonical prompt tokens", () => {
    const diagnostics = analyzeKlingPromptTokens("Stage @element1 by @element2 by @lamp", [
      { token: "element1", legacyAliases: ["taylor"], sourceKind: "character" },
      { token: "element2", legacyAliases: ["lantern"], sourceKind: "element" },
    ]);
    expect(
      buildKlingPromptHighlightSegments("Stage @element1 by @element2 by @lamp", diagnostics)
    ).toEqual([
      { text: "Stage ", kind: "plain" },
      { text: "@element1", kind: "character-token" },
      { text: " by ", kind: "plain" },
      { text: "@element2", kind: "token" },
      { text: " by ", kind: "plain" },
      { text: "@lamp", kind: "invalid-token" },
    ]);
  });

  it("keeps legacy alias matching available for older prompts", () => {
    expect(
      analyzeKlingPromptTokens("Use @taylor", [
        { token: "element2", legacyAliases: ["taylor"], sourceKind: "element" },
        { token: "element1", legacyAliases: ["taylor"], sourceKind: "character" },
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
