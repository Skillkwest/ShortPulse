import { describe, expect, it } from "vitest";
import {
  resolveStudioAgentSafetyInputPrecheckFieldModes,
  runStudioAgentSafetyInputPrecheck,
} from "../studioAgentSafetyInputPrecheck";
import { SAFE_COMPLETION_CORPUS } from "../../../tests/support/safeCompletionCases";

describe("studioAgentSafetyInputPrecheck", () => {
  it("enforces the shared corpus provider boundary for deterministic policy cases", () => {
    for (const testCase of SAFE_COMPLETION_CORPUS.cases) {
      const result = runStudioAgentSafetyInputPrecheck({
        enabled: true,
        messages: [{ role: "user", content: testCase.input }],
        context: {},
        canonicalPrompt: null,
        modality: "text",
        environment: "production",
        profileId: "prod_safe_v1",
        rewriteRecheckMode: "allow_or_rewrite",
      });
      expect(result.providerCallSkipped, testCase.id).toBe(!testCase.expected.providerCallAllowed);
      expect(result.decision?.category, testCase.id).toBe(testCase.safetyCategory);
      expect(result.decision?.action, testCase.id).toBe(
        testCase.policyClass === "allow"
          ? "allow"
          : testCase.policyClass === "transform"
            ? "rewrite"
            : "refuse"
      );
      expect(result.outcome, testCase.id).toBe(
        testCase.policyClass === "allow"
          ? "pass"
          : testCase.policyClass === "transform"
            ? "rewritten"
            : "refusal"
      );
      if (!testCase.expected.providerCallAllowed) {
        expect(result.outcome, testCase.id).toBe("refusal");
      }
    }
  });

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
    expect(result.scopeTelemetry.refusalField).toBeNull();
    expect(result.scopeTelemetry.nonBlockingSignalCount).toBe(0);
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
    expect(result.scopeTelemetry.refusalField).toBe("latest_user_turn");
  });

  it("does not block on explicit history turns and rewrites them in non-blocking mode", () => {
    const result = runStudioAgentSafetyInputPrecheck({
      enabled: true,
      messages: [
        { role: "user", content: "graphic sexual intercourse with explicit anatomy" },
        { role: "assistant", content: "acknowledged" },
        { role: "user", content: "generate a landscape at dusk" },
      ],
      context: {},
      canonicalPrompt: null,
      modality: "text",
      environment: "production",
      profileId: "prod_safe_v1",
    });

    expect(result.outcome === "pass" || result.outcome === "rewritten").toBe(true);
    expect(result.providerCallSkipped).toBe(false);
    expect(result.scopeTelemetry.refusalField).toBeNull();
    expect(result.scopeTelemetry.nonBlockingSignalCount).toBeGreaterThan(0);
  });

  it("refuses when canonical prompt is explicit even if latest turn is safe", () => {
    const result = runStudioAgentSafetyInputPrecheck({
      enabled: true,
      messages: [{ role: "user", content: "generate a landscape at dusk" }],
      context: {},
      canonicalPrompt: "graphic sexual intercourse with explicit anatomy",
      modality: "text",
      environment: "production",
      profileId: "prod_safe_v1",
    });

    expect(result.outcome).toBe("refusal");
    expect(result.providerCallSkipped).toBe(true);
    expect(result.scopeTelemetry.refusalField).toBe("canonical_prompt");
  });

  it("applies explicit field-mode overrides for enforcement scope", () => {
    const result = runStudioAgentSafetyInputPrecheck({
      enabled: true,
      messages: [
        { role: "user", content: "graphic sexual intercourse with explicit anatomy" },
        { role: "assistant", content: "acknowledged" },
        { role: "user", content: "generate a landscape at dusk" },
      ],
      context: {},
      canonicalPrompt: null,
      modality: "text",
      environment: "production",
      profileId: "prod_safe_v1",
      fieldModes: {
        history_user_turn: "enforce",
      },
    });

    expect(result.outcome).toBe("refusal");
    expect(result.providerCallSkipped).toBe(true);
    expect(result.scopeTelemetry.refusalField).toBe("history_user_turn");
  });

  it("resolves field-mode overrides from shared and scoped JSON values", () => {
    const overrides = resolveStudioAgentSafetyInputPrecheckFieldModes({
      sharedRawValue:
        '{"history_user_turn":"rewrite_only","canonical_prompt":"off","unknown":"enforce"}',
      scopedRawValue: '{"canonical_prompt":"enforce","reference_caption":"rewrite_only"}',
    });

    expect(overrides).toEqual({
      history_user_turn: "rewrite_only",
      canonical_prompt: "enforce",
      reference_caption: "rewrite_only",
    });
  });

  it("ignores malformed or invalid field-mode JSON values", () => {
    const overrides = resolveStudioAgentSafetyInputPrecheckFieldModes({
      sharedRawValue: '{"history_user_turn":"invalid_mode"',
      scopedRawValue: '{"history_user_turn":"invalid","canonical_prompt":"OFF"}',
    });

    expect(overrides).toEqual({
      canonical_prompt: "off",
    });
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

  it("treats an explicit no-gore constraint as non-graphic instead of a gore request", () => {
    const result = runStudioAgentSafetyInputPrecheck({
      enabled: true,
      messages: [{ role: "user", content: "An armed detective in a rainy alley, with no gore." }],
      context: {},
      canonicalPrompt: null,
      modality: "text",
      environment: "production",
      profileId: "prod_safe_v1",
      rewriteRecheckMode: "allow_or_rewrite",
    });

    expect(result.providerCallSkipped).toBe(false);
    expect(result.outcome).toBe("rewritten");
  });
});
