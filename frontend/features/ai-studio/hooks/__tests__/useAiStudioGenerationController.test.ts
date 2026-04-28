import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Dispatch, SetStateAction } from "react";
import type { StudioOutput } from "../../types";
import { INPAINT_FLUX_FILL_MODEL_ID } from "../../logic/inpaintSubmission";
import { useAiStudioGenerationController } from "../useAiStudioGenerationController";

const asDispatch = <T>(fn: (...args: unknown[]) => unknown): Dispatch<SetStateAction<T>> =>
  fn as unknown as Dispatch<SetStateAction<T>>;

const createParams = (
  overrides: Partial<Parameters<typeof useAiStudioGenerationController>[0]> = {}
): Parameters<typeof useAiStudioGenerationController>[0] => {
  const baseParams: Parameters<typeof useAiStudioGenerationController>[0] = {
    mode: "image",
    selectedTool: "create",
    model: "fal-ai/bytedance/seedream/v4.5/text-to-image",
    setModel: vi.fn(),
    isCharacterModeEnabled: false,
    prompt: "",
    agentInput: "",
    usesAgentLane: true,
    currentCostCredits: 3,
    resolveCostCreditsForModel: vi.fn(() => null),
    isGenerateDisabled: false,
    isCreditGuardrail: false,
    generationGuardrail: null,
    effectiveBalanceCredits: 100,
    balanceCredits: 100,
    optimisticUncoveredDebitTotal: 0,
    setUiError: asDispatch<string | null>(vi.fn()),
    setUiNotice: asDispatch<string | null>(vi.fn()),
    setPromptOrigin: asDispatch<"manual" | "agent" | "reference">(vi.fn()),
    setOptimisticDebitEntries: asDispatch<{ credits: number; outputId: string | null }[]>(vi.fn()),
    refreshBalance: vi.fn(async () => 100),
    handleAgentSend: vi.fn(async () => ({ prompt: "agent prompt", referenceTitle: "Agent ref" })),
    addAgentPromptReference: vi.fn(),
    resolveDefaultPromptForTool: vi.fn(() => "default prompt"),
    refreshCharacterModeInjectionBundleForSubmission: vi.fn(async () => null),
    resolveCharacterModeSubmissionOverrides: vi.fn(() => null),
    resolveReferenceInputsForTool: vi.fn(() => ({
      referenceImageUrl: "https://example.com/reference.png",
      extraImageUrls: [null, null, null] as [string | null, string | null, string | null],
    })),
    trackCharacterModeFallback: vi.fn(),
    generateOutput: vi.fn(),
    regenerateOutput: vi.fn(),
  };

  return {
    ...baseParams,
    ...overrides,
    usesAgentLane: overrides.usesAgentLane ?? baseParams.usesAgentLane,
  };
};

describe("useAiStudioGenerationController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("routes primary text create submit through agent send and applies returned prompt origin", async () => {
    const handleAgentSend = vi.fn(async () => ({
      prompt: "refined from agent",
      referenceTitle: "Refined",
    }));
    const addAgentPromptReference = vi.fn();
    const setPromptOrigin = vi.fn();
    const generateOutput = vi.fn();
    const params = createParams({
      mode: "text",
      selectedTool: "create",
      prompt: "draft prompt",
      handleAgentSend,
      addAgentPromptReference,
      setPromptOrigin: asDispatch<"manual" | "agent" | "reference">(setPromptOrigin),
      generateOutput,
    });
    const { result } = renderHook(() => useAiStudioGenerationController(params));

    act(() => {
      result.current.handlePrimarySubmit();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(handleAgentSend).toHaveBeenCalledWith("draft prompt", { captureResult: true });
    expect(addAgentPromptReference).toHaveBeenCalledWith("refined from agent", "Refined");
    expect(setPromptOrigin).toHaveBeenCalledWith("agent");
    expect(generateOutput).not.toHaveBeenCalled();
  });

  it("routes chat-off primary text create submit into create image generation", async () => {
    const handleAgentSend = vi.fn(async () => ({
      prompt: "agent prompt should not be used",
      referenceTitle: "unused",
    }));
    const generateOutput = vi.fn();
    const setPromptOrigin = vi.fn();
    const params = createParams({
      mode: "text",
      selectedTool: "create",
      prompt: "shared fallback",
      agentInput: "raw composer prompt",
      usesAgentLane: false,
      handleAgentSend,
      generateOutput,
      setPromptOrigin: asDispatch<"manual" | "agent" | "reference">(setPromptOrigin),
    });
    const { result } = renderHook(() => useAiStudioGenerationController(params));

    act(() => {
      result.current.handlePrimarySubmit();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(handleAgentSend).not.toHaveBeenCalled();
    expect(setPromptOrigin).toHaveBeenCalledWith("manual");
    expect(generateOutput).toHaveBeenCalledWith(
      "raw composer prompt",
      expect.objectContaining({
        modeOverride: "image",
        selectedToolOverride: "create",
      })
    );
  });

  it("falls back to shared prompt for chat-off primary submit when composer input is empty", async () => {
    const handleAgentSend = vi.fn(async () => ({
      prompt: "agent prompt should not be used",
      referenceTitle: "unused",
    }));
    const generateOutput = vi.fn();
    const setPromptOrigin = vi.fn();
    const params = createParams({
      mode: "text",
      selectedTool: "create",
      prompt: "  shared fallback prompt  ",
      agentInput: "   ",
      usesAgentLane: false,
      handleAgentSend,
      generateOutput,
      setPromptOrigin: asDispatch<"manual" | "agent" | "reference">(setPromptOrigin),
    });
    const { result } = renderHook(() => useAiStudioGenerationController(params));

    act(() => {
      result.current.handlePrimarySubmit();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(handleAgentSend).not.toHaveBeenCalled();
    expect(setPromptOrigin).toHaveBeenCalledWith("manual");
    expect(generateOutput).toHaveBeenCalledWith(
      "shared fallback prompt",
      expect.objectContaining({
        modeOverride: "image",
        selectedToolOverride: "create",
      })
    );
  });

  it("uses chat-off inline generate to submit trimmed raw input to create image generation", async () => {
    const handleAgentSend = vi.fn(async () => ({
      prompt: "agent prompt should not be used",
      referenceTitle: "unused",
    }));
    const generateOutput = vi.fn();
    const setPromptOrigin = vi.fn();
    const params = createParams({
      mode: "text",
      selectedTool: "create",
      prompt: "shared fallback prompt",
      agentInput: "  raw inline prompt  ",
      usesAgentLane: false,
      handleAgentSend,
      generateOutput,
      setPromptOrigin: asDispatch<"manual" | "agent" | "reference">(setPromptOrigin),
    });
    const { result } = renderHook(() => useAiStudioGenerationController(params));

    act(() => {
      result.current.handleChatOffInlineGenerate();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(handleAgentSend).not.toHaveBeenCalled();
    expect(setPromptOrigin).toHaveBeenCalledWith("manual");
    expect(generateOutput).toHaveBeenCalledWith(
      "raw inline prompt",
      expect.objectContaining({
        modeOverride: "image",
        selectedToolOverride: "create",
      })
    );
  });

  it("falls back to shared prompt for chat-off inline generate when input is empty", async () => {
    const handleAgentSend = vi.fn(async () => ({
      prompt: "agent prompt should not be used",
      referenceTitle: "unused",
    }));
    const generateOutput = vi.fn();
    const setPromptOrigin = vi.fn();
    const params = createParams({
      mode: "text",
      selectedTool: "create",
      prompt: "shared fallback prompt",
      agentInput: "   ",
      usesAgentLane: false,
      handleAgentSend,
      generateOutput,
      setPromptOrigin: asDispatch<"manual" | "agent" | "reference">(setPromptOrigin),
    });
    const { result } = renderHook(() => useAiStudioGenerationController(params));

    act(() => {
      result.current.handleChatOffInlineGenerate();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(handleAgentSend).not.toHaveBeenCalled();
    expect(setPromptOrigin).toHaveBeenCalledWith("manual");
    expect(generateOutput).toHaveBeenCalledWith(
      "shared fallback prompt",
      expect.objectContaining({
        modeOverride: "image",
        selectedToolOverride: "create",
      })
    );
  });

  it("creates optimistic debits for chat-off primary submit because it routes into generation", async () => {
    const setOptimisticDebitEntries = vi.fn();
    const params = createParams({
      mode: "text",
      selectedTool: "create",
      prompt: "shared fallback",
      agentInput: "raw prompt",
      usesAgentLane: false,
      currentCostCredits: 3,
      setOptimisticDebitEntries:
        asDispatch<{ credits: number; outputId: string | null }[]>(setOptimisticDebitEntries),
    });
    const { result } = renderHook(() => useAiStudioGenerationController(params));

    act(() => {
      result.current.handlePrimarySubmit();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(setOptimisticDebitEntries).toHaveBeenCalledTimes(1);
  });

  it("creates optimistic debits for chat-off inline generate because it routes into generation", async () => {
    const setOptimisticDebitEntries = vi.fn();
    const params = createParams({
      mode: "text",
      selectedTool: "create",
      prompt: "shared fallback",
      agentInput: "raw prompt",
      usesAgentLane: false,
      currentCostCredits: 3,
      setOptimisticDebitEntries:
        asDispatch<{ credits: number; outputId: string | null }[]>(setOptimisticDebitEntries),
    });
    const { result } = renderHook(() => useAiStudioGenerationController(params));

    act(() => {
      result.current.handleChatOffInlineGenerate();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(setOptimisticDebitEntries).toHaveBeenCalledTimes(1);
  });

  it("shows explicit error when chat-off inline generate has no prompt input", async () => {
    const setUiError = vi.fn();
    const generateOutput = vi.fn();
    const params = createParams({
      mode: "text",
      selectedTool: "create",
      prompt: "   ",
      agentInput: "   ",
      usesAgentLane: false,
      setUiError: asDispatch<string | null>(setUiError),
      generateOutput,
    });
    const { result } = renderHook(() => useAiStudioGenerationController(params));

    act(() => {
      result.current.handleChatOffInlineGenerate();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(setUiError).toHaveBeenCalledWith("Add a prompt to start a generation.");
    expect(generateOutput).not.toHaveBeenCalled();
  });

  it("keeps Pulse create submit on the agent lane even when the Standard toggle is off", async () => {
    const handleAgentSend = vi.fn(async () => ({
      prompt: "pulse bootstrap prompt",
      referenceTitle: "Pulse",
    }));
    const addAgentPromptReference = vi.fn();
    const setPromptOrigin = vi.fn();
    const generateOutput = vi.fn();
    const params = createParams({
      mode: "text",
      selectedTool: "create",
      prompt: "pulse draft",
      usesAgentLane: true,
      handleAgentSend,
      addAgentPromptReference,
      setPromptOrigin: asDispatch<"manual" | "agent" | "reference">(setPromptOrigin),
      generateOutput,
    });
    const { result } = renderHook(() => useAiStudioGenerationController(params));

    act(() => {
      result.current.handlePrimarySubmit();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(handleAgentSend).toHaveBeenCalledWith("pulse draft", { captureResult: true });
    expect(addAgentPromptReference).toHaveBeenCalledWith("pulse bootstrap prompt", "Pulse");
    expect(setPromptOrigin).toHaveBeenCalledWith("agent");
    expect(generateOutput).not.toHaveBeenCalled();
  });

  it("allows repeated create generate submissions without client-side locking", async () => {
    const refreshCharacterModeInjectionBundleForSubmission = vi.fn(async () => null);
    const generateOutput = vi.fn();
    const params = createParams({
      generateOutput,
      refreshCharacterModeInjectionBundleForSubmission,
    });
    const { result } = renderHook(() => useAiStudioGenerationController(params));

    await act(async () => {
      await result.current.handleGenerate("prompt");
    });

    await act(async () => {
      await result.current.handleGenerate("prompt");
    });

    expect(generateOutput).toHaveBeenCalledTimes(2);
    expect(refreshCharacterModeInjectionBundleForSubmission).toHaveBeenCalledTimes(2);
  });

  it("allows repeated edit regenerates without locking the edit lane", async () => {
    const refreshCharacterModeInjectionBundleForSubmission = vi.fn(async () => null);
    const regenerateOutput = vi.fn();
    const params = createParams({
      regenerateOutput,
      refreshCharacterModeInjectionBundleForSubmission,
    });
    const { result } = renderHook(() => useAiStudioGenerationController(params));

    await act(async () => {
      await result.current.handleImageRegenerateWithDebit();
    });

    await act(async () => {
      await result.current.handleImageRegenerateWithDebit();
    });

    expect(regenerateOutput).toHaveBeenCalledTimes(2);
    expect(refreshCharacterModeInjectionBundleForSubmission).toHaveBeenCalledTimes(2);
  });

  it("allows repeated video regenerates without locking the video lane", async () => {
    const refreshCharacterModeInjectionBundleForSubmission = vi.fn(async () => null);
    const regenerateOutput = vi.fn();
    const params = createParams({
      regenerateOutput,
      refreshCharacterModeInjectionBundleForSubmission,
    });
    const { result } = renderHook(() => useAiStudioGenerationController(params));

    await act(async () => {
      await result.current.handleRegenerateWithDebit();
    });

    await act(async () => {
      await result.current.handleRegenerateWithDebit();
    });

    expect(regenerateOutput).toHaveBeenCalledTimes(2);
    expect(refreshCharacterModeInjectionBundleForSubmission).toHaveBeenCalledTimes(2);
  });

  it("still blocks on non-cap guardrails while other props change", async () => {
    const generateOutput = vi.fn();
    const initialParams = createParams({
      generateOutput,
      isGenerateDisabled: true,
      generationGuardrail: "Select a model before generating.",
    });
    const { result, rerender } = renderHook(
      (params: Parameters<typeof useAiStudioGenerationController>[0]) =>
        useAiStudioGenerationController(params),
      { initialProps: initialParams }
    );

    await act(async () => {
      await result.current.handleGenerate("blocked prompt");
    });

    expect(generateOutput).not.toHaveBeenCalled();

    rerender(
      createParams({
        generateOutput,
        isGenerateDisabled: false,
        generationGuardrail: null,
      })
    );

    let nextResult: Awaited<ReturnType<typeof result.current.handleGenerate>> | null = null;
    await act(async () => {
      nextResult = await result.current.handleGenerate("allowed prompt");
    });

    expect(nextResult).toEqual({ accepted: true, optimisticOutputId: null });
    expect(generateOutput).toHaveBeenCalledTimes(1);
  });

  it("allows generate submissions while agent send is in flight", async () => {
    const generateOutput = vi.fn();
    const params = createParams({
      generateOutput,
    });
    const { result } = renderHook(() => useAiStudioGenerationController(params));

    let generateResult: Awaited<ReturnType<typeof result.current.handleGenerate>> | null = null;
    await act(async () => {
      generateResult = await result.current.handleGenerate("prompt");
    });

    expect(generateOutput).toHaveBeenCalledTimes(1);
    expect(generateResult).toEqual({ accepted: true, optimisticOutputId: null });
  });

  it("inserts an optimistic placeholder before async submission prep and forwards its output id", async () => {
    const callOrder: string[] = [];
    const generateOutput = vi.fn(() => {
      callOrder.push("submit");
    });
    const insertOptimisticGenerationPlaceholder = vi.fn(() => {
      callOrder.push("placeholder");
      return "out-optimistic";
    });
    const refreshCharacterModeInjectionBundleForSubmission = vi.fn(async () => {
      callOrder.push("refresh");
      return null;
    });
    const params = createParams({
      generateOutput,
      insertOptimisticGenerationPlaceholder,
      refreshCharacterModeInjectionBundleForSubmission,
    });
    const { result } = renderHook(() => useAiStudioGenerationController(params));
    let generateResult: Awaited<ReturnType<typeof result.current.handleGenerate>> | null = null;

    await act(async () => {
      generateResult = await result.current.handleGenerate("prompt");
    });

    expect(callOrder).toEqual(["placeholder", "refresh", "submit"]);
    expect(insertOptimisticGenerationPlaceholder).toHaveBeenCalledWith({
      prompt: "prompt",
      modeOverride: "image",
      selectedToolOverride: "create",
    });
    expect(generateOutput).toHaveBeenCalledWith(
      "prompt",
      expect.objectContaining({ outputIdOverride: "out-optimistic" })
    );
    expect(generateResult).toEqual({ accepted: true, optimisticOutputId: "out-optimistic" });
  });

  it("cleans up optimistic placeholder when pre-submit character prep fails", async () => {
    const setUiError = vi.fn();
    const setOptimisticDebitEntries = vi.fn();
    const generateOutput = vi.fn();
    const insertOptimisticGenerationPlaceholder = vi.fn(() => "out-optimistic");
    const removeOptimisticGenerationPlaceholder = vi.fn();
    const refreshCharacterModeInjectionBundleForSubmission = vi.fn(async () => {
      throw new Error("Character context unavailable");
    });
    const params = createParams({
      setUiError: asDispatch<string | null>(setUiError),
      setOptimisticDebitEntries:
        asDispatch<{ credits: number; outputId: string | null }[]>(setOptimisticDebitEntries),
      generateOutput,
      insertOptimisticGenerationPlaceholder,
      removeOptimisticGenerationPlaceholder,
      refreshCharacterModeInjectionBundleForSubmission,
    });
    const { result } = renderHook(() => useAiStudioGenerationController(params));

    await act(async () => {
      await result.current.handleGenerate("prompt");
    });

    expect(removeOptimisticGenerationPlaceholder).toHaveBeenCalledWith("out-optimistic");
    expect(setUiError).toHaveBeenCalledWith("Character context unavailable");
    expect(setOptimisticDebitEntries).not.toHaveBeenCalled();
    expect(generateOutput).not.toHaveBeenCalled();
  });

  it("fails fast and removes optimistic placeholder when preflight times out", async () => {
    vi.useFakeTimers();
    try {
      const setUiError = vi.fn();
      const generateOutput = vi.fn();
      const insertOptimisticGenerationPlaceholder = vi.fn(() => "out-optimistic");
      const removeOptimisticGenerationPlaceholder = vi.fn();
      const trackCharacterModeEvent = vi.fn();
      const refreshCharacterModeInjectionBundleForSubmission = vi.fn(
        async () =>
          await new Promise<null>(() => {
            // intentionally unresolved to trigger timeout
          })
      );
      const params = createParams({
        setUiError: asDispatch<string | null>(setUiError),
        generateOutput,
        insertOptimisticGenerationPlaceholder,
        removeOptimisticGenerationPlaceholder,
        trackCharacterModeEvent,
        refreshCharacterModeInjectionBundleForSubmission,
      });
      const { result } = renderHook(() => useAiStudioGenerationController(params));

      await act(async () => {
        const pending = result.current.handleGenerate("prompt");
        await vi.advanceTimersByTimeAsync(10_000);
        await Promise.resolve();
        await pending;
      });

      expect(removeOptimisticGenerationPlaceholder).toHaveBeenCalledWith("out-optimistic");
      expect(setUiError).toHaveBeenCalledWith(
        "Preparation timed out before generation started. Please retry."
      );
      expect(generateOutput).not.toHaveBeenCalled();
      expect(trackCharacterModeEvent).toHaveBeenCalledWith(
        "generation_preflight_started",
        expect.objectContaining({ trigger: "generate" })
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("fails generate when override cost cannot be covered after refresh", async () => {
    const setUiError = vi.fn();
    const refreshBalance = vi.fn(async () => 1);
    const generateOutput = vi.fn();
    const params = createParams({
      effectiveBalanceCredits: 1,
      balanceCredits: 1,
      refreshBalance,
      setUiError: asDispatch<string | null>(setUiError),
      generateOutput,
    });
    const { result } = renderHook(() => useAiStudioGenerationController(params));

    await act(async () => {
      await result.current.handleGenerate("prompt", { costOverrideCredits: 5 });
    });

    expect(refreshBalance).toHaveBeenCalledWith(
      expect.objectContaining({ silent: true, beforeCommit: expect.any(Function) })
    );
    expect(setUiError).toHaveBeenCalledWith("You do not have enough credits for this run.");
    expect(generateOutput).not.toHaveBeenCalled();
  });

  it("accounts for uncovered optimistic debits after refresh", async () => {
    const setUiError = vi.fn();
    const refreshBalance = vi.fn(async () => 6);
    const generateOutput = vi.fn();
    const params = createParams({
      effectiveBalanceCredits: 4,
      balanceCredits: 6,
      optimisticUncoveredDebitTotal: 2,
      refreshBalance,
      setUiError: asDispatch<string | null>(setUiError),
      generateOutput,
    });
    const { result } = renderHook(() => useAiStudioGenerationController(params));

    await act(async () => {
      await result.current.handleGenerate("prompt", { costOverrideCredits: 5 });
    });

    expect(refreshBalance).toHaveBeenCalledWith(
      expect.objectContaining({ silent: true, beforeCommit: expect.any(Function) })
    );
    expect(setUiError).toHaveBeenCalledWith("You do not have enough credits for this run.");
    expect(generateOutput).not.toHaveBeenCalled();
  });

  it("uses authoritative snapshot refresh without re-subtracting optimistic holds", async () => {
    const setUiError = vi.fn();
    const generateOutput = vi.fn();
    const refreshBalance = vi.fn(
      async (options?: {
        beforeCommit?: (snapshot: {
          cents: number;
          updatedAt: string | null;
          reservedCents?: number | null;
          source?: "snapshot" | "fallback";
        }) => void;
      }) => {
        options?.beforeCommit?.({
          cents: 6,
          updatedAt: "2026-02-15T21:00:00.000Z",
          reservedCents: 2,
          source: "snapshot",
        });
        return 6;
      }
    );
    const params = createParams({
      effectiveBalanceCredits: 4,
      balanceCredits: 6,
      optimisticUncoveredDebitTotal: 2,
      refreshBalance,
      setUiError: asDispatch<string | null>(setUiError),
      generateOutput,
    });
    const { result } = renderHook(() => useAiStudioGenerationController(params));

    await act(async () => {
      await result.current.handleGenerate("prompt", { costOverrideCredits: 5 });
    });

    expect(refreshBalance).toHaveBeenCalledWith(
      expect.objectContaining({ silent: true, beforeCommit: expect.any(Function) })
    );
    expect(setUiError).not.toHaveBeenCalledWith("You do not have enough credits for this run.");
    expect(generateOutput).toHaveBeenCalledTimes(1);
  });

  it("applies optimistic subtraction when refresh reports fallback source", async () => {
    const setUiError = vi.fn();
    const generateOutput = vi.fn();
    const refreshBalance = vi.fn(
      async (options?: {
        beforeCommit?: (snapshot: {
          cents: number;
          updatedAt: string | null;
          reservedCents?: number | null;
          source?: "snapshot" | "fallback";
        }) => void;
      }) => {
        options?.beforeCommit?.({
          cents: 6,
          updatedAt: "2026-02-15T21:05:00.000Z",
          reservedCents: null,
          source: "fallback",
        });
        return 6;
      }
    );
    const params = createParams({
      effectiveBalanceCredits: 4,
      balanceCredits: 6,
      optimisticUncoveredDebitTotal: 2,
      refreshBalance,
      setUiError: asDispatch<string | null>(setUiError),
      generateOutput,
    });
    const { result } = renderHook(() => useAiStudioGenerationController(params));

    await act(async () => {
      await result.current.handleGenerate("prompt", { costOverrideCredits: 5 });
    });

    expect(refreshBalance).toHaveBeenCalledWith(
      expect.objectContaining({ silent: true, beforeCommit: expect.any(Function) })
    );
    expect(setUiError).toHaveBeenCalledWith("You do not have enough credits for this run.");
    expect(generateOutput).not.toHaveBeenCalled();
  });

  it("regenerates with optimistic debit and submission overrides", async () => {
    const setOptimisticDebitEntries = vi.fn();
    const regenerateOutput = vi.fn();
    const setUiNotice = vi.fn();
    const resolveDefaultPromptForTool = vi.fn(() => "default prompt");
    const refreshCharacterModeInjectionBundleForSubmission = vi.fn(async () => ({ bundle: true }));
    const resolveCharacterModeSubmissionOverrides = vi.fn(() => ({
      submissionPromptOverride: "submission",
      displayPromptOverride: "display",
      referenceInputsOverride: ["https://example.com/ref.png"],
      characterContextOverride: {
        applied: true,
        characterId: "char-1",
        characterName: "A",
        characterProfileImageUrl: null,
      } as StudioOutput["characterContext"],
      notice: "Character context applied",
      fallbackCode: null,
      characterReferenceCount: 1,
      hasCharacterDescription: true,
    }));
    const params = createParams({
      currentCostCredits: 7,
      setOptimisticDebitEntries:
        asDispatch<{ credits: number; outputId: string | null }[]>(setOptimisticDebitEntries),
      regenerateOutput,
      setUiNotice: asDispatch<string | null>(setUiNotice),
      resolveDefaultPromptForTool,
      refreshCharacterModeInjectionBundleForSubmission,
      resolveCharacterModeSubmissionOverrides,
    });
    const { result } = renderHook(() => useAiStudioGenerationController(params));

    await act(async () => {
      await result.current.handleRegenerateWithDebit();
    });

    expect(resolveDefaultPromptForTool).toHaveBeenCalledWith("video");
    expect(refreshCharacterModeInjectionBundleForSubmission).toHaveBeenCalledWith("video");
    expect(regenerateOutput).toHaveBeenCalledWith({
      selectedToolOverride: "video",
      modelIdOverride: "fal-ai/bytedance/seedream/v4.5/text-to-image",
      submissionPromptOverride: "submission",
      displayPromptOverride: "display",
      referenceInputsOverride: ["https://example.com/ref.png"],
      characterContextOverride: {
        applied: true,
        characterId: "char-1",
        characterName: "A",
        characterProfileImageUrl: null,
      },
    });
    expect(setUiNotice).toHaveBeenCalledWith("Character context applied");
    const updater = setOptimisticDebitEntries.mock.calls[0]?.[0] as
      | ((prev: { credits: number; outputId: string | null }[]) => {
          credits: number;
          outputId: string | null;
          createdAtMs?: number;
        }[])
      | undefined;
    expect(typeof updater).toBe("function");
    expect(updater?.([])).toEqual([
      expect.objectContaining({ credits: 7, outputId: null, createdAtMs: expect.any(Number) }),
    ]);
  });

  it("forwards explicit image regenerate reference overrides", async () => {
    const regenerateOutput = vi.fn();
    const resolveCharacterModeSubmissionOverrides = vi.fn(() => null);
    const params = createParams({
      selectedTool: "edit",
      model: "fal-ai/bytedance/seedream/v5/lite/edit",
      regenerateOutput,
      resolveCharacterModeSubmissionOverrides,
    });
    const { result } = renderHook(() => useAiStudioGenerationController(params));

    await act(async () => {
      await result.current.handleImageRegenerateWithDebit({
        referenceInputsOverride: ["blob:flatten-primary", "https://example.com/extra.png"],
      });
    });

    expect(resolveCharacterModeSubmissionOverrides).toHaveBeenCalledWith(
      "default prompt",
      "edit",
      null,
      ["blob:flatten-primary", "https://example.com/extra.png"]
    );
    expect(regenerateOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        modelIdOverride: "fal-ai/bytedance/seedream/v5/lite/edit",
        referenceInputsOverride: ["blob:flatten-primary", "https://example.com/extra.png"],
      })
    );
  });

  it("allows promptless regenerate when model override is Bria background remove", async () => {
    const regenerateOutput = vi.fn();
    const setUiError = vi.fn();
    const params = createParams({
      selectedTool: "edit",
      model: "fal-ai/bytedance/seedream/v5/lite/edit",
      resolveDefaultPromptForTool: vi.fn(() => ""),
      regenerateOutput,
      setUiError: asDispatch<string | null>(setUiError),
      resolveCharacterModeSubmissionOverrides: vi.fn(() => null),
    });
    const { result } = renderHook(() => useAiStudioGenerationController(params));

    await act(async () => {
      await result.current.handleImageRegenerateWithDebit({
        referenceInputsOverride: ["blob:flatten-primary"],
        modelIdOverride: "fal-ai/bria/background/remove",
      });
    });

    expect(regenerateOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        modelIdOverride: "fal-ai/bria/background/remove",
        referenceInputsOverride: ["blob:flatten-primary"],
      })
    );
    expect(setUiError).not.toHaveBeenCalledWith("Add a prompt to start a generation.");
  });

  it("forwards explicit regenerate display/submission prompt overrides", async () => {
    const regenerateOutput = vi.fn();
    const resolveCharacterModeSubmissionOverrides = vi.fn(() => null);
    const params = createParams({
      selectedTool: "edit",
      model: "fal-ai/nano-banana-pro/edit",
      resolveCharacterModeSubmissionOverrides,
      regenerateOutput,
    });
    const { result } = renderHook(() => useAiStudioGenerationController(params));

    await act(async () => {
      await result.current.handleImageRegenerateWithDebit({
        displayPromptOverride: "raw @img1 prompt",
        submissionPromptOverride: "compiled Figure 2 prompt",
      });
    });

    expect(resolveCharacterModeSubmissionOverrides).toHaveBeenCalledWith(
      "compiled Figure 2 prompt",
      "edit",
      null,
      ["https://example.com/reference.png"]
    );
    expect(regenerateOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        displayPromptOverride: "raw @img1 prompt",
        submissionPromptOverride: "compiled Figure 2 prompt",
      })
    );
  });

  it("removes an externally created optimistic placeholder when regenerate is blocked before submit", async () => {
    const removeOptimisticGenerationPlaceholder = vi.fn();
    const setUiError = vi.fn();
    const regenerateOutput = vi.fn();
    const params = createParams({
      selectedTool: "edit",
      model: "fal-ai/nano-banana-pro/edit",
      isGenerateDisabled: true,
      generationGuardrail: "Select a model before generating.",
      removeOptimisticGenerationPlaceholder,
      setUiError: asDispatch<string | null>(setUiError),
      regenerateOutput,
    });
    const { result } = renderHook(() => useAiStudioGenerationController(params));

    await act(async () => {
      await result.current.handleImageRegenerateWithDebit({
        outputIdOverride: "out-optimistic",
      });
    });

    expect(removeOptimisticGenerationPlaceholder).toHaveBeenCalledWith("out-optimistic");
    expect(regenerateOutput).not.toHaveBeenCalled();
    expect(setUiError).toHaveBeenCalledWith("Select a model before generating.");
  });

  it("prioritizes character-mode submission prompt override while preserving explicit display override", async () => {
    const regenerateOutput = vi.fn();
    const resolveCharacterModeSubmissionOverrides = vi.fn(() => ({
      submissionPromptOverride: "character merged prompt",
      displayPromptOverride: "character display prompt",
      referenceInputsOverride: ["https://example.com/char-ref.png"],
      notice: null,
      fallbackCode: null,
      characterReferenceCount: 1,
      hasCharacterDescription: true,
    }));
    const params = createParams({
      selectedTool: "edit",
      model: "fal-ai/nano-banana-pro/edit",
      isCharacterModeEnabled: true,
      resolveCharacterModeSubmissionOverrides,
      regenerateOutput,
    });
    const { result } = renderHook(() => useAiStudioGenerationController(params));

    await act(async () => {
      await result.current.handleImageRegenerateWithDebit({
        displayPromptOverride: "raw @img1 prompt",
        submissionPromptOverride: "compiled Figure 2 prompt",
      });
    });

    expect(regenerateOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        displayPromptOverride: "raw @img1 prompt",
        submissionPromptOverride: "character merged prompt",
        referenceInputsOverride: ["https://example.com/char-ref.png"],
      })
    );
  });

  it("uses regenerate cost override for credit guardrail checks and optimistic debit", async () => {
    const regenerateOutput = vi.fn();
    const setUiError = vi.fn();
    const setOptimisticDebitEntries = vi.fn();
    const params = createParams({
      selectedTool: "edit",
      model: "fal-ai/nano-banana-pro/edit",
      currentCostCredits: 15,
      effectiveBalanceCredits: 2,
      balanceCredits: 2,
      isGenerateDisabled: true,
      isCreditGuardrail: true,
      generationGuardrail: "You do not have enough credits for this run.",
      refreshBalance: vi.fn(async () => 2),
      regenerateOutput,
      resolveCharacterModeSubmissionOverrides: vi.fn(() => null),
      setUiError: asDispatch<string | null>(setUiError),
      setOptimisticDebitEntries:
        asDispatch<{ credits: number; outputId: string | null }[]>(setOptimisticDebitEntries),
    });
    const { result } = renderHook(() => useAiStudioGenerationController(params));

    await act(async () => {
      await result.current.handleImageRegenerateWithDebit({
        referenceInputsOverride: ["blob:flatten-primary"],
        modelIdOverride: "fal-ai/bria/background/remove",
        costOverrideCredits: 1,
      });
    });

    expect(regenerateOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        modelIdOverride: "fal-ai/bria/background/remove",
        referenceInputsOverride: ["blob:flatten-primary"],
      })
    );
    expect(setUiError).not.toHaveBeenCalled();
    const updater = setOptimisticDebitEntries.mock.calls[0]?.[0] as
      | ((prev: { credits: number; outputId: string | null }[]) => {
          credits: number;
          outputId: string | null;
          createdAtMs?: number;
        }[])
      | undefined;
    expect(typeof updater).toBe("function");
    expect(updater?.([])).toEqual([
      expect.objectContaining({ credits: 1, outputId: null, createdAtMs: expect.any(Number) }),
    ]);
  });

  it("uses resolved model-override cost for inpaint regenerates when explicit cost override is absent", async () => {
    const regenerateOutput = vi.fn();
    const setUiError = vi.fn();
    const setOptimisticDebitEntries = vi.fn();
    const resolveCostCreditsForModel = vi.fn((modelId: string) =>
      modelId === INPAINT_FLUX_FILL_MODEL_ID ? 5 : null
    );
    const params = createParams({
      selectedTool: "edit",
      model: "fal-ai/nano-banana-pro/edit",
      currentCostCredits: 15,
      effectiveBalanceCredits: 2,
      balanceCredits: 2,
      isGenerateDisabled: true,
      isCreditGuardrail: true,
      generationGuardrail: "You do not have enough credits for this run.",
      refreshBalance: vi.fn(async () => 5),
      regenerateOutput,
      resolveCharacterModeSubmissionOverrides: vi.fn(() => null),
      resolveCostCreditsForModel,
      setUiError: asDispatch<string | null>(setUiError),
      setOptimisticDebitEntries:
        asDispatch<{ credits: number; outputId: string | null }[]>(setOptimisticDebitEntries),
    });
    const { result } = renderHook(() => useAiStudioGenerationController(params));

    await act(async () => {
      await result.current.handleImageRegenerateWithDebit({
        modelIdOverride: INPAINT_FLUX_FILL_MODEL_ID,
        inpaintOverride: {
          modelId: INPAINT_FLUX_FILL_MODEL_ID,
          baseImageInput: "https://cdn.test/inpaint-base.png",
          maskInput: "https://cdn.test/inpaint-mask.png",
          outputFormat: "png",
        },
      });
    });

    expect(resolveCostCreditsForModel).toHaveBeenCalledWith(INPAINT_FLUX_FILL_MODEL_ID);
    expect(regenerateOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        modelIdOverride: INPAINT_FLUX_FILL_MODEL_ID,
      })
    );
    expect(setUiError).not.toHaveBeenCalled();
    const updater = setOptimisticDebitEntries.mock.calls[0]?.[0] as
      | ((prev: { credits: number; outputId: string | null }[]) => {
          credits: number;
          outputId: string | null;
          createdAtMs?: number;
        }[])
      | undefined;
    expect(typeof updater).toBe("function");
    expect(updater?.([])).toEqual([
      expect.objectContaining({ credits: 5, outputId: null, createdAtMs: expect.any(Number) }),
    ]);
  });

  it("does not persist selected model when regenerate submit uses explicit modelIdOverride", async () => {
    const regenerateOutput = vi.fn();
    const setModel = vi.fn();
    const params = createParams({
      selectedTool: "edit",
      model: "fal-ai/nano-banana-pro/edit",
      setModel,
      regenerateOutput,
      resolveCharacterModeSubmissionOverrides: vi.fn(() => null),
    });
    const { result } = renderHook(() => useAiStudioGenerationController(params));

    await act(async () => {
      await result.current.handleImageRegenerateWithDebit({
        referenceInputsOverride: ["blob:flatten-primary"],
        modelIdOverride: "fal-ai/bria/background/remove",
        costOverrideCredits: 0,
      });
    });

    expect(setModel).not.toHaveBeenCalled();
    expect(regenerateOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        modelIdOverride: "fal-ai/bria/background/remove",
      })
    );
  });

  it("does not persist selected model when regenerate submit uses inpaint model override", async () => {
    const regenerateOutput = vi.fn();
    const setModel = vi.fn();
    const params = createParams({
      selectedTool: "edit",
      model: "fal-ai/nano-banana-pro/edit",
      setModel,
      regenerateOutput,
      resolveCharacterModeSubmissionOverrides: vi.fn(() => null),
    });
    const { result } = renderHook(() => useAiStudioGenerationController(params));

    await act(async () => {
      await result.current.handleImageRegenerateWithDebit({
        inpaintOverride: {
          modelId: INPAINT_FLUX_FILL_MODEL_ID,
          baseImageInput: "https://cdn.test/inpaint-base.png",
          maskInput: "https://cdn.test/inpaint-mask.png",
          outputFormat: "png",
        },
      });
    });

    expect(setModel).not.toHaveBeenCalled();
    expect(regenerateOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        modelIdOverride: INPAINT_FLUX_FILL_MODEL_ID,
      })
    );
  });

  it("allows regenerate submissions while agent send is in flight", async () => {
    const regenerateOutput = vi.fn();
    const params = createParams({
      regenerateOutput,
    });
    const { result } = renderHook(() => useAiStudioGenerationController(params));

    await act(async () => {
      await result.current.handleRegenerateWithDebit();
    });

    expect(regenerateOutput).toHaveBeenCalledTimes(1);
  });

  it("blocks option-based generate when generation guardrails disable submissions", async () => {
    const generateOutput = vi.fn();
    const setUiError = vi.fn();
    const setOptimisticDebitEntries = vi.fn();
    const params = createParams({
      isGenerateDisabled: true,
      isCreditGuardrail: false,
      generationGuardrail: "Guardrail blocked this run.",
      generateOutput,
      setUiError: asDispatch<string | null>(setUiError),
      setOptimisticDebitEntries:
        asDispatch<{ credits: number; outputId: string | null }[]>(setOptimisticDebitEntries),
    });
    const { result } = renderHook(() => useAiStudioGenerationController(params));

    let generateResult: Awaited<ReturnType<typeof result.current.handleGenerate>> | null = null;
    await act(async () => {
      generateResult = await result.current.handleGenerate("prompt override", {
        costOverrideCredits: 2,
      });
    });

    expect(setUiError).toHaveBeenCalledWith("Guardrail blocked this run.");
    expect(generateOutput).not.toHaveBeenCalled();
    expect(setOptimisticDebitEntries).not.toHaveBeenCalled();
    expect(generateResult).toEqual({ accepted: false, optimisticOutputId: null });
  });

  it("surfaces explicit error and does not submit when create/text tool remains in text mode", async () => {
    const generateOutput = vi.fn();
    const setOptimisticDebitEntries = vi.fn();
    const setUiError = vi.fn();
    const params = createParams({
      mode: "text",
      selectedTool: "create",
      generateOutput,
      setUiError: asDispatch<string | null>(setUiError),
      setOptimisticDebitEntries:
        asDispatch<{ credits: number; outputId: string | null }[]>(setOptimisticDebitEntries),
    });
    const { result } = renderHook(() => useAiStudioGenerationController(params));

    await act(async () => {
      await result.current.handleGenerate("prompt override", { costOverrideCredits: 2 });
    });

    expect(generateOutput).not.toHaveBeenCalled();
    expect(setOptimisticDebitEntries).not.toHaveBeenCalled();
    expect(setUiError).toHaveBeenCalledWith(
      "Switch to image generation before running this action."
    );
  });

  it("blocks create character-mode generate when no character references are available", async () => {
    const setUiError = vi.fn();
    const generateOutput = vi.fn();
    const trackCharacterModeEvent = vi.fn();
    const resolveCharacterModeSubmissionOverrides = vi.fn(() => ({
      submissionPromptOverride: "character + prompt",
      displayPromptOverride: "user prompt",
      referenceInputsOverride: [],
      notice: null,
      fallbackCode: "no_references",
      characterReferenceCount: 0,
      hasCharacterDescription: true,
    }));
    const params = createParams({
      setUiError: asDispatch<string | null>(setUiError),
      generateOutput,
      trackCharacterModeEvent,
      resolveCharacterModeSubmissionOverrides,
    });
    const { result } = renderHook(() => useAiStudioGenerationController(params));

    await act(async () => {
      await result.current.handleGenerate("user prompt");
    });

    expect(generateOutput).not.toHaveBeenCalled();
    expect(setUiError).toHaveBeenCalledWith(
      "Character Mode requires at least one character image before generating."
    );
    expect(trackCharacterModeEvent).toHaveBeenCalledWith(
      "character_mode_submit_blocked_no_references",
      expect.objectContaining({ fallback_code: "no_references", tool: "create" })
    );
  });

  it("keeps edit regenerate routed to the edit lane even when character overrides have no references", async () => {
    const setUiError = vi.fn();
    const regenerateOutput = vi.fn();
    const trackCharacterModeEvent = vi.fn();
    const resolveCharacterModeSubmissionOverrides = vi.fn(() => ({
      submissionPromptOverride: "character + prompt",
      displayPromptOverride: "user prompt",
      referenceInputsOverride: [],
      notice: null,
      fallbackCode: "no_references",
      characterReferenceCount: 0,
      hasCharacterDescription: true,
    }));
    const params = createParams({
      setUiError: asDispatch<string | null>(setUiError),
      regenerateOutput,
      trackCharacterModeEvent,
      resolveCharacterModeSubmissionOverrides,
    });
    const { result } = renderHook(() => useAiStudioGenerationController(params));

    await act(async () => {
      await result.current.handleImageRegenerateWithDebit();
    });

    expect(regenerateOutput).toHaveBeenCalledWith({
      selectedToolOverride: "edit",
      modelIdOverride: "fal-ai/bytedance/seedream/v4.5/text-to-image",
      submissionPromptOverride: "character + prompt",
      displayPromptOverride: "user prompt",
      referenceInputsOverride: [],
    });
    expect(setUiError).not.toHaveBeenCalled();
    expect(trackCharacterModeEvent).not.toHaveBeenCalledWith(
      "character_mode_submit_blocked_no_references",
      expect.anything()
    );
  });

  it("blocks create character-mode generate when no character is selected", async () => {
    const setUiError = vi.fn();
    const generateOutput = vi.fn();
    const trackCharacterModeEvent = vi.fn();
    const resolveCharacterModeSubmissionOverrides = vi.fn(() => ({
      submissionPromptOverride: "character + prompt",
      displayPromptOverride: "user prompt",
      referenceInputsOverride: [],
      notice: null,
      fallbackCode: "no_character_selected",
      characterReferenceCount: 0,
      hasCharacterDescription: false,
    }));
    const params = createParams({
      setUiError: asDispatch<string | null>(setUiError),
      generateOutput,
      trackCharacterModeEvent,
      resolveCharacterModeSubmissionOverrides,
    });
    const { result } = renderHook(() => useAiStudioGenerationController(params));

    await act(async () => {
      await result.current.handleGenerate("user prompt");
    });

    expect(generateOutput).not.toHaveBeenCalled();
    expect(setUiError).toHaveBeenCalledWith(
      "Character Mode requires at least one character image before generating."
    );
    expect(trackCharacterModeEvent).toHaveBeenCalledWith(
      "character_mode_submit_blocked_no_references",
      expect.objectContaining({ fallback_code: "no_character_selected", tool: "create" })
    );
  });

  it("coerces create character-mode submissions to paired edit model at submit-time", async () => {
    const setModel = vi.fn();
    const generateOutput = vi.fn();
    const trackCharacterModeEvent = vi.fn();
    const params = createParams({
      model: "fal-ai/nano-banana-pro",
      setModel,
      isCharacterModeEnabled: true,
      generateOutput,
      trackCharacterModeEvent,
      resolveCharacterModeSubmissionOverrides: vi.fn(() => ({
        submissionPromptOverride: "character + prompt",
        displayPromptOverride: "user prompt",
        referenceInputsOverride: ["https://example.com/char-ref.png"],
        notice: null,
        fallbackCode: null,
        characterReferenceCount: 1,
        hasCharacterDescription: true,
      })),
    });
    const { result } = renderHook(() => useAiStudioGenerationController(params));

    await act(async () => {
      await result.current.handleGenerate("user prompt");
    });

    expect(setModel).toHaveBeenCalledWith("fal-ai/nano-banana-pro/edit");
    expect(trackCharacterModeEvent).toHaveBeenCalledWith(
      "character_mode_submit_invariant_coerced",
      expect.objectContaining({
        trigger: "generate",
        from_model_id: "fal-ai/nano-banana-pro",
        to_model_id: "fal-ai/nano-banana-pro/edit",
      })
    );
    expect(generateOutput).toHaveBeenCalledWith(
      "user prompt",
      expect.objectContaining({ modelIdOverride: "fal-ai/nano-banana-pro/edit" })
    );
  });

  it("passes user-selected edit references into character mode override resolution", async () => {
    const resolveCharacterModeSubmissionOverrides = vi.fn(() => null);
    const resolveReferenceInputsForTool = vi.fn(() => ({
      referenceImageUrl: "https://example.com/primary.png",
      extraImageUrls: [
        "https://example.com/extra-1.png",
        "https://example.com/extra-2.png",
        null,
      ] as [string | null, string | null, string | null],
    }));
    const params = createParams({
      mode: "image",
      selectedTool: "edit",
      model: "fal-ai/nano-banana/edit",
      isCharacterModeEnabled: true,
      resolveCharacterModeSubmissionOverrides,
      resolveReferenceInputsForTool,
    });
    const { result } = renderHook(() => useAiStudioGenerationController(params));

    await act(async () => {
      await result.current.handleGenerate("user prompt");
    });

    expect(resolveCharacterModeSubmissionOverrides).toHaveBeenCalledWith(
      "user prompt",
      "edit",
      null,
      [
        "https://example.com/primary.png",
        "https://example.com/extra-1.png",
        "https://example.com/extra-2.png",
      ]
    );
  });
});
