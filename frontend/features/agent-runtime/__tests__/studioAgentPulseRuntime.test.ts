import { describe, expect, it, vi } from "vitest";
import {
  buildStudioAgentPulseTurnStateMessage,
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
        pulseKind: "guided_workflow",
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
        pulseKind: "guided_workflow",
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
      pulseKind: "guided_workflow",
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
    expect(systemMessage).toContain(
      "If you are delivering a final usable prompt or direct prompt artifact, return that artifact as one plain text block paragraph with no bullets, headings, or outline formatting."
    );
    expect(systemMessage).toContain("Continue from the active workflow_session_state.");
    expect(systemMessage).toContain(
      "When asking a workflow question, prefix it with the explicit current step label in the form `Step N — Stage:`."
    );
    expect(systemMessage).toContain(
      "If workflow_session_state.currentStepIndex is greater than 1, treat the starter/upload step as already satisfied."
    );
    expect(systemMessage).toContain(
      "Do not restart from the first step, substitute a different workflow, or invent a new intake step unless the user explicitly asks to restart."
    );
    expect(systemMessage).toContain("pulse_kind: guided_workflow");
    expect(systemMessage).toContain("artifact_target: video_prompt");
  });

  it("does not force the starter upload reply when activation already has an image-satisfied workflow session", () => {
    const activationSeed = buildStudioAgentPulseActivationSeed({
      presetId: "image",
      label: "Video Prompt Magic",
      instructions: "Follow the guided video workflow.",
      pulseKind: "guided_workflow",
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
      pulseKind: "custom_gpt",
      starterAssistantMessage: null,
      workflowStageHints: null,
      outputMode: "chat_reply",
      source: "custom",
    });
    const systemMessage = buildStudioAgentPulseSystemMessage({
      presetId: "custom",
      label: "Custom Pulse",
      instructions: "Ask one focused setup question before producing the final result.",
      pulseKind: "custom_gpt",
      starterAssistantMessage: null,
      workflowStageHints: null,
      outputMode: "chat_reply",
      source: "custom",
    });

    expect(activationSeed).toContain("Reply according to the active Pulse instructions.");
    expect(activationSeed).toContain(
      "If the instructions define startup behavior, run it only on the first assistant turn of this session."
    );
    expect(activationSeed).not.toContain(
      "Begin the conversation according to the active Pulse instructions."
    );
    expect(activationSeed).not.toContain("Start the workflow now.");
    expect(systemMessage).toContain("preset_source: custom");
    expect(systemMessage).toContain("pulse_kind: custom_gpt");
    expect(systemMessage).toContain(
      "Ask one focused setup question before producing the final result."
    );
    expect(systemMessage).toContain(
      "Treat the saved pulse instructions below as the behavioral source of truth for this run."
    );
    expect(systemMessage).toContain(
      "Do not impose a workflow shell, forced step order, or hidden artifact contract unless the pulse instructions themselves require it."
    );
    expect(systemMessage).toContain(
      "Treat startup instructions such as 'when the conversation begins' or 'always ask the user' as first-turn-only behavior."
    );
    expect(systemMessage).toContain(
      "If the transcript already contains an assistant reply from this Pulse, do not restart the conversation or repeat the startup block unless the user explicitly asks to restart."
    );
    expect(systemMessage).toContain(
      "Use the transcript as working memory. If the user already answered part of an intake or checklist, continue from the remaining missing items instead of restarting from the beginning."
    );
    expect(systemMessage).toContain(
      "When the pulse instructions imply a questionnaire, interview, checklist, or staged intake, do not repeat the whole list after a user reply. Infer which requested fields were answered and ask only for the missing ones."
    );
    expect(systemMessage).toContain(
      "Do not repeat previously answered items unless the user asks to restart or the answer is unusable and you need one narrow clarification."
    );
    expect(systemMessage).toContain(
      "When you are still collecting information or chatting, return status `needs_input`, keep the user-facing question in message, and do not emit a final artifact."
    );
    expect(systemMessage).toContain(
      "When you have a final generation-ready artifact, return status `ready` and put the exact artifact text into actions.applyPrompt."
    );
    expect(systemMessage).toContain(
      "any final prompt or direct prompt artifact must be returned as one plain text block paragraph"
    );
    expect(systemMessage).not.toContain("runtime_mode:");
    expect(systemMessage).not.toContain("activation_mode:");
    expect(systemMessage).not.toContain("output_mode:");
    expect(systemMessage).not.toContain("artifact_target:");
    expect(systemMessage).not.toContain("starter_assistant_message:");
    expect(systemMessage).not.toContain("workflow_stage_hints:");
    expect(systemMessage).not.toContain("Use a polished rich-guided layout");
  });

  it("builds a follow-up continuation note for custom pulses after startup", () => {
    const turnStateMessage = buildStudioAgentPulseTurnStateMessage({
      pulse: {
        presetId: "custom",
        label: "Custom Pulse",
        instructions: "Ask the startup checklist once, then complete the storyboard brief.",
        pulseKind: "custom_gpt",
        source: "custom",
      },
      messages: [
        {
          role: "assistant",
          content:
            "Tell me about your storyboard.\n1. What is the story about?\n2. Who is the main subject?",
        },
        {
          role: "user",
          content: "bugs dark bugs",
        },
      ],
    });

    expect(turnStateMessage).toContain("This is not the first turn of the conversation.");
    expect(turnStateMessage).toContain(
      "Any startup or 'when the conversation begins' instructions inside pulse_instructions are already satisfied and must not be repeated."
    );
    expect(turnStateMessage).toContain('"startupSatisfied":true');
    expect(turnStateMessage).toContain("latest_user_reply: bugs dark bugs");
    expect(turnStateMessage).toContain("previous_assistant_turn:");
  });
});
