import { describe, expect, it } from "vitest";
import type { AiStudioSessionAgentV1 } from "../../logic/sessionSnapshot";
import {
  buildPulseChatThreadSnapshot,
  MAX_PULSE_CHAT_SAVED_MESSAGES,
  mergePulseChatThreadRuntime,
} from "../pulseChatThread";

const buildRuntime = (messages: AiStudioSessionAgentV1["messages"]): AiStudioSessionAgentV1 => ({
  messages,
  input: "",
  latestAgentPrompt: null,
  promptOrigin: "manual",
  chatModeEnabled: true,
  pulseWorkflowSession: null,
});

describe("mergePulseChatThreadRuntime", () => {
  it("preserves saved transcript history when the live runtime only retains the recent window", () => {
    const earlierMessages = Array.from({ length: 10 }, (_, index) => ({
      id: `earlier-${index}`,
      role: index % 2 === 0 ? ("user" as const) : ("assistant" as const),
      content: `Earlier message ${index}`,
    }));
    const laterMessages = Array.from({ length: 24 }, (_, index) => ({
      id: `later-${index}`,
      role: index % 2 === 0 ? ("user" as const) : ("assistant" as const),
      content: `Later message ${index}`,
    }));
    const existingSnapshot = buildPulseChatThreadSnapshot({
      presetId: "preset-1",
      presetLabel: "Story Builder",
      pulseSessionInstanceId: "session-1",
      pulsePrompt: "",
      runtime: buildRuntime([...earlierMessages, ...laterMessages]),
    });

    const merged = mergePulseChatThreadRuntime({
      existingSnapshot,
      runtime: buildRuntime([
        ...laterMessages,
        {
          id: "new-user",
          role: "user",
          content: "A brand new follow-up",
        },
        {
          id: "new-assistant",
          role: "assistant",
          content: "A fresh answer",
        },
      ]),
    });

    expect(merged.messages).toHaveLength(36);
    expect(merged.messages[0]?.id).toBe("earlier-0");
    expect(merged.messages.at(-1)?.id).toBe("new-assistant");
  });

  it("caps saved transcript history to the project-owned thread limit", () => {
    const existingMessages = Array.from({ length: MAX_PULSE_CHAT_SAVED_MESSAGES }, (_, index) => ({
      id: `existing-${index}`,
      role: index % 2 === 0 ? ("user" as const) : ("assistant" as const),
      content: `Existing message ${index}`,
    }));
    const existingSnapshot = buildPulseChatThreadSnapshot({
      presetId: "preset-1",
      presetLabel: "Story Builder",
      pulseSessionInstanceId: "session-1",
      pulsePrompt: "",
      runtime: buildRuntime(existingMessages),
    });

    const currentRuntimeMessages = [
      ...existingMessages.slice(-22),
      {
        id: "recent-22",
        role: "user" as const,
        content: "Recent message 22",
      },
      {
        id: "recent-23",
        role: "assistant" as const,
        content: "Recent message 23",
      },
    ];

    const merged = mergePulseChatThreadRuntime({
      existingSnapshot,
      runtime: buildRuntime(currentRuntimeMessages),
    });

    expect(merged.messages).toHaveLength(MAX_PULSE_CHAT_SAVED_MESSAGES);
    expect(merged.messages[0]?.id).not.toBe("existing-0");
    expect(merged.messages.at(-1)?.id).toBe("recent-23");
  });
});
