import { describe, expect, it } from "vitest";
import {
  CHARACTER_MODE_MISSING_REFERENCES_ERROR,
  CREATE_TEXT_MODE_GENERATION_BLOCK_ERROR,
  GENERATION_MISSING_MODEL_ERROR,
  GENERATION_MISSING_PROMPT_ERROR,
  resolveGenerationStartDecision,
} from "../generationStartPolicy";

describe("generationStartPolicy", () => {
  it("allows eligible create/image generation", () => {
    const decision = resolveGenerationStartDecision({
      tool: "create",
      mode: "image",
      modelId: "fal-ai/bytedance/seedream/v4.5/text-to-image",
      promptText: "A cinematic portrait",
    });

    expect(decision).toEqual({ allow: true });
  });

  it("blocks create/text mode generate path with explicit message", () => {
    const decision = resolveGenerationStartDecision({
      tool: "create",
      mode: "text",
      modelId: "fal-ai/bytedance/seedream/v4.5/text-to-image",
      promptText: "Prompt",
    });

    expect(decision).toEqual({
      allow: false,
      reason: "create_text_mode",
      message: CREATE_TEXT_MODE_GENERATION_BLOCK_ERROR,
    });
  });

  it("blocks missing prompt with explicit message", () => {
    const decision = resolveGenerationStartDecision({
      tool: "edit",
      mode: "image",
      modelId: "fal-ai/bytedance/seedream/v4.5/edit",
      promptText: "   ",
    });

    expect(decision).toEqual({
      allow: false,
      reason: "missing_prompt",
      message: GENERATION_MISSING_PROMPT_ERROR,
    });
  });

  it("allows missing prompt when prompt check is explicitly disabled", () => {
    const decision = resolveGenerationStartDecision({
      tool: "edit",
      mode: "image",
      modelId: "fal-ai/unknown/edit",
      promptText: "   ",
      checkPrompt: false,
    });

    expect(decision).toEqual({ allow: true });
  });

  it("blocks missing model where model selection is required", () => {
    const decision = resolveGenerationStartDecision({
      tool: "video",
      mode: "video",
      modelId: null,
      promptText: "Prompt",
    });

    expect(decision).toEqual({
      allow: false,
      reason: "missing_model",
      message: GENERATION_MISSING_MODEL_ERROR,
    });
  });

  it("blocks character mode create submit when character references are required and missing", () => {
    const decision = resolveGenerationStartDecision({
      tool: "create",
      mode: "image",
      modelId: "fal-ai/bytedance/seedream/v4.5/edit",
      promptText: "Prompt",
      checkCreateTextMode: false,
      checkPrompt: false,
      checkModel: false,
      checkCharacterReferences: true,
      hasCharacterModeReferences: false,
    });

    expect(decision).toEqual({
      allow: false,
      reason: "missing_character_references",
      message: CHARACTER_MODE_MISSING_REFERENCES_ERROR,
    });
  });
});
