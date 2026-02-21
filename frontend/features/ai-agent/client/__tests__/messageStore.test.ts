import { describe, expect, it } from "vitest";
import { appendAssistantMessage, appendUiMessage, buildApiMessagesForTurn } from "../messageStore";
import type { AgentMessage } from "../../../../prefabs/agent";

describe("messageStore", () => {
  it("keeps UI message window at 24 entries", () => {
    const initial: AgentMessage[] = Array.from({ length: 24 }, (_, index) => ({
      role: "user",
      content: `msg-${index}`,
    }));
    const next = appendUiMessage(initial, { role: "assistant", content: "next" });
    expect(next).toHaveLength(24);
    expect(next[0]?.content).toBe("msg-1");
    expect(next[23]?.content).toBe("next");
  });

  it("drops optimistic tail message from API history when it matches id", () => {
    const previousMessages: AgentMessage[] = [
      { role: "user", content: "prior" },
      { id: "optimistic-1", role: "user", content: "optimistic" },
    ];
    const apiMessages = buildApiMessagesForTurn({
      previousMessages,
      userPayloadForApi: "final",
      skipUserEcho: true,
      optimisticUserMessageId: "optimistic-1",
    });

    expect(apiMessages).toEqual([
      { role: "user", content: "prior" },
      { role: "user", content: "final" },
    ]);
  });

  it("appends assistant message with reserved slot window behavior", () => {
    const previous: AgentMessage[] = Array.from({ length: 24 }, (_, index) => ({
      role: "user",
      content: `m-${index}`,
    }));
    const next = appendAssistantMessage(previous, "assistant-message");
    expect(next).toHaveLength(24);
    expect(next[0]?.content).toBe("m-1");
    expect(next[23]?.content).toBe("assistant-message");
  });
});
