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

  it("keeps semantic parser strict when output is unstructured text", () => {
    const parsed = parseStudioAgentSemanticOutput(
      "Here is your revised prompt: a cinematic portrait with soft rim light and subtle film grain"
    );
    expect(parsed).toBeNull();
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

  it("keeps unstructured refusal text out of semantic parser path", () => {
    const parsed = parseStudioAgentSemanticOutput(
      "I cannot help with that request due to safety policy."
    );
    expect(parsed).toBeNull();
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

  it("preserves structured message text for workflow chat display", () => {
    const parsed = parseStudioAgentJsonWithStatus(
      JSON.stringify({
        status: "needs_input",
        message:
          "This prompt now includes a sharper product angle. What product should anchor the first shot?",
        actions: null,
      }),
      { allowUnstructured: false }
    );

    expect(parsed?.response.message).toBe(
      "This prompt now includes a sharper product angle. What product should anchor the first shot?"
    );
    expect(parsed?.response.actions).toBeUndefined();
  });

  it("falls back to unstructured text when no JSON payload exists", () => {
    const parsed = parseStudioAgentJsonWithStatus(
      "Final prompt: dramatic portrait in moody neon lighting, low-angle composition"
    );

    expect(parsed).toEqual({
      status: "ready",
      response: {
        message: "dramatic portrait in moody neon lighting, low-angle composition",
        actions: { applyPrompt: "dramatic portrait in moody neon lighting, low-angle composition" },
      },
    });
  });

  it("accepts structured message-only payloads without fabricating prompt actions", () => {
    const parsed = parseStudioAgentJsonWithStatus(
      '{"message":"Summary: transformed the prompt","actions":{"apply_prompt":"The prompt now includes stronger detail."}}'
    );

    expect(parsed).toEqual({
      status: null,
      response: {
        message: "Summary: transformed the prompt",
        actions: undefined,
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
