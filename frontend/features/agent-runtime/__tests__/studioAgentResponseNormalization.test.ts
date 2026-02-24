import { describe, expect, it } from "vitest";
import {
  buildStudioAgentSemanticResponse,
  ensureStudioAgentApplyPromptContract,
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
