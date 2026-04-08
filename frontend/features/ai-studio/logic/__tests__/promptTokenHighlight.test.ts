import { describe, expect, it } from "vitest";
import { buildPromptTokenHighlightSegments } from "../promptTokenHighlight";

describe("buildPromptTokenHighlightSegments", () => {
  it("returns a plain segment when there are no tokens", () => {
    expect(buildPromptTokenHighlightSegments("Direct the scene")).toEqual([
      { text: "Direct the scene", kind: "plain" },
    ]);
  });

  it("splits @tokens into highlighted segments", () => {
    expect(buildPromptTokenHighlightSegments("Use @taylor near @lamp.")).toEqual([
      { text: "Use ", kind: "plain" },
      { text: "@taylor", kind: "token" },
      { text: " near ", kind: "plain" },
      { text: "@lamp", kind: "token" },
      { text: ".", kind: "plain" },
    ]);
  });
});
