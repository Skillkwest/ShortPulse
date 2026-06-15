import { describe, expect, it } from "vitest";
import type { AiStudioSessionAgentV1 } from "../../logic/sessionSnapshot";
import {
  buildPulseChatProjectThreadRecord,
  buildPulseChatThreadSnapshot,
  MAX_PULSE_CHAT_SAVED_MESSAGES,
  mergePulseChatThreadRuntime,
  resolvePulseChatProjectStateSignature,
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

describe("resolvePulseChatProjectStateSignature", () => {
  it("summarizes saved threads without serializing the full transcript history", () => {
    const historicMessage = {
      id: "historic-user",
      role: "user" as const,
      content: `historic transcript payload ${"x".repeat(1024)}`,
    };
    const lastMessage = {
      id: "latest-assistant",
      role: "assistant" as const,
      content: "Latest answer",
    };
    const snapshot = buildPulseChatThreadSnapshot({
      presetId: "preset-1",
      presetLabel: "Story Builder",
      pulseSessionInstanceId: "session-1",
      pulsePrompt: "Pulse prompt",
      runtime: buildRuntime([historicMessage, lastMessage]),
      updatedAt: "2026-04-24T18:00:00.000Z",
    });
    const record = buildPulseChatProjectThreadRecord({
      threadId: "thread-1",
      title: "Thread 1",
      snapshot,
      updatedAt: "2026-04-24T18:00:00.000Z",
    });

    const signature = resolvePulseChatProjectStateSignature({
      schemaVersion: 1,
      activeThreadId: "thread-1",
      threads: [record],
    });

    expect(signature).toContain("latest-assistant");
    expect(signature).toContain("Latest answer");
    expect(signature).toContain('"messageCount":2');
    expect(signature).not.toContain("historic transcript payload");
  });

  it("changes when thread identity, recency, or latest message changes", () => {
    const baseSnapshot = buildPulseChatThreadSnapshot({
      presetId: "preset-1",
      presetLabel: "Story Builder",
      pulseSessionInstanceId: "session-1",
      pulsePrompt: "Pulse prompt",
      runtime: buildRuntime([
        {
          id: "first-user",
          role: "user",
          content: "First prompt",
        },
        {
          id: "latest-assistant",
          role: "assistant",
          content: "Latest answer",
        },
      ]),
      updatedAt: "2026-04-24T18:00:00.000Z",
    });
    const changedLatestMessageSnapshot = buildPulseChatThreadSnapshot({
      presetId: "preset-1",
      presetLabel: "Story Builder",
      pulseSessionInstanceId: "session-1",
      pulsePrompt: "Pulse prompt",
      runtime: buildRuntime([
        {
          id: "first-user",
          role: "user",
          content: "First prompt",
        },
        {
          id: "latest-assistant",
          role: "assistant",
          content: "Changed latest answer",
        },
      ]),
      updatedAt: "2026-04-24T18:00:00.000Z",
    });
    const baseRecord = buildPulseChatProjectThreadRecord({
      threadId: "thread-1",
      snapshot: baseSnapshot,
      updatedAt: "2026-04-24T18:00:00.000Z",
    });

    const baseSignature = resolvePulseChatProjectStateSignature({
      schemaVersion: 1,
      activeThreadId: "thread-1",
      threads: [baseRecord],
    });
    const changedUpdatedAtSignature = resolvePulseChatProjectStateSignature({
      schemaVersion: 1,
      activeThreadId: "thread-1",
      threads: [
        {
          ...baseRecord,
          updatedAt: "2026-04-24T18:01:00.000Z",
        },
      ],
    });
    const changedLatestMessageSignature = resolvePulseChatProjectStateSignature({
      schemaVersion: 1,
      activeThreadId: "thread-1",
      threads: [
        buildPulseChatProjectThreadRecord({
          threadId: "thread-1",
          snapshot: changedLatestMessageSnapshot,
          updatedAt: "2026-04-24T18:00:00.000Z",
        }),
      ],
    });
    const changedActiveThreadSignature = resolvePulseChatProjectStateSignature({
      schemaVersion: 1,
      activeThreadId: null,
      threads: [baseRecord],
    });

    expect(changedUpdatedAtSignature).not.toBe(baseSignature);
    expect(changedLatestMessageSignature).not.toBe(baseSignature);
    expect(changedActiveThreadSignature).not.toBe(baseSignature);
  });

  it("normalizes equivalent thread ordering", () => {
    const olderRecord = buildPulseChatProjectThreadRecord({
      threadId: "older-thread",
      snapshot: buildPulseChatThreadSnapshot({
        presetId: "preset-1",
        presetLabel: "Story Builder",
        pulseSessionInstanceId: "session-1",
        pulsePrompt: "Pulse prompt",
        runtime: buildRuntime([{ id: "older", role: "user", content: "Older" }]),
        updatedAt: "2026-04-24T18:00:00.000Z",
      }),
      updatedAt: "2026-04-24T18:00:00.000Z",
    });
    const newerRecord = buildPulseChatProjectThreadRecord({
      threadId: "newer-thread",
      snapshot: buildPulseChatThreadSnapshot({
        presetId: "preset-2",
        presetLabel: "Story Builder",
        pulseSessionInstanceId: "session-2",
        pulsePrompt: "Pulse prompt",
        runtime: buildRuntime([{ id: "newer", role: "user", content: "Newer" }]),
        updatedAt: "2026-04-24T18:01:00.000Z",
      }),
      updatedAt: "2026-04-24T18:01:00.000Z",
    });

    expect(
      resolvePulseChatProjectStateSignature({
        schemaVersion: 1,
        activeThreadId: "newer-thread",
        threads: [olderRecord, newerRecord],
      })
    ).toBe(
      resolvePulseChatProjectStateSignature({
        schemaVersion: 1,
        activeThreadId: "newer-thread",
        threads: [newerRecord, olderRecord],
      })
    );
  });
});
