import { describe, expect, it } from "vitest";
import { CHARACTER_MODE_MISSING_REFERENCES_ERROR } from "../../logic/generationStartPolicy";
import { resolveCharacterModeBlockDecision } from "../generationCharacterModeDecision";

describe("generationCharacterModeDecision", () => {
  it("blocks Create Character Mode when only user references are present", () => {
    const decision = resolveCharacterModeBlockDecision({
      tool: "create",
      mode: "image",
      modelId: "fal-ai/nano-banana-2/edit",
      promptText: "User prompt",
      allowCreateFallbackBlock: true,
      overrides: {
        submissionPromptOverride: "Character description\n\nUser prompt",
        displayPromptOverride: "User prompt",
        referenceInputsOverride: ["https://example.com/user-reference.png"],
        notice: null,
        fallbackCode: "no_references",
        characterReferenceCount: 0,
        hasCharacterDescription: true,
      },
    });

    expect(decision).toEqual({
      blocked: true,
      message: CHARACTER_MODE_MISSING_REFERENCES_ERROR,
      event: "character_mode_submit_blocked_no_references",
      telemetry: {
        fallback_code: "no_references",
        has_character_description: true,
        character_reference_count: 0,
      },
      overrides: {
        submissionPromptOverride: "Character description\n\nUser prompt",
        displayPromptOverride: "User prompt",
        referenceInputsOverride: ["https://example.com/user-reference.png"],
        notice: null,
        fallbackCode: "no_references",
        characterReferenceCount: 0,
        hasCharacterDescription: true,
      },
    });
  });
});
