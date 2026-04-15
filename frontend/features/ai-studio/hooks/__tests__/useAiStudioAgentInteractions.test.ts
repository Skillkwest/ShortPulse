import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Dispatch, SetStateAction } from "react";
import { useAiStudioAgentInteractions } from "../useAiStudioAgentInteractions";
import type { PromptOrigin } from "../../logic/agentPromptOwnership";
import type { AgentActions } from "../../../../prefabs/agent";

const asDispatch = <T>(fn: (...args: unknown[]) => unknown): Dispatch<SetStateAction<T>> =>
  fn as unknown as Dispatch<SetStateAction<T>>;

const createParams = (
  overrides: Partial<Parameters<typeof useAiStudioAgentInteractions>[0]> = {}
): Parameters<typeof useAiStudioAgentInteractions>[0] => ({
  editPromptToolSelected: false,
  setSharedPrompt: vi.fn(),
  setLatestAgentPrompt: asDispatch<string | null>(vi.fn()),
  setPromptOrigin: asDispatch<PromptOrigin>(vi.fn()),
  trackAgentUiEvent: vi.fn(),
  setAgentInput: asDispatch<string>(vi.fn()),
  addAgentPromptReference: vi.fn(),
  setIsAgentChatOpen: asDispatch<boolean>(vi.fn()),
  agentSessionEnabled: true,
  setAgentSessionEnabled: asDispatch<boolean>(vi.fn()),
  latestAgentPrompt: null,
  agentActions: undefined,
  resetAgentChat: vi.fn(),
  resetAgentComposer: vi.fn(),
  setAgentActions: asDispatch<AgentActions | undefined>(vi.fn()),
  ...overrides,
});

describe("useAiStudioAgentInteractions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("applies normalized assistant prompt to shared state", () => {
    const setSharedPrompt = vi.fn();
    const setLatestAgentPrompt = vi.fn();
    const setPromptOrigin = vi.fn();
    const trackAgentUiEvent = vi.fn();
    const params = createParams({
      setSharedPrompt,
      setLatestAgentPrompt: asDispatch<string | null>(setLatestAgentPrompt),
      setPromptOrigin: asDispatch<PromptOrigin>(setPromptOrigin),
      trackAgentUiEvent,
    });
    const { result } = renderHook(() => useAiStudioAgentInteractions(params));

    act(() => {
      result.current.handleAgentApplyPrompt("  polished concept prompt  ");
    });

    expect(setSharedPrompt).toHaveBeenCalledWith("polished concept prompt");
    expect(setLatestAgentPrompt).toHaveBeenCalledWith("polished concept prompt");
    expect(setPromptOrigin).toHaveBeenCalledWith("agent");
    expect(trackAgentUiEvent).toHaveBeenCalledWith("studio_agent_apply_prompt");
  });

  it("clears agent chat and resets dependent state", () => {
    const resetAgentChat = vi.fn();
    const resetAgentComposer = vi.fn();
    const setLatestAgentPrompt = vi.fn();
    const setPromptOrigin = vi.fn();
    const setAgentActions = vi.fn();
    const setIsAgentChatOpen = vi.fn();
    const trackAgentUiEvent = vi.fn();
    const params = createParams({
      resetAgentChat,
      resetAgentComposer,
      setLatestAgentPrompt: asDispatch<string | null>(setLatestAgentPrompt),
      setPromptOrigin: asDispatch<PromptOrigin>(setPromptOrigin),
      setAgentActions: asDispatch<AgentActions | undefined>(setAgentActions),
      setIsAgentChatOpen: asDispatch<boolean>(setIsAgentChatOpen),
      trackAgentUiEvent,
    });
    const { result } = renderHook(() => useAiStudioAgentInteractions(params));

    act(() => {
      result.current.handleClearAgentChat();
    });

    expect(resetAgentChat).toHaveBeenCalledTimes(1);
    expect(resetAgentComposer).toHaveBeenCalledTimes(1);
    expect(resetAgentComposer).toHaveBeenCalledWith({
      preserveInput: true,
      preserveAttachments: true,
    });
    expect(setLatestAgentPrompt).toHaveBeenCalledWith(null);
    expect(setPromptOrigin).toHaveBeenCalledWith("manual");
    expect(setAgentActions).toHaveBeenCalledWith(undefined);
    expect(setIsAgentChatOpen).toHaveBeenCalledWith(false);
    expect(trackAgentUiEvent).toHaveBeenCalledWith("studio_agent_chat_cleared");
  });

  it("adds latest agent prompt to grid with the default agent title", () => {
    const addAgentPromptReference = vi.fn();
    const setPromptOrigin = vi.fn();
    const setIsAgentChatOpen = vi.fn();
    const trackAgentUiEvent = vi.fn();
    const params = createParams({
      latestAgentPrompt: "Prompt from assistant",
      addAgentPromptReference,
      setPromptOrigin: asDispatch<PromptOrigin>(setPromptOrigin),
      setIsAgentChatOpen: asDispatch<boolean>(setIsAgentChatOpen),
      trackAgentUiEvent,
    });
    const { result } = renderHook(() => useAiStudioAgentInteractions(params));

    act(() => {
      result.current.handleAgentAddToGrid();
    });

    expect(addAgentPromptReference).toHaveBeenCalledWith("Prompt from assistant", "Agent prompt");
    expect(setPromptOrigin).toHaveBeenCalledWith("agent");
    expect(setIsAgentChatOpen).toHaveBeenCalledWith(false);
    expect(trackAgentUiEvent).toHaveBeenCalledWith("studio_agent_add_to_grid");
  });
});
