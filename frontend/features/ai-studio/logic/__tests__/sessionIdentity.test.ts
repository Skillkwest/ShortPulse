import { describe, expect, it } from "vitest";
import {
  createAiStudioSessionId,
  isValidAiStudioSessionId,
  parseAiStudioSessionId,
} from "../sessionIdentity";

describe("sessionIdentity", () => {
  it("accepts valid UUID values and rejects invalid candidates", () => {
    expect(parseAiStudioSessionId("f7f45245-f204-4ece-8f9e-c9a66a9d8d2a")).toBe(
      "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a"
    );
    expect(parseAiStudioSessionId("not-a-session-id")).toBeNull();
    expect(parseAiStudioSessionId("")).toBeNull();
    expect(parseAiStudioSessionId(null)).toBeNull();
  });

  it("returns the first valid UUID from query arrays", () => {
    expect(parseAiStudioSessionId(["bad", "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a"])).toBe(
      "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a"
    );
  });

  it("generates valid UUID session ids", () => {
    const generated = createAiStudioSessionId();
    expect(isValidAiStudioSessionId(generated)).toBe(true);
  });
});
