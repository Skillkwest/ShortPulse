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
  prompt: "",
  agentInput: "",
  agentBusy: false,
  currentCostCredits: 3,
  isGenerateDisabled: false,
  isCreditGuardrail: false,
  generationGuardrail: null,
  effectiveBalanceCredits: 100,
  balanceCredits: 100,
  optimisticDebitTotal: 0,
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

    expect(refreshBalance).toHaveBeenCalledWith({ silent: true });
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
        }[])
      | undefined;
    expect(typeof updater).toBe("function");
    expect(updater?.([])).toEqual([{ credits: 7, outputId: null }]);
  });
});
