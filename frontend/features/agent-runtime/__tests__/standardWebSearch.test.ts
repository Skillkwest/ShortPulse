import { describe, expect, it } from "vitest";
import {
  isLikelyStandardWebSearchRequest,
  resolveStandardWebSearchToolChoice,
} from "../standardWebSearch";

describe("standardWebSearch", () => {
  it("detects common live lookup intents", () => {
    expect(isLikelyStandardWebSearchRequest("What is the weather right now?")).toBe(true);
    expect(isLikelyStandardWebSearchRequest("Look up the Instagram account Kirk Artman.")).toBe(
      true
    );
    expect(isLikelyStandardWebSearchRequest("Can you verify the current price?")).toBe(true);
  });

  it("requires web search for intent-matched Standard text turns only", () => {
    expect(
      resolveStandardWebSearchToolChoice({
        flow: "TEXT_ONLY",
        latestUserText: "What are live conditions right now?",
        mode: "intent",
      })
    ).toBe("required");
    expect(
      resolveStandardWebSearchToolChoice({
        flow: "MIXED",
        latestUserText: "What are live conditions right now?",
        mode: "intent",
      })
    ).toBeNull();
  });
});
