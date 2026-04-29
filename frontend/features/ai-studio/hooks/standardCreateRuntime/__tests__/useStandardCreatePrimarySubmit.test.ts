import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useStandardCreatePrimarySubmit } from "../useStandardCreatePrimarySubmit";

describe("useStandardCreatePrimarySubmit", () => {
  it("sends through the Standard agent when chat mode is enabled", async () => {
    const handleAgentSend = vi.fn().mockResolvedValue({
      prompt: "Refined Standard prompt",
      referenceTitle: "Agent prompt",
    });
    const handleProviderPrimarySubmit = vi.fn();
    const handleStandardAgentCaptureResult = vi.fn();

    const { result } = renderHook(() =>
      useStandardCreatePrimarySubmit({
        mode: "text",
        selectedTool: "create",
        chatModeEnabled: true,
        agentInput: "standard draft",
        prompt: "fallback prompt",
        handleAgentSend,
        handleProviderPrimarySubmit,
        handleStandardAgentCaptureResult,
      })
    );

    await act(async () => {
      result.current();
    });

    expect(handleAgentSend).toHaveBeenCalledWith("standard draft", { captureResult: true });
    expect(handleProviderPrimarySubmit).not.toHaveBeenCalled();
    expect(handleStandardAgentCaptureResult).toHaveBeenCalledWith(
      "Refined Standard prompt",
      "Agent prompt"
    );
  });

  it("uses the Standard prompt fallback when the chat input is empty", async () => {
    const handleAgentSend = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useStandardCreatePrimarySubmit({
        mode: "text",
        selectedTool: "text",
        chatModeEnabled: true,
        agentInput: "",
        prompt: "standard prompt fallback",
        handleAgentSend,
        handleProviderPrimarySubmit: vi.fn(),
        handleStandardAgentCaptureResult: vi.fn(),
      })
    );

    await act(async () => {
      result.current();
    });

    expect(handleAgentSend).toHaveBeenCalledWith("standard prompt fallback", {
      captureResult: true,
    });
  });

  it("submits directly to generation when Standard chat mode is off", () => {
    const handleAgentSend = vi.fn().mockResolvedValue(undefined);
    const handleProviderPrimarySubmit = vi.fn();

    const { result } = renderHook(() =>
      useStandardCreatePrimarySubmit({
        mode: "text",
        selectedTool: "create",
        chatModeEnabled: false,
        agentInput: "standard draft",
        prompt: "standard prompt",
        handleAgentSend,
        handleProviderPrimarySubmit,
        handleStandardAgentCaptureResult: vi.fn(),
      })
    );

    act(() => {
      result.current();
    });

    expect(handleAgentSend).not.toHaveBeenCalled();
    expect(handleProviderPrimarySubmit).toHaveBeenCalledTimes(1);
  });
});
