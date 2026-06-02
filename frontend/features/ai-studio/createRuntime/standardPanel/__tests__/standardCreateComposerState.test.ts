import { describe, expect, it } from "vitest";
import {
  hasVisibleStandardComposerPrompt,
  resolveRestoredStandardComposerState,
  resolveStandardChatModeTransition,
  resolveVisibleStandardComposerPrompt,
} from "../standardCreateComposerState";

describe("standardCreateComposerState", () => {
  it("uses the visible Standard chat composer text when chat mode is on", () => {
    expect(
      resolveVisibleStandardComposerPrompt({
        prompt: "hidden fallback prompt",
        agentInput: "visible chat composer",
        chatModeEnabled: true,
      })
    ).toBe("visible chat composer");
  });

  it("uses the authored Standard prompt when chat mode is off", () => {
    expect(
      resolveVisibleStandardComposerPrompt({
        prompt: "authored prompt",
        agentInput: "transient chat draft",
        chatModeEnabled: false,
      })
    ).toBe("authored prompt");
  });

  it("treats whitespace-only visible composer text as empty", () => {
    expect(
      hasVisibleStandardComposerPrompt({
        prompt: "hidden fallback prompt",
        agentInput: "   ",
        chatModeEnabled: true,
      })
    ).toBe(false);
  });

  it("mirrors the authored Standard prompt into the chat composer when chat mode turns on", () => {
    expect(
      resolveStandardChatModeTransition({
        currentChatModeEnabled: false,
        nextChatModeEnabled: true,
        prompt: "authored prompt",
        agentInput: "stale chat draft",
      })
    ).toEqual({
      nextPrompt: "authored prompt",
      nextAgentInput: "authored prompt",
    });
  });

  it("promotes the visible Standard chat draft into the prompt lane when chat mode turns off", () => {
    expect(
      resolveStandardChatModeTransition({
        currentChatModeEnabled: true,
        nextChatModeEnabled: false,
        prompt: "hidden prompt",
        agentInput: "visible chat draft",
      })
    ).toEqual({
      nextPrompt: "visible chat draft",
      nextAgentInput: "visible chat draft",
    });
  });

  it("keeps chat-mode restore in the visible composer lane", () => {
    expect(
      resolveRestoredStandardComposerState({
        workspacePrompt: "workspace prompt",
        runtimeInput: "runtime draft",
        chatModeEnabled: true,
      })
    ).toEqual({
      prompt: "runtime draft",
      agentInput: "runtime draft",
      promptOriginFallback: false,
    });
  });
});
