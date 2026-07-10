/**
 * Tests agent context sanitization for media payload construction.
 */
import { describe, expect, it } from "vitest";
import { buildAgentContext } from "../contextBuilder";

describe("buildAgentContext media filtering", () => {
  it("keeps supported image media and ignores non-image context", () => {
    const context = buildAgentContext({
      mode: "image",
      media: [
        { id: "https-img", kind: "image", url: "https://cdn.example.com/a.jpg" },
        { id: "data-img", kind: "image", url: "data:image/png;base64,YWJjMTIz" },
        { id: "video", kind: "video", url: "https://cdn.example.com/clip.mp4" },
      ],
    });

    expect(context.media).toEqual([
      { id: "https-img", kind: "image", url: "https://cdn.example.com/a.jpg" },
      { id: "data-img", kind: "image", url: "data:image/png;base64,YWJjMTIz" },
    ]);
  });

  it("rejects unsupported image media instead of silently dropping it", () => {
    expect(() =>
      buildAgentContext({
        mode: "image",
        media: [{ id: "blob-like", kind: "image", url: "blob:abc123" }],
      })
    ).toThrow("unsupported media URL");
  });

  it("rejects an eleventh image instead of silently truncating media", () => {
    expect(() =>
      buildAgentContext({
        mode: "image",
        media: Array.from({ length: 11 }, (_, index) => ({
          id: String(index + 1),
          kind: "image" as const,
          url: `https://cdn.example.com/${index + 1}.jpg`,
        })),
      })
    ).toThrow("support up to 10 images");
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
