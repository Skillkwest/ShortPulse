import { describe, expect, it } from "vitest";
import { resolveCreatePulsePresetCatalog } from "../createPulsePresets";

describe("createPulsePresets", () => {
  it("does not rehydrate hidden built-in workflow metadata after a simple override", () => {
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
        memoryPolicy: "session",
        createdAt: "2026-04-28T00:00:00.000Z",
      },
    ]);

    const storyBuilder = catalog.find((preset) => preset.presetId === "story_builder");

    expect(storyBuilder).toEqual(
      expect.objectContaining({
        label: "DFY Story Director",
        description: null,
        starterAssistantMessage: null,
        workflowStageHints: null,
        hasUserOverride: true,
      })
    );
  });
});
