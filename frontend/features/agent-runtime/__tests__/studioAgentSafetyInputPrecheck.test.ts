import { describe, expect, it } from "vitest";
import { runStudioAgentSafetyInputPrecheck } from "../studioAgentSafetyInputPrecheck";

describe("studioAgentSafetyInputPrecheck", () => {
  it("passes safe input unchanged", () => {
    const result = runStudioAgentSafetyInputPrecheck({
      enabled: true,
      messages: [{ role: "user", content: "Generate a portrait in studio light." }],
      context: {
        activePrompt: "Generate a portrait in studio light.",
      },
      canonicalPrompt: "Generate a portrait in studio light.",
      modality: "text",
      environment: "production",
      profileId: "prod_safe_v1",
    });

    expect(result.outcome).toBe("pass");
    expect(result.providerCallSkipped).toBe(false);
    expect(result.rewrittenFieldCount).toBe(0);
    expect(result.messages[0]?.content).toBe("Generate a portrait in studio light.");
  });

  it("rewrites suggestive input and keeps provider call enabled", () => {
    const result = runStudioAgentSafetyInputPrecheck({
      enabled: true,
      messages: [{ role: "user", content: "a sexy topless model in lingerie" }],
      context: {
        activePrompt: "a sexy topless model in lingerie",
        references: [
          {
            id: "ref-1",
            kind: "prompt",
            promptSnippet: "sexy topless editorial",
            caption: "revealing outfit pose",
          },
        ],
      },
      canonicalPrompt: "a sexy topless model in lingerie",
      modality: "image",
      environment: "production",
      profileId: "prod_safe_v1",
    });

    expect(result.outcome).toBe("rewritten");
    expect(result.providerCallSkipped).toBe(false);
    expect(result.rewrittenFieldCount).toBeGreaterThan(0);
    expect(result.messages[0]?.content.toLowerCase()).not.toContain("topless");
    expect(result.context.activePrompt?.toLowerCase()).not.toContain("topless");
    expect(result.context.references?.[0]?.promptSnippet?.toLowerCase()).not.toContain("topless");
    expect(result.context.references?.[0]?.caption?.toLowerCase()).not.toContain(
      "revealing outfit"
    );
  });

  it("refuses explicit input before provider execution", () => {
    const result = runStudioAgentSafetyInputPrecheck({
      enabled: true,
      messages: [{ role: "user", content: "graphic sexual intercourse with explicit anatomy" }],
      context: {},
      canonicalPrompt: null,
      modality: "text",
      environment: "production",
      profileId: "prod_safe_v1",
    });

    expect(result.outcome).toBe("refusal");
    expect(result.providerCallSkipped).toBe(true);
    expect(result.decision?.action).toBe("refuse");
  });

  it("bypasses processing when feature is disabled", () => {
    const messages = [{ role: "user" as const, content: "a sexy topless model in lingerie" }];
    const result = runStudioAgentSafetyInputPrecheck({
      enabled: false,
      messages,
      context: {},
      canonicalPrompt: null,
      modality: "text",
      environment: "production",
      profileId: "prod_safe_v1",
    });

    expect(result.outcome).toBe("pass");
    expect(result.rewrittenFieldCount).toBe(0);
    expect(result.messages[0]?.content).toBe(messages[0]?.content);
  });

  it("keeps strict allow_only behavior when rewritten content stays suggestive", () => {
    const result = runStudioAgentSafetyInputPrecheck({
      enabled: true,
      messages: [{ role: "user", content: "a person sharing suicidal thoughts" }],
      context: {},
      canonicalPrompt: null,
      modality: "text",
      environment: "production",
      profileId: "prod_safe_v1",
      rewriteRecheckMode: "allow_only",
    });

    expect(result.outcome).toBe("refusal");
    expect(result.providerCallSkipped).toBe(true);
    expect(result.decision?.action).toBe("rewrite");
  });

  it("keeps sanitized violence suggestive prompts in rewritten continuation mode", () => {
    const result = runStudioAgentSafetyInputPrecheck({
      enabled: true,
      messages: [{ role: "user", content: "an armed detective in a rainy alley" }],
      context: {},
      canonicalPrompt: null,
      modality: "text",
      environment: "production",
      profileId: "prod_safe_v1",
      rewriteRecheckMode: "allow_or_rewrite",
    });

    expect(result.outcome).toBe("rewritten");
    expect(result.providerCallSkipped).toBe(false);
    expect(result.decision?.action).toBe("rewrite");
    expect(result.messages[0]?.content.toLowerCase()).not.toContain("armed");
  });
});
