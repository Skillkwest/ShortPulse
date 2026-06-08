import { describe, expect, it } from "vitest";
import { resolveWorkflowReloadCharacterSelection } from "../workflowReloadCharacterRestore";

describe("resolveWorkflowReloadCharacterSelection", () => {
  it("returns the saved character and look when the character still exists", () => {
    expect(
      resolveWorkflowReloadCharacterSelection({
        characterContext: {
          applied: true,
          characterId: " char-1 ",
          lookId: " look-main ",
        },
        characterOptions: [{ id: "char-1" }],
      })
    ).toEqual({
      characterId: "char-1",
      lookId: "look-main",
    });
  });

  it("clears selection when the saved character has been deleted", () => {
    expect(
      resolveWorkflowReloadCharacterSelection({
        characterContext: {
          applied: true,
          characterId: "deleted-character",
          lookId: "look-main",
        },
        characterOptions: [{ id: "char-1" }],
      })
    ).toBeNull();
  });

  it("clears selection when character metadata was not applied", () => {
    expect(
      resolveWorkflowReloadCharacterSelection({
        characterContext: {
          applied: false,
          characterId: "char-1",
          lookId: "look-main",
        },
        characterOptions: [{ id: "char-1" }],
      })
    ).toBeNull();
  });

  it("clears selection when the saved character id is empty", () => {
    expect(
      resolveWorkflowReloadCharacterSelection({
        characterContext: {
          applied: true,
          characterId: " ",
          lookId: "look-main",
        },
        characterOptions: [{ id: "char-1" }],
      })
    ).toBeNull();
  });
});
