import { describe, expect, it } from "vitest";
import { normalizeActions } from "../actionNormalizer";

describe("normalizeActions", () => {
  it("maps snake_case payloads and preserves describe targets", () => {
    const normalized = normalizeActions({
      apply_prompt: "  cinematic city skyline at dusk  ",
      describe_targets: ["image-a"],
    });

    expect(normalized?.applyPrompt).toBe("cinematic city skyline at dusk");
    expect(normalized?.describeTargets).toEqual(["image-a"]);
  });

  it("drops empty/invalid variation entries", () => {
    const normalized = normalizeActions({
      variations: ["  first  ", "", "   "],
    });

    expect(normalized?.variations).toEqual(["first"]);
  });
});
