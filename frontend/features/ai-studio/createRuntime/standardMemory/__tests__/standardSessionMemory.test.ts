/**
 * Standard session memory tests.
 * Verifies transcript-window, working-state, and persisted-runtime behavior stay explicit.
 */
import { describe, expect, it } from "vitest";
import type { AgentMessage } from "../../../../../prefabs/agent";
import {
  buildStandardSessionMemory,
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
      text: null,
      source: "not_computed",
    });
    expect(memory.workingState).toEqual({
      latestUserIntent: "Need a moody portrait.",
      latestAssistantCommitment: "Here is a first direction.",
      latestPromptArtifact: "moody portrait with film grain",
      promptOrigin: "agent",
      attachedReferenceIntent: {
        promptText: "keep the lighting dramatic",
        referenceIds: ["ref-1"],
        hasImageAttachment: false,
      },
    });
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
});
