import { describe, expect, it } from "vitest";
import { insertPromptTokenAtSelection } from "../promptTokenInsertion";

describe("insertPromptTokenAtSelection", () => {
  it("always inserts a trailing space when dropping at the end of a prompt", () => {
    expect(
      insertPromptTokenAtSelection({
        prompt: "Direct the shot",
        token: "@taylor",
        selectionStart: "Direct the shot".length,
        selectionEnd: "Direct the shot".length,
      })
    ).toEqual({
      prompt: "Direct the shot @taylor ",
      caret: "Direct the shot @taylor ".length,
    });
  });

  it("preserves an existing trailing separator without doubling it", () => {
    expect(
      insertPromptTokenAtSelection({
        prompt: "Direct the shot ",
        token: "@taylor",
        selectionStart: "Direct the shot ".length,
        selectionEnd: "Direct the shot ".length,
      })
    ).toEqual({
      prompt: "Direct the shot @taylor ",
      caret: "Direct the shot @taylor ".length,
    });
  });
});
