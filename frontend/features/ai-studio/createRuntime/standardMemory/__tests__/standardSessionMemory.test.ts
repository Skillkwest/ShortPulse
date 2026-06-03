/**
 * Standard session memory tests.
 * Verifies transcript-window, working-state, and persisted-runtime behavior stay explicit.
 */
import { describe, expect, it } from "vitest";
import type { AgentMessage } from "../../../../../prefabs/agent";
import {
  buildStandardSessionMemory,
  buildStandardSessionMemoryMessages,
  createPersistedStandardAgentRuntime,
  resolveRestoredStandardComposerState,
  resolveStandardPreviousPromptFromMemory,
} from "../standardSessionMemory";

const createMessage = (overrides: Partial<AgentMessage>): AgentMessage => ({
  id: overrides.id ?? "message-1",
  role: overrides.role ?? "assistant",
  content: overrides.content ?? "",
  ...overrides,
});

describe("standardSessionMemory", () => {
  it("keeps the current Standard transcript window behavior while making it explicit", () => {
    const messages = [
      createMessage({ id: "user-1", role: "user", content: "Need a moody portrait." }),
      createMessage({
        id: "assistant-1",
        role: "assistant",
        content: "Here is a first direction.",
      }),
    ];

    const memory = buildStandardSessionMemory({
      messages,
      latestPromptArtifact: "moody portrait with film grain",
      promptOrigin: "agent",
      attachments: [
        {
          id: "prompt-1",
          kind: "prompt",
          text: "keep the lighting dramatic",
          referenceId: "ref-1",
        },
      ],
    });

    expect(memory.transcriptWindow).toEqual(messages);
    expect(memory.summary).toEqual({
      text: [
        "Standard session memory:",
        "Latest user intent: Need a moody portrait.",
        "Latest assistant commitment: Here is a first direction.",
        "Latest reusable prompt artifact: moody portrait with film grain",
        "Active constraints: keep the lighting dramatic",
        "Decisions carried forward: A reusable prompt is available. | The current prompt source is the assistant.",
        "References in play: 1 selected reference | attached prompt references",
        "Attached prompt references: keep the lighting dramatic",
        "Attached reference count: 1",
        "Next best action: Refine or generate from the accepted prompt.",
      ].join("\n"),
      source: "derived_working_state",
    });
    expect(memory.workingState).toEqual({
      latestUserIntent: "Need a moody portrait.",
      latestAssistantCommitment: "Here is a first direction.",
      currentTask: "Need a moody portrait.",
      historicalUserGoals: [],
      constraints: ["keep the lighting dramatic"],
      decisionsMade: [
        "A reusable prompt is available.",
        "The current prompt source is the assistant.",
      ],
      openQuestions: [],
      referencesInPlay: ["1 selected reference", "attached prompt references"],
      lastAcceptedPrompt: "moody portrait with film grain",
      nextBestAction: "Refine or generate from the accepted prompt.",
      promptOrigin: "agent",
      attachedReferenceIntent: {
        promptText: "keep the lighting dramatic",
        referenceIds: ["ref-1"],
        hasImageAttachment: false,
      },
    });
  });

  it("keeps a bounded recent Standard transcript while retaining the latest reusable prompt artifact", () => {
    const messages = [
      createMessage({
        id: "assistant-prompt",
        role: "assistant",
        content: "Use this base prompt.",
        outputPrompt: "Recovered prompt artifact",
        canUseAsPrompt: true,
      }),
      ...Array.from({ length: 9 }, (_, index) =>
        createMessage({
          id: `message-${index + 1}`,
          role: index % 2 === 0 ? "user" : "assistant",
          content: `recent-${index + 1}`,
        })
      ),
    ];

    const memory = buildStandardSessionMemory({
      messages,
      latestPromptArtifact: null,
      promptOrigin: "agent",
    });

    expect(memory.transcriptWindow.map((message) => message.id)).toEqual([
      "assistant-prompt",
      "message-2",
      "message-3",
      "message-4",
      "message-5",
      "message-6",
      "message-7",
      "message-8",
      "message-9",
    ]);
    expect(memory.workingState.lastAcceptedPrompt).toBe("Recovered prompt artifact");
  });

  it("persists the Standard runtime through the memory contract without changing the snapshot shape", () => {
    const runtime = createPersistedStandardAgentRuntime({
      messages: [
        createMessage({
          id: "assistant-1",
          role: "assistant",
          content: "Here is your prompt.",
          outputPrompt: "Here is your prompt.",
          canUseAsPrompt: true,
        }),
      ],
      input: "next idea",
      latestPromptArtifact: "Here is your prompt.",
      promptOrigin: "agent",
      chatModeEnabled: true,
    });

    expect(runtime).toEqual({
      messages: [
        {
          id: "assistant-1",
          role: "assistant",
          content: "Here is your prompt.",
          outputPrompt: "Here is your prompt.",
          canUseAsPrompt: true,
        },
      ],
      input: "next idea",
      latestAgentPrompt: "Here is your prompt.",
      promptOrigin: "agent",
      chatModeEnabled: true,
    });
  });

  it("keeps full visible Standard history in the persisted runtime snapshot", () => {
    const messages = Array.from({ length: 10 }, (_, index) =>
      createMessage({
        id: `message-${index + 1}`,
        role: index % 2 === 0 ? "user" : "assistant",
        content: `history-${index + 1}`,
      })
    );

    const runtime = createPersistedStandardAgentRuntime({
      messages,
      input: "next idea",
      latestPromptArtifact: null,
      promptOrigin: "manual",
      chatModeEnabled: true,
    });

    expect(runtime.messages).toHaveLength(10);
    expect(runtime.messages[0]?.content).toBe("history-1");
    expect(runtime.messages[9]?.content).toBe("history-10");
  });

  it("falls back to the latest reusable assistant prompt in the transcript when explicit prompt state is missing", () => {
    const runtime = createPersistedStandardAgentRuntime({
      messages: [
        createMessage({
          id: "assistant-1",
          role: "assistant",
          content: "Here is your prompt.",
          outputPrompt: "Recovered transcript prompt",
          canUseAsPrompt: true,
        }),
      ],
      input: "next idea",
      latestPromptArtifact: null,
      promptOrigin: "agent",
      chatModeEnabled: true,
    });

    expect(runtime.latestAgentPrompt).toBe("Recovered transcript prompt");
  });

  it("restores the visible Standard composer state with the current chat-mode fallback rules", () => {
    expect(
      resolveRestoredStandardComposerState({
        workspacePrompt: "Recovered workspace prompt",
        runtimeInput: "",
        chatModeEnabled: true,
      })
    ).toEqual({
      prompt: "Recovered workspace prompt",
      agentInput: "Recovered workspace prompt",
      promptOriginFallback: true,
    });

    expect(
      resolveRestoredStandardComposerState({
        workspacePrompt: "Recovered workspace prompt",
        runtimeInput: "Runtime draft",
        chatModeEnabled: true,
      })
    ).toEqual({
      prompt: "Runtime draft",
      agentInput: "Runtime draft",
      promptOriginFallback: false,
    });
  });

  it("derives the Standard previous prompt seed from memory working state", () => {
    const memory = buildStandardSessionMemory({
      messages: [],
      latestPromptArtifact: " Cinematic portrait prompt ",
      promptOrigin: "agent",
    });

    expect(resolveStandardPreviousPromptFromMemory(memory)).toBe("Cinematic portrait prompt");
  });

  it("derives the Standard previous prompt seed from the latest reusable assistant prompt when needed", () => {
    const memory = buildStandardSessionMemory({
      messages: [
        createMessage({
          id: "assistant-1",
          role: "assistant",
          content: "Here is your prompt.",
          outputPrompt: "Recovered transcript prompt",
          canUseAsPrompt: true,
        }),
      ],
      latestPromptArtifact: null,
      promptOrigin: "agent",
    });

    expect(resolveStandardPreviousPromptFromMemory(memory)).toBe("Recovered transcript prompt");
  });

  it("builds a single outbound Standard memory message when summary text exists", () => {
    const memory = buildStandardSessionMemory({
      messages: [createMessage({ role: "user", content: "Need a cinematic portrait." })],
      latestPromptArtifact: "Cinematic portrait prompt",
      promptOrigin: "agent",
    });

    expect(buildStandardSessionMemoryMessages(memory)).toEqual([
      {
        role: "assistant",
        content: [
          "Standard session memory:",
          "Latest user intent: Need a cinematic portrait.",
          "Latest reusable prompt artifact: Cinematic portrait prompt",
          "Decisions carried forward: A reusable prompt is available. | The current prompt source is the assistant.",
          "Next best action: Refine or generate from the accepted prompt.",
        ].join("\n"),
      },
    ]);
  });

  it("captures open questions, reference context, and the next best action for follow-up turns", () => {
    const memory = buildStandardSessionMemory({
      messages: [
        createMessage({ id: "user-1", role: "user", content: "Help me improve this concept." }),
        createMessage({
          id: "assistant-1",
          role: "assistant",
          content: "Which audience should this target first?",
        }),
      ],
      latestPromptArtifact: null,
      promptOrigin: "reference",
      attachments: [
        {
          id: "image-1",
          kind: "image",
          imageUrl: "https://example.com/ref.png",
        },
      ],
    });

    expect(memory.workingState.openQuestions).toEqual(["Which audience should this target first?"]);
    expect(memory.workingState.historicalUserGoals).toEqual([]);
    expect(memory.workingState.referencesInPlay).toEqual([
      "image attachments",
      "reference-authored prompt",
    ]);
    expect(memory.workingState.nextBestAction).toBe(
      "Answer the assistant's open question before refining further."
    );
    expect(memory.summary.text).toContain(
      "Open questions: Which audience should this target first?"
    );
    expect(memory.summary.text).toContain(
      "Next best action: Answer the assistant's open question before refining further."
    );
  });

  it("treats an answered assistant question as resolved while keeping the broader current task", () => {
    const memory = buildStandardSessionMemory({
      messages: [
        createMessage({ id: "user-1", role: "user", content: "Help me shape this ad concept." }),
        createMessage({
          id: "assistant-1",
          role: "assistant",
          content: "Which audience should this target first?",
        }),
        createMessage({ id: "user-2", role: "user", content: "Adults 25-34." }),
      ],
      latestPromptArtifact: "Luxury skincare launch campaign with soft diffusion lighting",
      promptOrigin: "reference",
    });

    expect(memory.workingState.latestUserIntent).toBe("Adults 25-34.");
    expect(memory.workingState.currentTask).toBe("Help me shape this ad concept.");
    expect(memory.workingState.historicalUserGoals).toEqual([]);
    expect(memory.workingState.decisionsMade).toContain(
      "Answered follow-up: Which audience should this target first? -> Adults 25-34."
    );
    expect(memory.workingState.openQuestions).toEqual([]);
    expect(memory.workingState.nextBestAction).toBe("Refine or generate from the accepted prompt.");
    expect(memory.summary.text).not.toContain("Open questions:");
  });

  it("recalls older substantive user goals when the bounded transcript window mostly contains short follow-up answers", () => {
    const memory = buildStandardSessionMemory({
      messages: [
        createMessage({
          id: "user-goal-1",
          role: "user",
          content: "Help me shape a premium skincare launch campaign for adults 25-34.",
        }),
        createMessage({
          id: "assistant-1",
          role: "assistant",
          content: "Should the tone feel more clinical or more luxurious?",
        }),
        createMessage({ id: "user-2", role: "user", content: "More luxurious." }),
        createMessage({
          id: "assistant-2",
          role: "assistant",
          content: "What should the hero visual emphasize?",
        }),
        createMessage({ id: "user-3", role: "user", content: "Texture." }),
        createMessage({ id: "assistant-3", role: "assistant", content: "Any color direction?" }),
        createMessage({ id: "user-4", role: "user", content: "Warm neutrals." }),
        createMessage({
          id: "assistant-4",
          role: "assistant",
          content: "Should copy be minimal?",
        }),
        createMessage({ id: "user-5", role: "user", content: "Yes." }),
        createMessage({
          id: "assistant-5",
          role: "assistant",
          content: "What audience should this target first?",
        }),
        createMessage({ id: "user-6", role: "user", content: "Adults 25-34." }),
      ],
      latestPromptArtifact:
        "Luxury skincare launch campaign with warm neutral palette and tactile product textures",
      promptOrigin: "reference",
    });

    expect(memory.workingState.currentTask).toBe(
      "Help me shape a premium skincare launch campaign for adults 25-34."
    );
    expect(memory.workingState.historicalUserGoals).toEqual([
      "Help me shape a premium skincare launch campaign for adults 25-34.",
    ]);
    expect(memory.workingState.decisionsMade).toEqual(
      expect.arrayContaining([
        "Answered follow-up: What audience should this target first? -> Adults 25-34.",
        "Answered follow-up: Should copy be minimal? -> Yes.",
        "Answered follow-up: Any color direction? -> Warm neutrals.",
      ])
    );
    expect(memory.summary.text).toContain(
      "Earlier user goals to consider: Help me shape a premium skincare launch campaign for adults 25-34."
    );
  });

  it("keeps short imperative pivots as the active task instead of treating them like answered follow-ups", () => {
    const memory = buildStandardSessionMemory({
      messages: [
        createMessage({
          id: "user-1",
          role: "user",
          content: "Help me shape a premium skincare launch campaign for adults 25-34.",
        }),
        createMessage({
          id: "assistant-1",
          role: "assistant",
          content: "What audience should this target first?",
        }),
        createMessage({ id: "user-2", role: "user", content: "Make it darker." }),
      ],
      latestPromptArtifact:
        "Luxury skincare launch campaign with warm neutral palette and tactile product textures",
      promptOrigin: "reference",
    });

    expect(memory.workingState.latestUserIntent).toBe("Make it darker.");
    expect(memory.workingState.currentTask).toBe("Make it darker.");
    expect(memory.workingState.historicalUserGoals).toEqual([]);
    expect(memory.summary.text).not.toContain("Earlier user goals to consider:");
  });
});
