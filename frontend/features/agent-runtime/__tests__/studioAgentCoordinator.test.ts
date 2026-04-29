/**
 * Tests Pulse-aware system message injection for the single-stage coordinator path.
 */
import { describe, expect, it } from "vitest";
import { buildStudioAgentOpenAiMessages } from "../pulseStudioAgentRuntime/coordinator";

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
          workflowStageHints: ["Intake", "Hook", "Payoff"],
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
    expect(messages[1]?.content).toContain("workflow_stage_hints:");
    expect(messages[1]?.content).toContain("2. Hook");
    expect(messages[1]?.content).toContain('"currentStepLabel":"Hook"');
  });

  it("does not prepend the latest assistant message twice when it already exists in history", () => {
    const messages = buildStudioAgentOpenAiMessages({
      messages: [
        { role: "user", content: "Step 1" },
        { role: "assistant", content: "Step 1 - Upload your image." },
        { role: "user", content: "Step 2" },
      ],
      context: {
        mode: "text",
        lastAssistantMessage: "Step 1 - Upload your image. ",
      },
      systemPrompt: "base-system",
      orchestration: {
        flow: "TEXT_ONLY",
        contextType: "agent-output",
        userInput: "Step 2",
        textInput: "Step 2",
        imageReferenceIds: [],
        promptReferenceIds: [],
        shouldRunTextExpansion: true,
        shouldRunVisionDescription: false,
        shouldRunFusion: false,
      },
    });

    expect(messages).toHaveLength(6);
    expect(messages.map((message) => message.role)).toEqual([
      "system",
      "system",
      "system",
      "user",
      "assistant",
      "user",
    ]);
    expect(messages).not.toContainEqual({
      role: "assistant",
      content: "Step 1 - Upload your image. ",
    });
    expect(messages).toContainEqual({
      role: "assistant",
      content: "Step 1 - Upload your image.",
    });
  });
});
