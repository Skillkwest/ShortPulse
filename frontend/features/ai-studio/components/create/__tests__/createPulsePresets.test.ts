import { describe, expect, it } from "vitest";
import { resolveCreatePulsePresetCatalog } from "../createPulsePresets";

describe("createPulsePresets", () => {
  it("drops built-in collisions from saved per-user Pulse records", () => {
    const catalog = resolveCreatePulsePresetCatalog([
      {
        presetId: "story_builder",
        label: "DFY Story Director",
        description: null,
        systemInstructions: "Open with a fast paid-social visual hook and a clean benefit reveal.",
        runtimeMode: "workflow_gpt",
        activationMode: "activate_and_start",
        starterAssistantMessage: null,
        workflowStageHints: null,
        outputMode: "chat_reply",
        artifactTarget: "image_prompt",
        memoryPolicy: "session",
        createdAt: "2026-04-28T00:00:00.000Z",
      },
    ]);

    const storyBuilder = catalog.find((preset) => preset.presetId === "story_builder");

    expect(storyBuilder).toEqual(
      expect.objectContaining({
        label: "DFY Story Builder",
        hasUserOverride: false,
        artifactTarget: "image_prompt",
      })
    );
  });

  it("resolves explicit built-in artifact targets and defaults custom Pulses to text artifacts", () => {
    const catalog = resolveCreatePulsePresetCatalog([
      {
        presetId: "pulse_custom",
        label: "Custom Pulse",
        description: null,
        systemInstructions: "Guide the user through a text-only workflow.",
        runtimeMode: "workflow_gpt",
        activationMode: "activate_and_start",
        starterAssistantMessage: null,
        workflowStageHints: null,
        outputMode: "chat_reply",
        artifactTarget: "text_artifact",
        memoryPolicy: "session",
        createdAt: "2026-04-28T00:00:00.000Z",
      },
    ]);

    expect(catalog.find((preset) => preset.presetId === "image")?.artifactTarget).toBe(
      "video_prompt"
    );
    expect(catalog.find((preset) => preset.presetId === "multi_shot")?.artifactTarget).toBe(
      "video_prompt"
    );
    expect(catalog.find((preset) => preset.presetId === "story_builder")?.artifactTarget).toBe(
      "image_prompt"
    );
    expect(catalog.find((preset) => preset.presetId === "pulse_custom")?.artifactTarget).toBe(
      "text_artifact"
    );
  });
});
