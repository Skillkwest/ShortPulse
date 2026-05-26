import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useStandardCreatePrimarySubmit } from "../useStandardCreatePrimarySubmit";

describe("useStandardCreatePrimarySubmit", () => {
  it("generates directly from the visible Standard chat composer", async () => {
    const handleGenerate = vi.fn();
    const handleProviderPrimarySubmit = vi.fn();
    const setSharedPrompt = vi.fn();

    const { result } = renderHook(() =>
      useStandardCreatePrimarySubmit({
        selectedTool: "create",
        chatModeEnabled: true,
        agentInput: "standard draft",
        prompt: "fallback prompt",
        createGenerateCostCredits: 3,
        handleGenerate,
        handleProviderPrimarySubmit,
        setSharedPrompt,
      })
    );

    await act(async () => {
      result.current();
    });

    expect(handleProviderPrimarySubmit).not.toHaveBeenCalled();
    expect(setSharedPrompt).toHaveBeenCalledWith("standard draft");
    expect(handleGenerate).toHaveBeenCalledWith(
      "standard draft",
      expect.objectContaining({
        modeOverride: "image",
        toolOverride: "create",
      })
    );
  });

  it("does not fall back to hidden Standard prompt state when the chat composer is empty", async () => {
    const handleGenerate = vi.fn();
    const setSharedPrompt = vi.fn();

    const { result } = renderHook(() =>
      useStandardCreatePrimarySubmit({
        selectedTool: "text",
        chatModeEnabled: true,
        agentInput: "",
        prompt: "standard prompt fallback",
        createGenerateCostCredits: 3,
        handleGenerate,
        handleProviderPrimarySubmit: vi.fn(),
        setSharedPrompt,
      })
    );

    await act(async () => {
      result.current();
    });

    expect(handleGenerate).not.toHaveBeenCalled();
    expect(setSharedPrompt).not.toHaveBeenCalled();
  });

  it("submits directly to generation when Standard chat mode is off", () => {
    const handleProviderPrimarySubmit = vi.fn();
    const handleGenerate = vi.fn();
    const setSharedPrompt = vi.fn();

    const { result } = renderHook(() =>
      useStandardCreatePrimarySubmit({
        selectedTool: "create",
        chatModeEnabled: false,
        agentInput: "standard draft",
        prompt: "standard prompt",
        createGenerateCostCredits: 3,
        handleGenerate,
        handleProviderPrimarySubmit,
        setSharedPrompt,
      })
    );

    act(() => {
      result.current();
    });

    expect(handleProviderPrimarySubmit).not.toHaveBeenCalled();
    expect(handleGenerate).toHaveBeenCalledWith(
      "standard prompt",
      expect.objectContaining({
        modeOverride: "image",
        toolOverride: "create",
      })
    );
    expect(setSharedPrompt).not.toHaveBeenCalled();
  });

  it("uses the visible Standard chat composer even when the page mode is image", async () => {
    const handleGenerate = vi.fn();
    const handleProviderPrimarySubmit = vi.fn();
    const setSharedPrompt = vi.fn();

    const { result } = renderHook(() =>
      useStandardCreatePrimarySubmit({
        selectedTool: "create",
        chatModeEnabled: true,
        agentInput: "image-mode standard draft",
        prompt: "fallback prompt",
        createGenerateCostCredits: 3,
        handleGenerate,
        handleProviderPrimarySubmit,
        setSharedPrompt,
      })
    );

    await act(async () => {
      result.current();
    });

    expect(handleProviderPrimarySubmit).not.toHaveBeenCalled();
    expect(setSharedPrompt).toHaveBeenCalledWith("image-mode standard draft");
    expect(handleGenerate).toHaveBeenCalledWith(
      "image-mode standard draft",
      expect.objectContaining({
        modeOverride: "image",
        toolOverride: "create",
      })
    );
  });

  it("uses the authored Standard prompt in chat-off mode even when the page mode is image", () => {
    const handleProviderPrimarySubmit = vi.fn();
    const handleGenerate = vi.fn();
    const setSharedPrompt = vi.fn();

    const { result } = renderHook(() =>
      useStandardCreatePrimarySubmit({
        selectedTool: "create",
        chatModeEnabled: false,
        agentInput: "transient agent draft",
        prompt: "image-mode authored prompt",
        createGenerateCostCredits: 3,
        handleGenerate,
        handleProviderPrimarySubmit,
        setSharedPrompt,
      })
    );

    act(() => {
      result.current();
    });

    expect(handleProviderPrimarySubmit).not.toHaveBeenCalled();
    expect(handleGenerate).toHaveBeenCalledWith(
      "image-mode authored prompt",
      expect.objectContaining({
        modeOverride: "image",
        toolOverride: "create",
      })
    );
    expect(setSharedPrompt).not.toHaveBeenCalled();
  });

  it("falls back to the provider submit path for non-Standard-create tools", () => {
    const handleProviderPrimarySubmit = vi.fn();
    const handleGenerate = vi.fn();

    const { result } = renderHook(() =>
      useStandardCreatePrimarySubmit({
        selectedTool: "image",
        chatModeEnabled: false,
        agentInput: "ignored",
        prompt: "edit prompt",
        createGenerateCostCredits: 3,
        handleGenerate,
        handleProviderPrimarySubmit,
        setSharedPrompt: vi.fn(),
      })
    );

    act(() => {
      result.current();
    });

    expect(handleGenerate).not.toHaveBeenCalled();
    expect(handleProviderPrimarySubmit).toHaveBeenCalledTimes(1);
  });

  it("does nothing when the Standard command is disabled", async () => {
    const handleGenerate = vi.fn();
    const handleProviderPrimarySubmit = vi.fn();

    const { result } = renderHook(() =>
      useStandardCreatePrimarySubmit({
        enabled: false,
        selectedTool: "create",
        chatModeEnabled: true,
        agentInput: "pulse draft that must not submit",
        prompt: "standard prompt",
        createGenerateCostCredits: 3,
        handleGenerate,
        handleProviderPrimarySubmit,
        setSharedPrompt: vi.fn(),
      })
    );

    await act(async () => {
      result.current();
    });

    expect(handleGenerate).not.toHaveBeenCalled();
    expect(handleProviderPrimarySubmit).not.toHaveBeenCalled();
  });

  it("uses the same displayed Standard create cost for the primary submit override", async () => {
    const handleGenerate = vi.fn();

    const { result } = renderHook(() =>
      useStandardCreatePrimarySubmit({
        selectedTool: "create",
        chatModeEnabled: true,
        agentInput: "visible composer prompt",
        prompt: "fallback prompt",
        createGenerateCostCredits: 7,
        handleGenerate,
        handleProviderPrimarySubmit: vi.fn(),
        setSharedPrompt: vi.fn(),
      })
    );

    await act(async () => {
      result.current();
    });

    expect(handleGenerate).toHaveBeenCalledWith(
      "visible composer prompt",
      expect.objectContaining({
        costOverrideCredits: 7,
      })
    );
  });

  it("suppresses overlapping Standard create submits until the first submit settles", async () => {
    let resolveFirstSubmit!: () => void;
    const firstSubmitSettled = new Promise<void>((resolve) => {
      resolveFirstSubmit = resolve;
    });
    const handleGenerate = vi.fn(() => firstSubmitSettled);
    const setSharedPrompt = vi.fn();

    const { result } = renderHook(() =>
      useStandardCreatePrimarySubmit({
        selectedTool: "create",
        chatModeEnabled: true,
        agentInput: "visible composer prompt",
        prompt: "fallback prompt",
        createGenerateCostCredits: 7,
        handleGenerate,
        handleProviderPrimarySubmit: vi.fn(),
        setSharedPrompt,
      })
    );

    act(() => {
      result.current();
      result.current();
    });

    expect(handleGenerate).toHaveBeenCalledTimes(1);
    expect(setSharedPrompt).toHaveBeenCalledTimes(1);

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
