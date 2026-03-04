import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Dispatch, SetStateAction } from "react";
import type { StudioOutput } from "../../types";
import { useAiStudioGenerationController } from "../useAiStudioGenerationController";

const asDispatch = <T>(fn: (...args: unknown[]) => unknown): Dispatch<SetStateAction<T>> =>
  fn as unknown as Dispatch<SetStateAction<T>>;

const createParams = (
  overrides: Partial<Parameters<typeof useAiStudioGenerationController>[0]> = {}
): Parameters<typeof useAiStudioGenerationController>[0] => ({
  mode: "image",
  selectedTool: "create",
  model: "fal-ai/bytedance/seedream/v4.5/text-to-image",
  setModel: vi.fn(),
  isCharacterModeEnabled: false,
  prompt: "",
  agentInput: "",
  agentBusy: false,
  chatModeEnabled: true,
  currentCostCredits: 3,
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
  trackCharacterModeFallback: vi.fn(),
  generateOutput: vi.fn(),
  regenerateOutput: vi.fn(),
  ...overrides,
});

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

  it("routes primary text create submit directly to generate when chat mode is off", async () => {
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
      chatModeEnabled: false,
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
      expect.objectContaining({ modeOverride: "image", selectedToolOverride: "create" })
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
      chatModeEnabled: false,
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
      expect.objectContaining({ modeOverride: "image", selectedToolOverride: "create" })
    );
  });

  it("uses chat-off inline generate to submit trimmed raw input only", async () => {
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
      chatModeEnabled: false,
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
      expect.objectContaining({ modeOverride: "image", selectedToolOverride: "create" })
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
      chatModeEnabled: false,
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
      expect.objectContaining({ modeOverride: "image", selectedToolOverride: "create" })
    );
  });

  it("shows explicit error when chat-off inline generate has no prompt input", async () => {
    const setUiError = vi.fn();
    const generateOutput = vi.fn();
    const params = createParams({
      mode: "text",
      selectedTool: "create",
      prompt: "   ",
      agentInput: "   ",
      chatModeEnabled: false,
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

  it("prevents rapid double-generate submissions via click lock", async () => {
    const generateOutput = vi.fn();
    const params = createParams({
      generateOutput,
    });
    const { result } = renderHook(() => useAiStudioGenerationController(params));

    await act(async () => {
      await Promise.all([
        result.current.handleGenerate("prompt"),
        result.current.handleGenerate("prompt"),
      ]);
    });

    expect(generateOutput).toHaveBeenCalledTimes(1);
  });

  it("allows generate submissions while agent send is in flight", async () => {
    const generateOutput = vi.fn();
    const params = createParams({
      agentBusy: true,
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
        await pending;
      });

      expect(removeOptimisticGenerationPlaceholder).toHaveBeenCalledWith("out-optimistic");
      expect(setUiError).toHaveBeenCalledWith(
        "Preparation timed out before generation started. Please retry."
      );
      expect(generateOutput).not.toHaveBeenCalled();
      expect(trackCharacterModeEvent).toHaveBeenCalledWith(
        "generation_preflight_timeout",
        expect.objectContaining({ trigger: "generate", reason_code: "PREFLIGHT_TIMEOUT" })
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

    expect(resolveDefaultPromptForTool).toHaveBeenCalledWith("create");
    expect(refreshCharacterModeInjectionBundleForSubmission).toHaveBeenCalledWith("create");
    expect(regenerateOutput).toHaveBeenCalledWith({
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

  it("allows regenerate submissions while agent send is in flight", async () => {
    const regenerateOutput = vi.fn();
    const params = createParams({
      agentBusy: true,
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

  it("blocks character-mode regenerate when no character references are available", async () => {
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
      await result.current.handleRegenerateWithDebit();
    });

    expect(regenerateOutput).not.toHaveBeenCalled();
    expect(setUiError).toHaveBeenCalledWith(
      "Character Mode requires at least one character image before generating."
    );
    expect(trackCharacterModeEvent).toHaveBeenCalledWith(
      "character_mode_submit_blocked_no_references",
      expect.objectContaining({ fallback_code: "no_references", tool: "create" })
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
});
