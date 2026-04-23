/**
 * Tests agent context sanitization for media payload construction.
 */
import { describe, expect, it } from "vitest";
import { buildAgentContext } from "../contextBuilder";

describe("buildAgentContext media filtering", () => {
  it("keeps only https image media and drops data URLs", () => {
    const context = buildAgentContext({
      mode: "image",
      media: [
        { id: "https-img", kind: "image", url: "https://cdn.example.com/a.jpg" },
        { id: "data-img", kind: "image", dataUrl: "data:image/png;base64,abc123" },
        { id: "video", kind: "video", url: "https://cdn.example.com/clip.mp4" },
        { id: "blob-like", kind: "image", url: "blob:abc123" },
      ],
    });

    expect(context.media).toEqual([
      { id: "https-img", kind: "image", url: "https://cdn.example.com/a.jpg" },
    ]);
  });

  it("caps image media entries to three", () => {
    const context = buildAgentContext({
      mode: "image",
      media: [
        { id: "1", kind: "image", url: "https://cdn.example.com/1.jpg" },
        { id: "2", kind: "image", url: "https://cdn.example.com/2.jpg" },
        { id: "3", kind: "image", url: "https://cdn.example.com/3.jpg" },
        { id: "4", kind: "image", url: "https://cdn.example.com/4.jpg" },
      ],
    });

    expect(context.media).toHaveLength(3);
    expect(context.media?.map((item) => item.id)).toEqual(["1", "2", "3"]);
  });

  it("passes through valid pulse runtime metadata", () => {
    const context = buildAgentContext({
      mode: "text",
      pulse: {
        presetId: " pulse_story_builder ",
        label: " Story Builder ",
        instructions: " Keep the output focused on a simple hook, escalation, and payoff. ",
        source: "custom",
        workflowSession: {
          presetId: " pulse_story_builder ",
          status: "awaiting_input",
          currentStepIndex: 3,
          currentStepLabel: "Runtime",
          currentStepPrompt: "Step 3 — How long should it be?",
          collectedInputs: ["grimdark", "A knight enters a cursed forest"],
          lastArtifact: null,
        },
      },
    });

    expect(context.pulse).toEqual({
      presetId: "pulse_story_builder",
      label: "Story Builder",
      description: null,
      instructions: "Keep the output focused on a simple hook, escalation, and payoff.",
      runtimeMode: "prompt_editor",
      activationMode: "activate_only",
      starterAssistantMessage: null,
      outputMode: "apply_prompt",
      memoryPolicy: "session",
      source: "custom",
      workflowSession: {
        presetId: "pulse_story_builder",
        status: "awaiting_input",
        currentStepIndex: 3,
        currentStepLabel: "Runtime",
        currentStepPrompt: "Step 3 — How long should it be?",
        collectedInputs: ["grimdark", "A knight enters a cursed forest"],
        lastArtifact: null,
      },
    });
  });
});
