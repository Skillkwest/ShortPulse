import { describe, expect, it } from "vitest";
import { groupVisibleFailuresForAlertStack } from "../AiStudioPageContent";

describe("groupVisibleFailuresForAlertStack", () => {
  it("groups repeated failures with the same model label and message", () => {
    const grouped = groupVisibleFailuresForAlertStack([
      {
        id: "out-1",
        model: "ElevenLabs Music",
        modelId: "music_v1",
        prompt: "first",
        errorMessage: "text must be 2000 characters or fewer.",
        errorMessageShort: "text must be 2000 characters or fewer.",
        errorDetail: "text must be 2000 characters or fewer.",
      },
      {
        id: "out-2",
        model: "ElevenLabs Music",
        modelId: "music_v1",
        prompt: "second",
        errorMessage: "text must be 2000 characters or fewer.",
        errorMessageShort: "text must be 2000 characters or fewer.",
        errorDetail: "text must be 2000 characters or fewer.",
      },
    ]);

    expect(grouped).toEqual([
      {
        ids: ["out-1", "out-2"],
        modelLabel: "Music",
        failureMessage: "text must be 2000 characters or fewer.",
        count: 2,
      },
    ]);
  });

  it("keeps distinct service messages in separate groups", () => {
    const grouped = groupVisibleFailuresForAlertStack([
      {
        id: "out-1",
        model: "ElevenLabs Music",
        modelId: "music_v1",
        prompt: "first",
        errorMessage: "text must be 2000 characters or fewer.",
        errorMessageShort: "text must be 2000 characters or fewer.",
        errorDetail: "text must be 2000 characters or fewer.",
      },
      {
        id: "out-2",
        model: "ElevenLabs Music",
        modelId: "music_v1",
        prompt: "second",
        errorMessage: "Provider unavailable",
        errorMessageShort: "Provider unavailable",
        errorDetail: "Provider unavailable",
      },
    ]);

    expect(grouped).toHaveLength(2);
    expect(grouped[0]?.count).toBe(1);
    expect(grouped[1]?.count).toBe(1);
  });

  it("normalizes raw JSON validation detail before grouping failure alerts", () => {
    const grouped = groupVisibleFailuresForAlertStack([
      {
        id: "out-1",
        model: "Seedream 4.5 Edit",
        modelId: "fal-ai/bytedance/seedream/v4.5/edit",
        prompt: "first",
        errorMessage: "Invalid request",
        errorMessageShort: "Generation failed",
        errorDetail: '{"detail":[{"loc":["prompt"],"msg":"Field required","type":"missing"}]}',
      },
    ]);

    expect(grouped).toEqual([
      {
        ids: ["out-1"],
        modelLabel: "Seedream 4.5 Edit",
        failureMessage: "Prompt is required.",
        count: 1,
      },
    ]);
  });

  it("de-brands legacy Kie model labels before grouping failure alerts", () => {
    const grouped = groupVisibleFailuresForAlertStack([
      {
        id: "out-1",
        model: "Kie Kling 3.0",
        modelId: "legacy-kie-kling",
        prompt: "first",
        errorMessage: "Generation failed",
        errorMessageShort: "Generation failed",
        errorDetail: "Kie Kling 3.0 submit requires at least one image URL.",
      },
    ]);

    expect(grouped).toEqual([
      {
        ids: ["out-1"],
        modelLabel: "Kling 3.0",
        failureMessage: "Kling 3.0 submit requires at least one image URL.",
        count: 1,
      },
    ]);
  });

  it("de-brands legacy Veo provider labels and I2V suffixes before grouping failure alerts", () => {
    const grouped = groupVisibleFailuresForAlertStack([
      {
        id: "out-1",
        model: "Kie VEO 3.1 Fast I2V",
        modelId: "legacy-kie-veo",
        prompt: "first",
        errorMessage: "Generation failed",
        errorMessageShort: "Generation failed",
        errorDetail: "Kie VEO 3.1 Fast I2V submit requires an image URL.",
      },
    ]);

    expect(grouped).toEqual([
      {
        ids: ["out-1"],
        modelLabel: "Veo 3.1 Fast",
        failureMessage: "Veo 3.1 Fast submit requires an image URL.",
        count: 1,
      },
    ]);
  });
});
