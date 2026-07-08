import { describe, expect, it } from "vitest";

import {
  buildPendingPulseWorkflowSessionForStart,
  buildPendingPulseWorkflowSessionForUserInput,
  derivePulseWorkflowSession,
  reconcilePulseWorkflowSession,
} from "../pulseWorkflowSession";

describe("pulseWorkflowSession", () => {
  it("starts a pending workflow session without synthesizing starter metadata", () => {
    const session = buildPendingPulseWorkflowSessionForStart({
      preset: {
        presetId: "story_builder",
        runtimeMode: "workflow_gpt",
      },
    });

    expect(session).toEqual({
      presetId: "story_builder",
      status: "running",
      currentStepIndex: null,
      currentStepLabel: null,
      currentStepPrompt: null,
      collectedInputs: [],
      lastArtifact: null,
      finalArtifactSource: null,
    });
  });

  it("builds a pending workflow session on user input without re-deriving from transcript", () => {
    const session = buildPendingPulseWorkflowSessionForUserInput({
      preset: {
        presetId: "story_builder",
        runtimeMode: "workflow_gpt",
      },
      existingSession: {
        presetId: "story_builder",
        status: "awaiting_input",
        currentStepIndex: 2,
        currentStepLabel: "Plot Seed",
        currentStepPrompt: "Step 2 - Basic plot. Share a 1-2 sentence plot idea.",
        collectedInputs: ["grimdark"],
        lastArtifact: null,
      },
      userInput: "A knight enters a cursed forest",
    });

    expect(session).toEqual({
      presetId: "story_builder",
      status: "running",
      currentStepIndex: 2,
      currentStepLabel: "Plot Seed",
      currentStepPrompt: "Step 2 - Basic plot. Share a 1-2 sentence plot idea.",
      collectedInputs: ["grimdark", "A knight enters a cursed forest"],
      lastArtifact: null,
      finalArtifactSource: null,
    });
  });

  it("does not derive workflow step metadata from retired stage hints", () => {
    const session = derivePulseWorkflowSession({
      preset: {
        presetId: "story_builder",
        runtimeMode: "workflow_gpt",
      },
      agentMessages: [
        { id: "u1", role: "user", content: "Here are my character images." },
        {
          id: "a1",
          role: "assistant",
          content: "What tone should the story have?",
        },
      ],
      isSending: false,
    });

    expect(session).toEqual({
      presetId: "story_builder",
      status: "awaiting_input",
      currentStepIndex: null,
      currentStepLabel: null,
      currentStepPrompt: "What tone should the story have?",
      collectedInputs: ["Here are my character images."],
      lastArtifact: null,
      finalArtifactSource: null,
    });
  });

  it("does not synthesize an idle workflow session from an active Pulse with no transcript", () => {
    const session = derivePulseWorkflowSession({
      preset: {
        presetId: "story_builder",
        runtimeMode: "workflow_gpt",
      },
      agentMessages: [],
      isSending: false,
    });

    expect(session).toBeNull();
  });

  it("preserves completed authoritative workflow artifacts while still refreshing collected inputs", () => {
    const reconciled = reconcilePulseWorkflowSession({
      authoritative: {
        presetId: "story_builder",
        status: "completed",
        currentStepIndex: 6,
        currentStepLabel: "Image Prompts",
        currentStepPrompt: null,
        collectedInputs: ["old input"],
        lastArtifact: "Scene 1: final prompt block",
      },
      derived: {
        presetId: "story_builder",
        status: "awaiting_input",
        currentStepIndex: 5,
        currentStepLabel: "Scene Review",
        currentStepPrompt: "Keep modifying, or are you satisfied?",
        collectedInputs: ["new input", "looks good"],
        lastArtifact: null,
      },
      isSending: false,
    });

    expect(reconciled).toEqual({
      presetId: "story_builder",
      status: "completed",
      currentStepIndex: 6,
      currentStepLabel: "Image Prompts",
      currentStepPrompt: null,
      collectedInputs: ["new input", "looks good"],
      lastArtifact: "Scene 1: final prompt block",
      finalArtifactSource: null,
    });
  });
});
