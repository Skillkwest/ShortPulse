import { describe, expect, it } from "vitest";
import {
  resolveWorkflowReloadCharacterContextCandidate,
  resolveWorkflowReloadCharacterSelection,
} from "../workflowReloadCharacterRestore";

describe("resolveWorkflowReloadCharacterSelection", () => {
  it("returns an immediate saved character candidate before option refresh confirms availability", () => {
    expect(
      resolveWorkflowReloadCharacterContextCandidate({
        applied: true,
        characterId: " char-1 ",
        lookId: " look-main ",
      })
    ).toEqual({
      characterId: "char-1",
      lookId: "look-main",
    });
  });

  it("does not return an immediate candidate when the reload output did not apply character mode", () => {
    expect(
      resolveWorkflowReloadCharacterContextCandidate({
        applied: false,
        characterId: "char-1",
        lookId: "look-main",
      })
    ).toBeNull();
  });

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
