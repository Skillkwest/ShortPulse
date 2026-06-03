import { useState } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AiStudioSessionAgentV1 } from "../../logic/sessionSnapshot";
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
  it("binds New chat to exactly one fresh saved thread after Pulse restart", async () => {
    const restartCurrentPulse = vi.fn(async () => true);
    const openThreadSnapshot = vi.fn(async () => undefined);

    const { result, rerender } = renderHook(
      (props: HookProps) => {
        const [projectPulseChatState, setProjectPulseChatState] = useState({
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
          restartCurrentPulse,
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

    await act(async () => {
      await result.current.createNewChat();
    });

    expect(restartCurrentPulse).toHaveBeenCalledTimes(1);

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
});
