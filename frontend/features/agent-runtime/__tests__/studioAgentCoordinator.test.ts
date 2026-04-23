/**
 * Tests Pulse-aware system message injection for the single-stage coordinator path.
 */
import { describe, expect, it } from "vitest";
import { buildStudioAgentOpenAiMessages } from "../studioAgentCoordinator";

describe("buildStudioAgentOpenAiMessages", () => {
  it("injects a hidden Pulse system message when pulse runtime context is active", () => {
    const messages = buildStudioAgentOpenAiMessages({
      messages: [{ role: "user", content: "Make this feel more ad-like." }],
      context: {
        mode: "text",
        pulse: {
          presetId: "ad_hook",
          label: "Ad Hook",
          instructions: "Lead with an instantly readable hook and clear product payoff.",
          source: "builtin",
          workflowSession: {
            presetId: "ad_hook",
            status: "awaiting_input",
            currentStepIndex: 2,
            currentStepLabel: "Hook",
            currentStepPrompt: "Step 2 — Hook",
            collectedInputs: ["cold open"],
            lastArtifact: null,
          },
        },
      },
      systemPrompt: "base-system",
      orchestration: {
        flow: "TEXT_ONLY",
        contextType: "prompt",
        userInput: "Make this feel more ad-like.",
        textInput: "Base prompt",
        imageReferenceIds: [],
        promptReferenceIds: [],
        shouldRunTextExpansion: true,
        shouldRunVisionDescription: false,
        shouldRunFusion: false,
      },
    });

    expect(messages.slice(0, 3)).toEqual([
      { role: "system", content: "base-system" },
      expect.objectContaining({
        role: "system",
        content: expect.stringContaining("ACTIVE PULSE PROFILE"),
      }),
      expect.objectContaining({
        role: "system",
        content: expect.stringContaining('"presetId":"ad_hook"'),
      }),
    ]);
    expect(messages[1]?.content).toContain("workflow_session_state:");
    expect(messages[1]?.content).toContain('"currentStepLabel":"Hook"');
  });
});
