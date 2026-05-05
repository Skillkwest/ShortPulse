import { describe, expect, it, vi } from "vitest";
import {
  buildStudioAgentPulseActivationSeed,
  buildStudioAgentPulseSystemMessage,
  buildStudioAgentWorkflowSessionUpdate,
  resolveLatestStudioAgentUserInput,
} from "../studioAgentPulseRuntime";

describe("studioAgentPulseRuntime", () => {
  it("ignores hidden Pulse activation seeds when resolving the latest user input", () => {
    expect(
      resolveLatestStudioAgentUserInput([
        { role: "user", content: 'Pulse "Story Builder" was just activated.' },
        { role: "assistant", content: "Step 1 - Upload characters." },
        { role: "user", content: "A knight enters a cursed forest." },
      ])
    ).toBe("A knight enters a cursed forest.");
  });

  it("appends the latest user input when the existing workflow session is stale", () => {
    const session = buildStudioAgentWorkflowSessionUpdate({
      pulse: {
        presetId: "story_builder",
        label: "Story Builder",
        instructions: "Run the workflow one step at a time.",
        workflowStageHints: ["Upload Characters", "Plot Seed", "Runtime"],
        outputMode: "chat_reply",
        workflowSession: {
          presetId: "story_builder",
          status: "running",
          currentStepIndex: 2,
          currentStepLabel: "Plot Seed",
          currentStepPrompt: "Step 2 - Share a plot seed.",
          collectedInputs: ["grimdark tone"],
          lastArtifact: null,
          finalArtifactSource: null,
        },
      },
      response: {
        message: "Step 3 - How long should it be?",
      },
      semanticStatus: "needs_input",
      latestUserInput: "A knight enters a cursed forest to recover a relic.",
    });

    expect(session).toEqual(
      expect.objectContaining({
        status: "awaiting_input",
        currentStepIndex: 3,
        currentStepLabel: "Runtime",
        collectedInputs: ["grimdark tone", "A knight enters a cursed forest to recover a relic."],
      })
    );
  });

  it("logs a repeat-risk warning when the same step is returned after a non-empty user answer", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    buildStudioAgentWorkflowSessionUpdate({
      pulse: {
        presetId: "story_builder",
        label: "DFY Story Builder",
        instructions: "Run the workflow one step at a time.",
        outputMode: "chat_reply",
        workflowSession: {
          presetId: "story_builder",
          status: "awaiting_input",
          currentStepIndex: 3,
          currentStepLabel: "Lighting",
          currentStepPrompt: "What lighting should the hero image use?",
          collectedInputs: ["gold jewelry"],
          lastArtifact: null,
          finalArtifactSource: null,
        },
      },
      response: {
        message: "What lighting should the hero image use?",
      },
      semanticStatus: "needs_input",
      latestUserInput: "Soft diffused glow",
    });

    expect(warnSpy).toHaveBeenCalledWith(
      "[studio-agent][pulse-repeat-risk]",
      expect.stringContaining('"presetId":"story_builder"')
    );

    warnSpy.mockRestore();
  });

  it("includes workflow stage hints and anti-restart guidance in the hidden Pulse system message", () => {
    const systemMessage = buildStudioAgentPulseSystemMessage({
      presetId: "image",
      label: "Video Prompt Magic",
      instructions: "Follow the guided video workflow one step at a time.",
      artifactTarget: "video_prompt",
      starterAssistantMessage: "Upload your image to get the process started :)",
      workflowStageHints: ["Image Gate", "Camera Motion", "Action Selection", "Dialogue"],
      workflowSession: {
        presetId: "image",
        status: "awaiting_input",
        currentStepIndex: 3,
        currentStepLabel: "Action Selection",
        currentStepPrompt: "What should the subject do in the clip?",
        collectedInputs: ["uploaded bird image", "360 orbit"],
        lastArtifact: null,
        finalArtifactSource: null,
      },
    });

    expect(systemMessage).toContain("workflow_stage_hints:");
    expect(systemMessage).toContain("1. Image Gate");
    expect(systemMessage).toContain("3. Action Selection");
    expect(systemMessage).toContain(
      "Use a polished rich-guided layout for user-facing replies instead of flat plain text."
    );
    expect(systemMessage).toContain(
      "Prefer markdown-like headings, short intro paragraphs, blank-line separated sections, separator lines, reply-choice rows, and numbered option cards when they improve scanability."
    );
    expect(systemMessage).toContain("Continue from the active workflow_session_state.");
    expect(systemMessage).toContain(
      "If workflow_session_state.currentStepIndex is greater than 1, treat the starter/upload step as already satisfied."
    );
    expect(systemMessage).toContain(
      "Do not restart from the first step, substitute a different workflow, or invent a new intake step unless the user explicitly asks to restart."
    );
    expect(systemMessage).toContain("artifact_target: video_prompt");
  });

  it("does not force the starter upload reply when activation already has an image-satisfied workflow session", () => {
    const activationSeed = buildStudioAgentPulseActivationSeed({
      presetId: "image",
      label: "Video Prompt Magic",
      instructions: "Follow the guided video workflow.",
      starterAssistantMessage: "Upload your image to get the process started :)",
      workflowStageHints: ["Image Gate", "Camera Motion", "Action Selection"],
      workflowSession: {
        presetId: "image",
        status: "running",
        currentStepIndex: 2,
        currentStepLabel: "Camera Motion",
        currentStepPrompt: null,
        collectedInputs: ["Uploaded image attached"],
        lastArtifact: null,
        finalArtifactSource: null,
      },
    });

    expect(activationSeed).toContain("Continue from the active workflow_session_state");
    expect(activationSeed).toContain("Do not repeat the starter upload message.");
    expect(activationSeed).not.toContain("Your first assistant reply must be exactly this");
  });

  it("starts custom pulses without requiring hidden starter metadata", () => {
    const activationSeed = buildStudioAgentPulseActivationSeed({
      presetId: "custom",
      label: "Custom Pulse",
      instructions: "Ask one focused setup question before producing the final result.",
      starterAssistantMessage: null,
      workflowStageHints: null,
      outputMode: "chat_reply",
      source: "custom",
    });
    const systemMessage = buildStudioAgentPulseSystemMessage({
      presetId: "custom",
      label: "Custom Pulse",
      instructions: "Ask one focused setup question before producing the final result.",
      starterAssistantMessage: null,
      workflowStageHints: null,
      outputMode: "chat_reply",
      source: "custom",
    });

    expect(activationSeed).toContain("Start the workflow now.");
    expect(activationSeed).toContain(
      "Reply with only the first required assistant step or question."
    );
    expect(systemMessage).toContain("preset_source: custom");
    expect(systemMessage).toContain(
      "Ask one focused setup question before producing the final result."
    );
    expect(systemMessage).not.toContain("starter_assistant_message:");
    expect(systemMessage).not.toContain("workflow_stage_hints:");
  });
});
