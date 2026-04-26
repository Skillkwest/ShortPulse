import { describe, expect, it } from "vitest";
import type { StudioOutput } from "../../types";
import {
  buildGenerationReplayConfigV1,
  canRerollOutput,
  isGenerationReplayConfigV1,
} from "../generationReplay";

describe("generationReplay", () => {
  it("builds a normalized v1 replay config for image outputs", () => {
    const replay = buildGenerationReplayConfigV1({
      mode: "image",
      submitTool: "edit",
      modelId: "fal-ai/bytedance/seedream/v4.5/edit",
      displayPrompt: "Visible prompt",
      submissionPrompt: "Injected + visible prompt",
      aspect: "9:16",
      imageResolution: "auto_4K",
      referenceInputs: [" https://example.com/ref-a.png ", "", "https://example.com/ref-b.png"],
      characterContext: {
        applied: true,
        characterId: "char-1",
        characterName: "Nova",
        lookId: "2",
        lookName: "Hero Close-Up",
      },
      styleContext: {
        applied: true,
        styleId: "style-photoreal",
        styleName: "Photorealistic",
        stylePrompt: "natural skin texture, neutral palette",
      },
      capturedAt: "2026-02-25T00:00:00.000Z",
    });

    expect(replay).toEqual({
      version: 1,
      mode: "image",
      submitTool: "edit",
      modelId: "fal-ai/bytedance/seedream/v4.5/edit",
      displayPrompt: "Visible prompt",
      submissionPrompt: "Injected + visible prompt",
      aspect: "9:16",
      imageResolution: "auto_4K",
      referenceInputs: ["https://example.com/ref-a.png", "https://example.com/ref-b.png"],
      characterContext: {
        applied: true,
        characterId: "char-1",
        characterName: "Nova",
        lookId: "2",
        lookName: "Hero Close-Up",
      },
      styleContext: {
        applied: true,
        styleId: "style-photoreal",
        styleName: "Photorealistic",
        stylePrompt: "natural skin texture, neutral palette",
      },
      capturedAt: "2026-02-25T00:00:00.000Z",
    });
    expect(isGenerationReplayConfigV1(replay)).toBe(true);
  });

  it("returns null for unsupported replay sources", () => {
    expect(
      buildGenerationReplayConfigV1({
        mode: "video",
        submitTool: "edit",
        modelId: "fal-ai/model",
        displayPrompt: "x",
        submissionPrompt: "x",
        aspect: "16:9",
        imageResolution: null,
        referenceInputs: [],
      })
    ).toBeNull();
    expect(
      buildGenerationReplayConfigV1({
        mode: "image",
        submitTool: "video",
        modelId: "fal-ai/model",
        displayPrompt: "x",
        submissionPrompt: "x",
        aspect: "16:9",
        imageResolution: null,
        referenceInputs: [],
      })
    ).toBeNull();
  });

  it("allows reroll only for generated image outputs with valid replay config", () => {
    const output: StudioOutput = {
      id: "out-1",
      prompt: "Prompt",
      mode: "image",
      aspect: "1:1",
      model: "Model",
      status: "ready",
      timestamp: "Now",
      mediaSource: "generated",
      previewUrl: "https://example.com/image.png",
      generationReplay: {
        version: 1,
        mode: "image",
        submitTool: "create",
        modelId: "fal-ai/bytedance/seedream/v4.5/text-to-image",
        displayPrompt: "Prompt",
        submissionPrompt: "Prompt",
        aspect: "1:1",
        imageResolution: null,
        referenceInputs: [],
        capturedAt: "2026-02-25T00:00:00.000Z",
      },
    };

    expect(canRerollOutput(output)).toBe(true);
    expect(canRerollOutput({ ...output, mediaSource: "upload" })).toBe(false);
    expect(canRerollOutput({ ...output, mode: "video" })).toBe(false);
    expect(canRerollOutput({ ...output, generationReplay: undefined })).toBe(false);
  });
});
