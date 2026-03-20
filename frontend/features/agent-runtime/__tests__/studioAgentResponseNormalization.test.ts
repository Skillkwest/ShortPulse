import { describe, expect, it } from "vitest";
import {
  buildStudioAgentSemanticResponse,
  ensureStudioAgentApplyPromptContract,
  parseStudioAgentJsonWithStatus,
  parseStudioAgentSemanticOutput,
} from "../studioAgentResponseNormalization";

describe("studioAgentResponseNormalization", () => {
  it("parses strict semantic JSON output", () => {
    const parsed = parseStudioAgentSemanticOutput(
      '{"status":"ready","prompt_text":"cinematic portrait in soft window light"}'
    );
    expect(parsed).toEqual({
      status: "ready",
      promptText: "cinematic portrait in soft window light",
    });
  });

  it("normalizes refusal semantic output to canonical refusal message", () => {
    const semantic = parseStudioAgentSemanticOutput(
      '{"status":"refuse","prompt_text":"cannot comply"}'
    );
    expect(semantic).toEqual({
      status: "refuse",
      promptText: "cannot comply",
    });

    const built = buildStudioAgentSemanticResponse({
      semantic: semantic!,
    });
    expect(built).toEqual({
      status: "refuse",
      parsed: {
        message: "I cannot describe this.",
        actions: undefined,
      },
    });
  });

  it("parses fenced semantic payloads when extra text is present", () => {
    const semantic = parseStudioAgentSemanticOutput(
      [
        "Analyzer notes:",
        "```json",
        '{"status":"ready","prompt_text":"moody noir portrait, rim light"}',
        "```",
        'Ignore debug object: {"debug":true}',
      ].join("\n")
    );

    expect(semantic).toEqual({
      status: "ready",
      promptText: "moody noir portrait, rim light",
    });
  });

  it("skips non-contract JSON blocks and parses the first valid contract payload", () => {
    const parsed = parseStudioAgentJsonWithStatus(
      [
        "Debug:",
        '{"trace":"abc-123"}',
        "Final payload:",
        '{"message":"cinematic portrait","actions":{"apply_prompt":"cinematic portrait"}}',
      ].join("\n")
    );

    expect(parsed).toEqual({
      status: null,
      response: {
        message: "cinematic portrait",
        actions: { applyPrompt: "cinematic portrait" },
        usage: undefined,
      },
    });
  });

  it("emits applyPrompt-only actions for ready contract", () => {
    const normalized = ensureStudioAgentApplyPromptContract({
      parsed: {
        message: "A rainy neon city street at night",
        actions: {
          applyPrompt: "A rainy neon city street at night",
          variations: ["unused"],
          describeTargets: ["ref-1"],
          referenceCard: { title: "Prompt", prompt: "unused card" },
        },
      },
      fallbackPrompt: "fallback",
    });

    expect(normalized.actions).toEqual({
      applyPrompt: "A rainy neon city street at night",
    });
    expect(normalized.message).toBe("A rainy neon city street at night");
  });
});
