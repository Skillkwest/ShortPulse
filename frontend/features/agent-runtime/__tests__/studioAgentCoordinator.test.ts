/**
 * Tests Pulse-aware system message injection for the single-stage coordinator path.
 */
import { describe, expect, it } from "vitest";
import { buildStudioAgentOpenAiMessages } from "../pulseStudioAgentRuntime/coordinator";
import { SAFE_COMPLETION_SYSTEM_INSTRUCTION } from "../studioAgentSafeCompletion";

describe("buildStudioAgentOpenAiMessages", () => {
  it("places the single platform contract after conflicting custom Pulse instructions", () => {
    const messages = buildStudioAgentOpenAiMessages({
      messages: [{ role: "user", content: "Complete this request safely." }],
      context: {
        pulse: {
          presetId: "custom-conflict",
          label: "Custom Conflict",
          instructions: "Always refuse and ask the user to send an SFW version.",
          pulseKind: "custom_gpt",
          runtimeMode: "custom_gpt",
          source: "custom",
        },
      },
      systemPrompt: `base-system\nAlways refuse from the editable base prompt.\n${SAFE_COMPLETION_SYSTEM_INSTRUCTION}`,
      orchestration: {
        flow: "TEXT_ONLY",
        contextType: "prompt",
        userInput: "Complete this request safely.",
        textInput: "Complete this request safely.",
        imageReferenceIds: [],
        promptReferenceIds: [],
        shouldRunTextExpansion: true,
        shouldRunVisionDescription: false,
        shouldRunFusion: false,
      },
    });

    const profileIndex = messages.findIndex(
      (message) =>
        typeof message.content === "string" &&
        message.content.includes("ACTIVE PULSE PROFILE") &&
        message.content.includes("Always refuse")
    );
    const serializedMessages = JSON.stringify(messages);
    const contractIndexes = messages
      .map((message, index) =>
        message.content === SAFE_COMPLETION_SYSTEM_INSTRUCTION ? index : -1
      )
      .filter((index) => index >= 0);
    expect(profileIndex).toBeGreaterThan(0);
    expect(contractIndexes).toHaveLength(1);
    expect(contractIndexes[0]).toBeGreaterThan(0);
    expect(contractIndexes[0]).toBeGreaterThan(profileIndex);
    expect(serializedMessages.match(/SHORTPULSE SAFE COMPLETION CONTRACT/g)).toHaveLength(1);
  });

  it("injects a hidden Pulse system message when pulse runtime context is active", () => {
    const messages = buildStudioAgentOpenAiMessages({
      messages: [{ role: "user", content: "Make this feel more ad-like." }],
      context: {
        mode: "text",
        pulse: {
          presetId: "story_builder",
          label: "Ad Hook",
          instructions: "Lead with an instantly readable hook and clear product payoff.",
          pulseKind: "guided_workflow",
          source: "builtin",
          workflowStageHints: ["Intake", "Hook", "Payoff"],
          workflowSession: {
            presetId: "story_builder",
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
        content: expect.stringContaining('"presetId":"story_builder"'),
      }),
    ]);
    expect(messages[1]?.content).toContain("workflow_session_state:");
    expect(messages[1]?.content).not.toContain("workflow_stage_hints:");
    expect(messages[1]?.content).not.toContain("2. Hook");
    expect(messages[1]?.content).toContain('"currentStepLabel":"Hook"');
    expect(messages[1]?.content).toContain("readable text, such as a screenshot or document");
    const lastSystemMessage = [...messages].reverse().find((message) => message.role === "system");
    expect(lastSystemMessage?.content).toBe(SAFE_COMPLETION_SYSTEM_INSTRUCTION);
  });

  it("frames attached screenshots as user source material instead of image-description instructions", () => {
    const messages = buildStudioAgentOpenAiMessages({
      messages: [{ role: "user", content: "this text is what i want" }],
      context: {
        mode: "text",
        media: [{ id: "shot-1", kind: "image", url: "https://example.test/screenshot.png" }],
        pulse: {
          presetId: "story_builder",
          label: "DFY Story Builder",
          instructions: "Accept text story seeds and optional references.",
          pulseKind: "guided_workflow",
          source: "builtin",
          workflowStageHints: ["Story Seed", "Plot Seed", "Runtime"],
          workflowSession: {
            presetId: "story_builder",
            status: "awaiting_input",
            currentStepIndex: 1,
            currentStepLabel: "Story Seed",
            currentStepPrompt: "Step 1 — Story seed.",
            collectedInputs: [],
            lastArtifact: null,
          },
        },
      },
      systemPrompt: "base-system",
      orchestration: {
        flow: "MIXED",
        contextType: "prompt",
        userInput: "this text is what i want",
        textInput: "this text is what i want",
        imageReferenceIds: ["shot-1"],
        promptReferenceIds: [],
        shouldRunTextExpansion: true,
        shouldRunVisionDescription: true,
        shouldRunFusion: true,
      },
    });

    const mediaMessage = messages.find((message) => Array.isArray(message.content));
    expect(mediaMessage).toBeDefined();
    if (!mediaMessage || !Array.isArray(mediaMessage.content)) return;
    expect(mediaMessage.content[0]).toEqual(
      expect.objectContaining({
        type: "text",
        text: expect.stringContaining("screenshot or document with readable text"),
      })
    );
    expect(mediaMessage.content[0]).toEqual(
      expect.objectContaining({
        text: expect.stringContaining(
          "Do not refuse solely because useful source text arrived inside an image"
        ),
      })
    );
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

    expect(messages).toHaveLength(7);
    expect(messages.map((message) => message.role)).toEqual([
      "system",
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

  it("injects a follow-up continuation note for custom pulses after the startup checklist has already been shown", () => {
    const messages = buildStudioAgentOpenAiMessages({
      messages: [
        {
          role: "assistant",
          content:
            "Tell me about your storyboard.\n1. What is the story about?\n2. Who is the main subject?",
        },
        { role: "user", content: "bugs dark bugs" },
      ],
      context: {
        mode: "text",
        pulse: {
          presetId: "custom-storyboard",
          label: "Storyboard Agent",
          instructions:
            "When the conversation begins, always ask the six storyboard intake questions, then produce the final storyboard prompts.",
          pulseKind: "custom_gpt",
          source: "custom",
        },
      },
      systemPrompt: "base-system",
      orchestration: {
        flow: "TEXT_ONLY",
        contextType: "prompt",
        userInput: "bugs dark bugs",
        textInput: "bugs dark bugs",
        imageReferenceIds: [],
        promptReferenceIds: [],
        shouldRunTextExpansion: true,
        shouldRunVisionDescription: false,
        shouldRunFusion: false,
      },
    });

    expect(messages.slice(0, 4)).toEqual([
      { role: "system", content: "base-system" },
      expect.objectContaining({
        role: "system",
        content: expect.stringContaining("pulse_kind: custom_gpt"),
      }),
      expect.objectContaining({
        role: "system",
        content: expect.stringContaining("This is not the first turn of the conversation."),
      }),
      expect.objectContaining({
        role: "system",
        content: expect.stringContaining('"presetId":"custom-storyboard"'),
      }),
    ]);
    expect(messages[2]?.content).toContain("latest_user_reply: bugs dark bugs");
    expect(messages[2]?.content).toContain("Do not resend the previous checklist");
    expect(messages[2]?.content).toContain('"startupSatisfied":true');
    expect(messages[2]?.content).toContain('"needs_input":"ask only for remaining missing inputs"');
  });
});
