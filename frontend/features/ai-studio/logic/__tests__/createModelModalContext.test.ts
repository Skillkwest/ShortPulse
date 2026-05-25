import { describe, expect, it } from "vitest";
import { resolveCreateModelModalContext } from "../createModelModalContext";

describe("resolveCreateModelModalContext", () => {
  it("keeps standard create on the text-image lane while Character Mode is off", () => {
    expect(
      resolveCreateModelModalContext({
        expertCreateMode: "standard",
        isCharacterModeEnabled: false,
      })
    ).toBe("text-image");
  });

  it("switches standard create to the character-image lane while Character Mode is on", () => {
    expect(
      resolveCreateModelModalContext({
        expertCreateMode: "standard",
        isCharacterModeEnabled: true,
      })
    ).toBe("character-image");
  });

  it("keeps pulse on the text-image lane because Character Mode is runtime-disabled there", () => {
    expect(
      resolveCreateModelModalContext({
        expertCreateMode: "pulse",
        isCharacterModeEnabled: true,
      })
    ).toBe("text-image");
  });
});
