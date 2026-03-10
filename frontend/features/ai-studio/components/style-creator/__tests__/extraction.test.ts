/**
 * Unit tests for style-creator extraction outcome classification.
 */
import { describe, expect, it } from "vitest";
import {
  buildExtractionFailureResult,
  classifyStyleExtractionOutcome,
  isBlockedStyleSourceError,
} from "../extraction";

describe("style-creator extraction helpers", () => {
  it("classifies blocked-source errors deterministically", () => {
    const error = new Error(
      "This image source blocks browser access. Download the image and drop the file directly."
    );

    expect(isBlockedStyleSourceError(error)).toBe(true);
    expect(classifyStyleExtractionOutcome(error)).toBe("blocked_source");
  });

  it("maps generic errors to fallback", () => {
    const error = new Error("Style extraction failed.");

    expect(isBlockedStyleSourceError(error)).toBe(false);
    expect(classifyStyleExtractionOutcome(error)).toBe("fallback");
  });

  it("normalizes failure result payload", () => {
    const result = buildExtractionFailureResult(new Error("Timeout"));

    expect(result).toEqual({
      outcome: "fallback",
      sourceUrlKind: "unknown",
      errorMessage: "Timeout",
      failureClass: "unknown",
      attemptCount: null,
      probeMs: null,
      openAiMs: null,
      totalMs: null,
      modelUsed: null,
    });
  });
});
