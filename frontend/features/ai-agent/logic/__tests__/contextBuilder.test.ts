/**
 * Tests agent context sanitization for media payload construction.
 */
import { describe, expect, it } from "vitest";
import { buildAgentContext } from "../contextBuilder";

describe("buildAgentContext media filtering", () => {
  it("keeps https image media and capped image data URLs", () => {
    const context = buildAgentContext({
      mode: "image",
      media: [
        { id: "https-img", kind: "image", url: "https://cdn.example.com/a.jpg" },
        { id: "data-img", kind: "image", url: "data:image/png;base64,YWJjMTIz" },
        { id: "video", kind: "video", url: "https://cdn.example.com/clip.mp4" },
        { id: "blob-like", kind: "image", url: "blob:abc123" },
      ],
    });

    expect(context.media).toEqual([
      { id: "https-img", kind: "image", url: "https://cdn.example.com/a.jpg" },
      { id: "data-img", kind: "image", url: "data:image/png;base64,YWJjMTIz" },
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

  it("passes through guided workflow pulse metadata", () => {
    const context = buildAgentContext({
      mode: "text",
      pulse: {
        presetId: " pulse_story_builder ",
        label: " Story Builder ",
        instructions: " Keep the output focused on a simple hook, escalation, and payoff. ",
        pulseKind: "guided_workflow",
        artifactTarget: "storyboard",
        source: "custom",
        workflowSession: {
          presetId: " pulse_story_builder ",
          status: "awaiting_input",
          currentStepIndex: 3,
          currentStepLabel: "Runtime",
          currentStepPrompt: "Step 3 — How long should it be?",
          collectedInputs: ["grimdark", "A knight enters a cursed forest"],
          lastArtifact: null,
          finalArtifactSource: "chat_reply",
        },
      },
    });

    expect(context.pulse).toEqual({
      presetId: "pulse_story_builder",
      label: "Story Builder",
      description: null,
      instructions: "Keep the output focused on a simple hook, escalation, and payoff.",
      pulseKind: "guided_workflow",
      runtimeMode: "workflow_gpt",
      activationMode: "activate_and_start",
      starterAssistantMessage: null,
      workflowStageHints: null,
      outputMode: "chat_reply",
      artifactTarget: "storyboard",
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
        finalArtifactSource: "chat_reply",
      },
    });
  });

  it("keeps custom pulse payloads minimal and strips guided workflow fields", () => {
    const context = buildAgentContext({
      mode: "text",
      pulse: {
        presetId: " pulse_custom ",
        label: " Custom Pulse ",
        instructions: ' Reply with "CUSTOM" and nothing else. ',
        pulseKind: "custom_gpt",
        runtimeMode: "workflow_gpt",
        activationMode: "activate_and_start",
        starterAssistantMessage: "Legacy starter",
        workflowStageHints: ["Legacy Step"],
        outputMode: "chat_reply",
        artifactTarget: "storyboard",
        memoryPolicy: "session",
        source: "custom",
        workflowSession: {
          presetId: "pulse_custom",
          status: "awaiting_input",
          currentStepIndex: 2,
          currentStepLabel: "Legacy",
          currentStepPrompt: "Legacy prompt",
          collectedInputs: ["stale"],
          lastArtifact: null,
          finalArtifactSource: "chat_reply",
        },
        schemaVersion: 3,
      },
    });

    expect(context.pulse).toEqual({
      presetId: "pulse_custom",
      label: "Custom Pulse",
      description: null,
      instructions: 'Reply with "CUSTOM" and nothing else.',
      pulseKind: "custom_gpt",
      source: "custom",
      schemaVersion: 3,
    });
  });

  it("preserves built-in guided workflow pulse context when instructions are resolved server-side", () => {
    const context = buildAgentContext({
      mode: "text",
      pulse: {
        presetId: " story_builder ",
        label: " Story Builder ",
        instructions: "   ",
        pulseKind: "guided_workflow",
        runtimeMode: "workflow_gpt",
        activationMode: "activate_and_start",
        outputMode: "chat_reply",
        source: "builtin",
        workflowSession: {
          presetId: "story_builder",
          status: "running",
          currentStepIndex: 1,
          currentStepLabel: "Upload Characters",
          currentStepPrompt: "Upload your characters first.",
          collectedInputs: [],
          lastArtifact: null,
          finalArtifactSource: "chat_reply",
        },
      },
    });

    expect(context.pulse).toEqual({
      presetId: "story_builder",
      label: "Story Builder",
      description: null,
      pulseKind: "guided_workflow",
      runtimeMode: "workflow_gpt",
      activationMode: "activate_and_start",
      starterAssistantMessage: null,
      workflowStageHints: null,
      outputMode: "chat_reply",
      memoryPolicy: "session",
      source: "builtin",
      workflowSession: {
        presetId: "story_builder",
        status: "running",
        currentStepIndex: 1,
        currentStepLabel: "Upload Characters",
        currentStepPrompt: "Upload your characters first.",
        collectedInputs: [],
        lastArtifact: null,
        finalArtifactSource: "chat_reply",
      },
    });
  });
});
