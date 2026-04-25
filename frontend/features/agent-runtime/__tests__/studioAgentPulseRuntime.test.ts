import { describe, expect, it, vi } from "vitest";
import {
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
        presetId: "product_hero",
        label: "Product Hero",
        instructions: "Run the workflow one step at a time.",
        outputMode: "chat_reply",
        workflowSession: {
          presetId: "product_hero",
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
      expect.stringContaining('"presetId":"product_hero"')
    );

    warnSpy.mockRestore();
  });
});
