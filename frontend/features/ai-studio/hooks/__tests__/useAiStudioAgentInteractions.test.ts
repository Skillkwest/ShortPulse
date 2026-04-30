import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Dispatch, SetStateAction } from "react";
import { useAiStudioAgentInteractions } from "../useAiStudioAgentInteractions";
import type { PromptOrigin } from "../../logic/agentPromptOwnership";

const asDispatch = <T>(fn: (...args: unknown[]) => unknown): Dispatch<SetStateAction<T>> =>
  fn as unknown as Dispatch<SetStateAction<T>>;

const createParams = (
  overrides: Partial<Parameters<typeof useAiStudioAgentInteractions>[0]> = {}
): Parameters<typeof useAiStudioAgentInteractions>[0] => {
  const baseParams: Parameters<typeof useAiStudioAgentInteractions>[0] = {
    setLatestAgentPrompt: asDispatch<string | null>(vi.fn()),
    setPromptOrigin: asDispatch<PromptOrigin>(vi.fn()),
    trackAgentUiEvent: vi.fn(),
    resetAgentChat: vi.fn(),
    resetAgentComposer: vi.fn(),
    clearActiveRuntime: undefined,
  };

  return {
    ...baseParams,
    ...overrides,
  };
};

describe("useAiStudioAgentInteractions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clears agent chat and resets dependent state", () => {
    const resetAgentChat = vi.fn();
    const resetAgentComposer = vi.fn();
    const setLatestAgentPrompt = vi.fn();
    const setPromptOrigin = vi.fn();
    const trackAgentUiEvent = vi.fn();
    const params = createParams({
      resetAgentChat,
      resetAgentComposer,
      setLatestAgentPrompt: asDispatch<string | null>(setLatestAgentPrompt),
      setPromptOrigin: asDispatch<PromptOrigin>(setPromptOrigin),
      trackAgentUiEvent,
    });
    const { result } = renderHook(() => useAiStudioAgentInteractions(params));

    act(() => {
      result.current.handleClearAgentChat();
    });

    expect(resetAgentChat).toHaveBeenCalledTimes(1);
    expect(resetAgentComposer).toHaveBeenCalledTimes(1);
    expect(resetAgentComposer).toHaveBeenCalledWith({
      preserveAttachments: false,
    });
    expect(setLatestAgentPrompt).toHaveBeenCalledWith(null);
    expect(setPromptOrigin).toHaveBeenCalledWith("manual");
    expect(trackAgentUiEvent).toHaveBeenCalledWith("studio_agent_chat_cleared");
  });

  it("clears the active mode runtime when provided", () => {
    const clearActiveRuntime = vi.fn();
    const params = createParams({
      clearActiveRuntime,
    });
    const { result } = renderHook(() => useAiStudioAgentInteractions(params));

    act(() => {
      result.current.handleClearAgentChat();
    });

    expect(clearActiveRuntime).toHaveBeenCalledTimes(1);
  });
});
