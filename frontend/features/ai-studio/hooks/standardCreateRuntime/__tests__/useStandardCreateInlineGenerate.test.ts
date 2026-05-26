import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useStandardCreateInlineGenerate } from "../useStandardCreateInlineGenerate";

describe("useStandardCreateInlineGenerate", () => {
  it("submits trimmed Standard composer input to create image generation", () => {
    const handleGenerate = vi.fn();
    const setPromptOrigin = vi.fn();
    const { result } = renderHook(() =>
      useStandardCreateInlineGenerate({
        agentInput: "  raw inline prompt  ",
        prompt: "shared fallback prompt",
        currentCostCredits: 3,
        promptReferenceGenerateCostCredits: null,
        handleGenerate,
        setPromptOrigin,
      })
    );

    act(() => {
      result.current();
    });

    expect(setPromptOrigin).toHaveBeenCalledWith("manual");
    expect(handleGenerate).toHaveBeenCalledWith(
      "raw inline prompt",
      expect.objectContaining({
        modeOverride: "image",
        toolOverride: "create",
      })
    );
  });

  it("falls back to the Standard prompt when composer input is empty", () => {
    const handleGenerate = vi.fn();
    const setPromptOrigin = vi.fn();
    const { result } = renderHook(() =>
      useStandardCreateInlineGenerate({
        agentInput: "   ",
        prompt: "shared fallback prompt",
        currentCostCredits: 3,
        promptReferenceGenerateCostCredits: null,
        handleGenerate,
        setPromptOrigin,
      })
    );

    act(() => {
      result.current();
    });

    expect(setPromptOrigin).toHaveBeenCalledWith("manual");
    expect(handleGenerate).toHaveBeenCalledWith(
      "shared fallback prompt",
      expect.objectContaining({
        modeOverride: "image",
        toolOverride: "create",
      })
    );
  });

  it("does nothing when the Standard inline command is disabled", () => {
    const handleGenerate = vi.fn();
    const setPromptOrigin = vi.fn();
    const { result } = renderHook(() =>
      useStandardCreateInlineGenerate({
        enabled: false,
        agentInput: "pulse draft that must not generate",
        prompt: "shared fallback prompt",
        currentCostCredits: 3,
        promptReferenceGenerateCostCredits: null,
        handleGenerate,
        setPromptOrigin,
      })
    );

    act(() => {
      result.current();
    });

    expect(setPromptOrigin).not.toHaveBeenCalled();
    expect(handleGenerate).not.toHaveBeenCalled();
  });

  it("suppresses overlapping Standard inline generate clicks until the first submit settles", async () => {
    let resolveFirstSubmit!: () => void;
    const firstSubmitSettled = new Promise<void>((resolve) => {
      resolveFirstSubmit = resolve;
    });
    const handleGenerate = vi.fn(() => firstSubmitSettled);
    const setPromptOrigin = vi.fn();

    const { result } = renderHook(() =>
      useStandardCreateInlineGenerate({
        agentInput: "inline prompt",
        prompt: "shared fallback prompt",
        currentCostCredits: 3,
        promptReferenceGenerateCostCredits: null,
        handleGenerate,
        setPromptOrigin,
      })
    );

    act(() => {
      result.current();
      result.current();
    });

    expect(handleGenerate).toHaveBeenCalledTimes(1);
    expect(setPromptOrigin).toHaveBeenCalledTimes(1);

    resolveFirstSubmit();
    await act(async () => {
      await firstSubmitSettled;
    });

    act(() => {
      result.current();
    });

    expect(handleGenerate).toHaveBeenCalledTimes(2);
  });
});
