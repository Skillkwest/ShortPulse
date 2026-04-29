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
});
