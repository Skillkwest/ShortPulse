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
        pulseKind: "guided_workflow",
        artifactTarget: "image_prompt",
      })
    );
  });

  it("lets an admin-owned prompt_modifier built-in override stale user rows", () => {
    const catalog = resolveCreatePulsePresetCatalog(
      [
        {
          presetId: "prompt_modifier",
          label: "User Prompt Modifier",
          description: null,
          systemInstructions: "Stale user override.",
          createdAt: "2026-07-05T00:00:00.000Z",
        },
      ],
      [
        {
          presetId: "prompt_modifier",
          label: "Prompt Modifier",
          description: "Modify prompts.",
          pulseKind: "guided_workflow",
          runtimeMode: "workflow_gpt",
          activationMode: "activate_and_start",
          starterAssistantMessage: "Paste the prompt you want to modify.",
          workflowStageHints: ["Paste prompt"],
          outputMode: "chat_reply",
          artifactTarget: "video_prompt",
          memoryPolicy: "session",
          schemaVersion: 2,
        },
      ]
    );

    expect(catalog).toHaveLength(1);
    expect(catalog[0]).toEqual(
      expect.objectContaining({
        presetId: "prompt_modifier",
        label: "Prompt Modifier",
        isBuiltIn: true,
        hasUserOverride: false,
      })
    );
  });

  it("resolves explicit built-in artifact targets and strips legacy custom artifact metadata", () => {
    const catalog = resolveCreatePulsePresetCatalog([
      {
        presetId: "pulse_custom",
        label: "Custom Pulse",
        description: null,
        systemInstructions: "Guide the user through a text-only workflow.",
        runtimeMode: "workflow_gpt",
        activationMode: "activate_and_start",
        starterAssistantMessage: "Legacy hidden starter.",
        workflowStageHints: ["Legacy", "Workflow"],
        outputMode: "chat_reply",
        artifactTarget: "video_prompt",
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
    expect(catalog.find((preset) => preset.presetId === "pulse_custom")).toEqual(
      expect.objectContaining({
        pulseKind: "custom_gpt",
        runtimeMode: "custom_gpt",
        activationMode: "activate_and_start",
        starterAssistantMessage: null,
        workflowStageHints: null,
        outputMode: "chat_reply",
      })
    );
    expect(catalog.find((preset) => preset.presetId === "pulse_custom")?.artifactTarget).toBe(
      undefined
    );
  });

  it("normalizes legacy saved workflow records into custom Pulse presets", () => {
    const catalog = resolveCreatePulsePresetCatalog([
      {
        presetId: "legacy_custom_workflow",
        label: "Legacy Custom Workflow",
        description: null,
        systemInstructions: "Only these instructions should remain active.",
        pulseKind: "guided_workflow",
        runtimeMode: "workflow_gpt",
        activationMode: "activate_only",
        starterAssistantMessage: "Legacy starter.",
        workflowStageHints: ["Legacy", "Steps"],
        outputMode: "apply_prompt",
        artifactTarget: "image_prompt",
        memoryPolicy: "session",
        createdAt: "2026-04-28T00:00:00.000Z",
      },
    ]);

    expect(catalog.find((preset) => preset.presetId === "legacy_custom_workflow")).toEqual(
      expect.objectContaining({
        pulseKind: "custom_gpt",
        runtimeMode: "custom_gpt",
        activationMode: "activate_and_start",
        starterAssistantMessage: null,
        workflowStageHints: null,
        outputMode: "chat_reply",
      })
    );
    expect(
      catalog.find((preset) => preset.presetId === "legacy_custom_workflow")?.artifactTarget
    ).toBe(undefined);
  });
});
