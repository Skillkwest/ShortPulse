import { describe, expect, it } from "vitest";
import { resolveStudioAgentTurnResponse } from "../studioAgentTurnResponse";
import { STUDIO_AGENT_SAFETY_REFUSAL_MESSAGE } from "../studioAgentRouteOutcomes";

describe("resolveStudioAgentTurnResponse", () => {
  it("keeps refusal response actionless and preserves canonical prompt", () => {
    const result = resolveStudioAgentTurnResponse({
      parsed: {
        message: "I cannot help with that request.",
        actions: {
          applyPrompt: "should-not-survive",
        },
      },
      semanticStatus: "refuse",
      nextCanonical: "next canonical",
      effectiveCanonical: "existing canonical",
      context: {},
      messages: [{ role: "user", content: "disallowed change" }],
    });

    expect(result.refusal).toBe(true);
    expect(result.parsed.message).toBe(STUDIO_AGENT_SAFETY_REFUSAL_MESSAGE);
    expect(result.parsed.actions).toBeUndefined();
    expect(result.resolvedCanonical).toBe("existing canonical");
  });

  it("backfills applyPrompt from user input when no prompt action is returned", () => {
    const result = resolveStudioAgentTurnResponse({
      parsed: {
        message: "Summary: prompt updated.",
        actions: undefined,
      },
      semanticStatus: null,
      nextCanonical: null,
      effectiveCanonical: null,
      context: {},
      messages: [{ role: "user", content: "cinematic rain-soaked alley portrait" }],
    });

    expect(result.refusal).toBe(false);
    expect(result.parsed.actions?.applyPrompt).toBe("cinematic rain-soaked alley portrait");
    expect(result.resolvedCanonical).toBe("cinematic rain-soaked alley portrait");
  });

  it("keeps workflow pulse step turns message-only without synthesizing applyPrompt", () => {
    const result = resolveStudioAgentTurnResponse({
      parsed: {
        message: "Step 1 — Upload your image to get the process started :)",
        actions: undefined,
      },
      semanticStatus: null,
      nextCanonical: null,
      effectiveCanonical: "existing canonical",
      context: {
        pulse: {
          presetId: "image",
          label: "Video Prompt Magic",
          instructions: "Run the guided single-shot workflow.",
          runtimeMode: "workflow_gpt",
          activationMode: "activate_and_start",
          outputMode: "chat_reply",
          memoryPolicy: "session",
          source: "builtin",
        },
      },
      messages: [{ role: "user", content: "" }],
    });

    expect(result.refusal).toBe(false);
    expect(result.parsed.message).toBe("Step 1 — Upload your image to get the process started :)");
    expect(result.parsed.actions).toBeUndefined();
    expect(result.resolvedCanonical).toBe("existing canonical");
  });

  it("keeps ready custom Pulse replies chat-only unless applyPrompt is explicit", () => {
    const result = resolveStudioAgentTurnResponse({
      parsed: {
        message: "A cinematic dark-fantasy storyboard sequence with escalating beetle swarms.",
        actions: undefined,
      },
      semanticStatus: "ready",
      nextCanonical: "A cinematic dark-fantasy storyboard sequence with escalating beetle swarms.",
      effectiveCanonical: null,
      context: {
        pulse: {
          presetId: "custom_storyboard",
          label: "Storyboard Pulse",
          instructions: "Collect the brief, then output the final storyboard prompt.",
          runtimeMode: "custom_gpt",
          activationMode: "activate_and_start",
          outputMode: "chat_reply",
          memoryPolicy: "session",
          source: "custom",
        },
      },
      messages: [{ role: "user", content: "bugs dark bugs" }],
    });

    expect(result.refusal).toBe(false);
    expect(result.parsed.actions).toBeUndefined();
    expect(result.resolvedCanonical).toBeNull();
  });

  it("does not strip prompt-like wording from workflow pulse chat replies", () => {
    const result = resolveStudioAgentTurnResponse({
      parsed: {
        message:
          "This prompt now includes a sharper product angle. What product should anchor the first shot?",
        actions: undefined,
      },
      semanticStatus: "needs_input",
      nextCanonical: "fallback prompt",
      effectiveCanonical: "existing canonical",
      context: {
        pulse: {
          presetId: "pulse_custom",
          label: "Custom Pulse",
          instructions: "Ask one guided question at a time.",
          runtimeMode: "workflow_gpt",
          activationMode: "activate_and_start",
          outputMode: "chat_reply",
          memoryPolicy: "session",
          source: "custom",
        },
      },
      messages: [{ role: "user", content: "" }],
    });

    expect(result.parsed.message).toBe(
      "This prompt now includes a sharper product angle. What product should anchor the first shot?"
    );
    expect(result.parsed.actions).toBeUndefined();
  });
});
