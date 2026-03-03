import { describe, expect, it } from "vitest";
import { shouldBlockAfterRewrite } from "../rewriteRecheckPolicy";

describe("rewriteRecheckPolicy", () => {
  it("blocks anything not allow in allow_only mode", () => {
    expect(
      shouldBlockAfterRewrite({
        mode: "allow_only",
        action: "allow",
        category: "sexual_suggestive",
      })
    ).toBe(false);
    expect(
      shouldBlockAfterRewrite({
        mode: "allow_only",
        action: "rewrite",
        category: "sexual_suggestive",
      })
    ).toBe(true);
    expect(
      shouldBlockAfterRewrite({
        mode: "allow_only",
        action: "refuse",
        category: "sexual_suggestive",
      })
    ).toBe(true);
  });

  it("allows suggestive sexual/violence rewrites in allow_or_rewrite mode", () => {
    expect(
      shouldBlockAfterRewrite({
        mode: "allow_or_rewrite",
        action: "allow",
        category: "sexual_suggestive",
      })
    ).toBe(false);
    expect(
      shouldBlockAfterRewrite({
        mode: "allow_or_rewrite",
        action: "rewrite",
        category: "sexual_suggestive",
      })
    ).toBe(false);
    expect(
      shouldBlockAfterRewrite({
        mode: "allow_or_rewrite",
        action: "refuse",
        category: "sexual_suggestive",
      })
    ).toBe(true);
  });

  it("still blocks rewrite-lane self-harm and hate categories", () => {
    expect(
      shouldBlockAfterRewrite({
        mode: "allow_or_rewrite",
        action: "rewrite",
        category: "self_harm_suggestive",
      })
    ).toBe(true);
    expect(
      shouldBlockAfterRewrite({
        mode: "allow_or_rewrite",
        action: "rewrite",
        category: "hate_suggestive",
      })
    ).toBe(true);
  });
});
