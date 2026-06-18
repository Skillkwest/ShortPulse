import { useState } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AiStudioSessionAgentV1 } from "../../logic/sessionSnapshot";
import {
  buildPulseChatProjectThreadRecord,
  buildPulseChatThreadSnapshot,
  type PulseChatProjectState,
} from "../../pulseChats/pulseChatThread";
import { usePulseChatThreads } from "../usePulseChatThreads";

type HookProps = {
  expertCreateMode: "standard" | "pulse";
  activePresetId: string | null;
  activePresetLabel: string | null;
  pulseSessionInstanceId: string | null;
  pulsePrompt: string;
  persistedAgentRuntime: AiStudioSessionAgentV1;
};

const buildRuntime = (messages: AiStudioSessionAgentV1["messages"]): AiStudioSessionAgentV1 => ({
  messages,
  input: "",
  latestAgentPrompt: null,
  promptOrigin: "manual",
  chatModeEnabled: true,
  pulseWorkflowSession: null,
});

describe("usePulseChatThreads", () => {
  it("creates a fresh saved thread when the active Pulse session restarts", async () => {
    const openThreadSnapshot = vi.fn(async () => undefined);

    const { result, rerender } = renderHook(
      (props: HookProps) => {
        const [projectPulseChatState, setProjectPulseChatState] = useState<PulseChatProjectState>({
          schemaVersion: 1 as const,
          activeThreadId: null,
          threads: [],
        });

        return usePulseChatThreads({
          enabled: true,
          projectPulseChatState,
          setProjectPulseChatState,
          expertCreateMode: props.expertCreateMode,
          activePresetId: props.activePresetId,
          activePresetLabel: props.activePresetLabel,
          pulseSessionInstanceId: props.pulseSessionInstanceId,
          pulsePrompt: props.pulsePrompt,
          persistedAgentRuntime: props.persistedAgentRuntime,
          openThreadSnapshot,
        });
      },
      {
        initialProps: {
          expertCreateMode: "pulse",
          activePresetId: "preset-1",
          activePresetLabel: "Story Builder",
          pulseSessionInstanceId: "session-1",
          pulsePrompt: "",
          persistedAgentRuntime: buildRuntime([
            {
              id: "message-1",
              role: "assistant",
              content: "How can I help?",
            },
          ]),
        },
      }
    );

    await waitFor(() => {
      expect(result.current.threads).toHaveLength(1);
      expect(result.current.activeThreadId).toBeTruthy();
    });

    const firstThreadId = result.current.activeThreadId;

    rerender({
      expertCreateMode: "pulse",
      activePresetId: "preset-1",
      activePresetLabel: "Story Builder",
      pulseSessionInstanceId: "session-2",
      pulsePrompt: "",
      persistedAgentRuntime: buildRuntime([
        {
          id: "message-2",
          role: "assistant",
          content: "Let's start over.",
        },
      ]),
    });

    await waitFor(() => {
      expect(result.current.threads).toHaveLength(2);
      expect(result.current.activeThreadId).toBeTruthy();
      expect(result.current.activeThreadId).not.toBe(firstThreadId);
    });

    const secondThreadId = result.current.activeThreadId;

    rerender({
      expertCreateMode: "pulse",
      activePresetId: "preset-1",
      activePresetLabel: "Story Builder",
      pulseSessionInstanceId: "session-2",
      pulsePrompt: "Updated prompt",
      persistedAgentRuntime: buildRuntime([
        {
          id: "message-2",
          role: "assistant",
          content: "Let's start over.",
        },
        {
          id: "message-3",
          role: "user",
          content: "Here is the new request.",
        },
      ]),
    });

    await waitFor(() => {
      expect(result.current.threads).toHaveLength(2);
      expect(result.current.activeThreadId).toBe(secondThreadId);
    });
  });

  it("preserves a manually renamed thread title across later autosaves", async () => {
    const openThreadSnapshot = vi.fn(async () => undefined);

    const { result, rerender } = renderHook(
      (props: HookProps) => {
        const [projectPulseChatState, setProjectPulseChatState] = useState<PulseChatProjectState>({
          schemaVersion: 1 as const,
          activeThreadId: null,
          threads: [],
        });

        return usePulseChatThreads({
          enabled: true,
          projectPulseChatState,
          setProjectPulseChatState,
          expertCreateMode: props.expertCreateMode,
          activePresetId: props.activePresetId,
          activePresetLabel: props.activePresetLabel,
          pulseSessionInstanceId: props.pulseSessionInstanceId,
          pulsePrompt: props.pulsePrompt,
          persistedAgentRuntime: props.persistedAgentRuntime,
          openThreadSnapshot,
        });
      },
      {
        initialProps: {
          expertCreateMode: "pulse",
          activePresetId: "preset-1",
          activePresetLabel: "Story Builder",
          pulseSessionInstanceId: "session-1",
          pulsePrompt: "",
          persistedAgentRuntime: buildRuntime([
            {
              id: "message-1",
              role: "user",
              content: "Build a shark tank opener.",
            },
          ]),
        },
      }
    );

    await waitFor(() => {
      expect(result.current.threads).toHaveLength(1);
    });

    const threadId = result.current.activeThreadId;
    expect(threadId).toBeTruthy();
    act(() => {
      result.current.renameThread(threadId ?? "", "Launch opener");
    });

    await waitFor(() => {
      expect(result.current.threads[0]?.title).toBe("Launch opener");
      expect(result.current.threads[0]?.titleSource).toBe("manual");
    });

    rerender({
      expertCreateMode: "pulse",
      activePresetId: "preset-1",
      activePresetLabel: "Story Builder",
      pulseSessionInstanceId: "session-1",
      pulsePrompt: "Updated prompt",
      persistedAgentRuntime: buildRuntime([
        {
          id: "message-1",
          role: "user",
          content: "Build a shark tank opener.",
        },
        {
          id: "message-2",
          role: "user",
          content: "This later message should not replace the manual title.",
        },
      ]),
    });

    await waitFor(() => {
      expect(result.current.threads[0]?.title).toBe("Launch opener");
      expect(result.current.threads[0]?.titleSource).toBe("manual");
    });
  });

  it("opens an existing project-owned thread and marks it active", async () => {
    const savedSnapshot = buildPulseChatThreadSnapshot({
      presetId: "preset-1",
      presetLabel: "Story Builder",
      pulseSessionInstanceId: "session-1",
      pulsePrompt: "Saved prompt",
      runtime: buildRuntime([
        {
          id: "message-1",
          role: "user",
          content: "Open this saved chat.",
        },
      ]),
      updatedAt: "2026-06-15T12:00:00.000Z",
    });
    const savedThread = buildPulseChatProjectThreadRecord({
      threadId: "thread-1",
      snapshot: savedSnapshot,
    });
    const openThreadSnapshot = vi.fn(async () => undefined);

    const { result } = renderHook(() => {
      const [projectPulseChatState, setProjectPulseChatState] = useState<PulseChatProjectState>({
        schemaVersion: 1 as const,
        activeThreadId: null,
        threads: [savedThread],
      });

      return usePulseChatThreads({
        enabled: true,
        projectPulseChatState,
        setProjectPulseChatState,
        expertCreateMode: "pulse",
        activePresetId: null,
        activePresetLabel: null,
        pulseSessionInstanceId: null,
        pulsePrompt: "",
        persistedAgentRuntime: buildRuntime([]),
        openThreadSnapshot,
      });
    });

    await act(async () => {
      await result.current.openThread("thread-1");
    });

    expect(openThreadSnapshot).toHaveBeenCalledWith({
      threadId: "thread-1",
      snapshot: savedSnapshot,
    });
    expect(result.current.activeThreadId).toBe("thread-1");
    expect(result.current.openingThreadId).toBeNull();
  });
});
