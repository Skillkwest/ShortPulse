import { describe, expect, it } from "vitest";
import {
  normalizeAssistantMessageEditContent,
  resolveAssistantMessageEditCommit,
} from "../messageEditing";

describe("messageEditing", () => {
  it("normalizes whitespace and line endings", () => {
    expect(normalizeAssistantMessageEditContent("  one\r\ntwo\r\n  ")).toBe("one\ntwo");
  });

  it("returns null for empty or no-op edits", () => {
    expect(
      resolveAssistantMessageEditCommit({
        currentContent: "Draft output",
        nextContent: "   ",
      })
    ).toBeNull();
    expect(
      resolveAssistantMessageEditCommit({
        currentContent: "Draft output",
        nextContent: "  Draft output  ",
      })
    ).toBeNull();
  });

  it("returns normalized content for changed edits", () => {
    expect(
      resolveAssistantMessageEditCommit({
        currentContent: "Draft output",
        nextContent: "  Final output  ",
      })
    ).toBe("Final output");
  });
});
