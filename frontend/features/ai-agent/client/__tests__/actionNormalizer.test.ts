import { describe, expect, it } from "vitest";
import { normalizeActions } from "../actionNormalizer";

describe("normalizeActions", () => {
  it("maps snake_case payloads for applyPrompt", () => {
    const normalized = normalizeActions({
      apply_prompt: "  cinematic city skyline at dusk  ",
    });

    expect(normalized?.applyPrompt).toBe("cinematic city skyline at dusk");
  });

  it("preserves camelCase applyPrompt payloads", () => {
    const normalized = normalizeActions({
      applyPrompt: "  first  ",
    });

    expect(normalized?.applyPrompt).toBe("first");
  });
});
