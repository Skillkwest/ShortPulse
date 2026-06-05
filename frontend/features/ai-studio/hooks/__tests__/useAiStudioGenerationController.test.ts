import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Dispatch, SetStateAction } from "react";
import { createInternalMediaRef } from "../../../../lib/media/internalMediaRefs";
import { OPENAI_GPT_IMAGE_2_MODEL_ID } from "../../../../lib/model-runtime/openAiImage2";
import type { StudioOutput } from "../../types";
import {
  CHARACTER_MODE_MISSING_REFERENCES_ERROR,
  GENERATION_GUARDRAIL_FALLBACK_ERROR,
} from "../../logic/generationStartPolicy";
import { BRIA_BACKGROUND_REMOVE_MODEL_ID } from "../../logic/editPromptPolicy";
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
    currentCostCredits: 3,
    resolveCostCreditsForModel: vi.fn(() => null),
    isGenerateDisabled: false,
    isCreditGuardrail: false,
    generationGuardrail: null,
    balanceCredits: 100,
    setUiError: asDispatch<string | null>(vi.fn()),
    setUiNotice: asDispatch<string | null>(vi.fn()),
    setOptimisticDebitEntries: asDispatch<{ credits: number; outputId: string | null }[]>(vi.fn()),
    refreshBalance: vi.fn(async () => 100),
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
  };
};

describe("useAiStudioGenerationController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes provider generation without owning Create primary submit routing", async () => {
    const generateOutput = vi.fn();
    const params = createParams({
      selectedTool: "create",
      generateOutput,
    });
    const { result } = renderHook(() => useAiStudioGenerationController(params));

    await act(async () => {
      await result.current.handleGenerate();
    });

    expect(generateOutput).toHaveBeenCalledWith(
      "default prompt",
      expect.objectContaining({
        modeOverride: "image",
        selectedToolOverride: "create",
      })
    );
  });

  it("leaves create submit locking to the higher-level create entry hooks", async () => {
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

  it("allows Pulse-owned generate paths to ignore generic page guardrails", async () => {
    const generateOutput = vi.fn();
    const params = createParams({
      generateOutput,
      isGenerateDisabled: true,
      generationGuardrail: "Add a reference image before generating.",
    });
    const { result } = renderHook(() => useAiStudioGenerationController(params));

    let generateResult: Awaited<ReturnType<typeof result.current.handleGenerate>> | null = null;
    await act(async () => {
      generateResult = await result.current.handleGenerate("pulse prompt", {
        ignoreGenerationGuardrail: true,
      });
    });

    expect(generateResult).toEqual({ accepted: true, optimisticOutputId: null });
    expect(generateOutput).toHaveBeenCalledWith(
      "pulse prompt",
      expect.objectContaining({ ignoreGenerationGuardrail: true })
    );
  });

  it("skips character preparation when generate explicitly suppresses Character Mode", async () => {
    const generateOutput = vi.fn();
    const refreshCharacterModeInjectionBundleForSubmission = vi.fn(async () => ({
      characterId: "char-1",
    }));
    const resolveCharacterModeSubmissionOverrides = vi.fn(() => ({
      submissionPromptOverride: "submission",
      displayPromptOverride: "display",
      referenceInputsOverride: ["https://example.com/char.png"],
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
    const setUiNotice = vi.fn();
    const params = createParams({
      generateOutput,
      isCharacterModeEnabled: true,
      resolveIsCharacterModeEnabledForTool: vi.fn(() => true),
      resolveSelectedCharacterIdForTool: vi.fn(() => "char-1"),
      refreshCharacterModeInjectionBundleForSubmission,
      resolveCharacterModeSubmissionOverrides,
      setUiNotice: asDispatch<string | null>(setUiNotice),
    });
    const { result } = renderHook(() => useAiStudioGenerationController(params));

    await act(async () => {
      await result.current.handleGenerate("pulse prompt", {
        suppressCharacter: true,
      });
    });

    expect(refreshCharacterModeInjectionBundleForSubmission).not.toHaveBeenCalled();
    expect(resolveCharacterModeSubmissionOverrides).not.toHaveBeenCalled();
    expect(setUiNotice).not.toHaveBeenCalled();
    expect(generateOutput).toHaveBeenCalledWith(
      "pulse prompt",
      expect.objectContaining({
        suppressCharacter: true,
      })
    );
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
      submissionModeOverride: "provider-task",
    });
    expect(generateOutput).toHaveBeenCalledWith(
      "prompt",
      expect.objectContaining({ outputIdOverride: "out-optimistic" })
    );
    expect(generateResult).toEqual({ accepted: true, optimisticOutputId: "out-optimistic" });
  });

  it("marks gpt-image-2 optimistic placeholders as direct-request submissions", async () => {
    const insertOptimisticGenerationPlaceholder = vi.fn(() => "out-openai");
    const generateOutput = vi.fn();
    const params = createParams({
      model: OPENAI_GPT_IMAGE_2_MODEL_ID,
      generateOutput,
      insertOptimisticGenerationPlaceholder,
    });
    const { result } = renderHook(() => useAiStudioGenerationController(params));

    await act(async () => {
      await result.current.handleGenerate("prompt");
    });

    expect(insertOptimisticGenerationPlaceholder).toHaveBeenCalledWith({
      prompt: "prompt",
      modeOverride: "image",
      selectedToolOverride: "create",
      submissionModeOverride: "direct-request",
    });
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

  it("times out unresolved preflight refresh before generating", async () => {
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

      let generatePromise!: ReturnType<typeof result.current.handleGenerate>;
      await act(async () => {
        generatePromise = result.current.handleGenerate("prompt");
        await Promise.resolve();
      });

      let generateResult: Awaited<ReturnType<typeof result.current.handleGenerate>> | null = null;
      await act(async () => {
        vi.advanceTimersByTime(10_000);
        generateResult = await generatePromise;
      });

      expect(removeOptimisticGenerationPlaceholder).toHaveBeenCalledWith("out-optimistic");
      expect(setUiError).toHaveBeenCalledWith(
        "Preparation timed out before generation started. Please retry."
      );
      expect(generateOutput).not.toHaveBeenCalled();
      expect(generateResult).toEqual({ accepted: false, optimisticOutputId: null });
      expect(trackCharacterModeEvent).toHaveBeenCalledWith(
        "generation_preflight_timeout",
        expect.objectContaining({ trigger: "generate", reason_code: "PREFLIGHT_TIMEOUT" })
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not block generate when override cost cannot be covered after refresh", async () => {
    const setUiError = vi.fn();
    const refreshBalance = vi.fn(async () => 1);
    const generateOutput = vi.fn();
    const params = createParams({
      balanceCredits: 1,
      refreshBalance,
      setUiError: asDispatch<string | null>(setUiError),
      generateOutput,
    });
    const { result } = renderHook(() => useAiStudioGenerationController(params));

    await act(async () => {
      await result.current.handleGenerate("prompt", { costOverrideCredits: 5 });
    });

    expect(refreshBalance).not.toHaveBeenCalled();
    expect(setUiError).not.toHaveBeenCalledWith("You do not have enough credits for this run.");
    expect(generateOutput).toHaveBeenCalledTimes(1);
  });

  it("blocks generate when disabled without a visible guardrail message", async () => {
    const setUiError = vi.fn();
    const generateOutput = vi.fn();
    const params = createParams({
      isGenerateDisabled: true,
      isCreditGuardrail: false,
      generationGuardrail: null,
      setUiError: asDispatch<string | null>(setUiError),
      generateOutput,
    });
    const { result } = renderHook(() => useAiStudioGenerationController(params));

    let generateResult: Awaited<ReturnType<typeof result.current.handleGenerate>> | null = null;
    await act(async () => {
      generateResult = await result.current.handleGenerate("prompt");
    });

    expect(generateResult).toEqual({ accepted: false, optimisticOutputId: null });
    expect(setUiError).toHaveBeenCalledWith(GENERATION_GUARDRAIL_FALLBACK_ERROR);
    expect(generateOutput).not.toHaveBeenCalled();
  });

  it("does not self-throttle generate when current balance already covers the run", async () => {
    const setUiError = vi.fn();
    const refreshBalance = vi.fn(async () => 6);
    const generateOutput = vi.fn();
    const params = createParams({
      balanceCredits: 6,
      refreshBalance,
      setUiError: asDispatch<string | null>(setUiError),
      generateOutput,
    });
    const { result } = renderHook(() => useAiStudioGenerationController(params));

    await act(async () => {
      await result.current.handleGenerate("prompt", { costOverrideCredits: 5 });
    });

    expect(refreshBalance).not.toHaveBeenCalled();
    expect(setUiError).not.toHaveBeenCalledWith("You do not have enough credits for this run.");
    expect(generateOutput).toHaveBeenCalledTimes(1);
  });

  it("does not refresh balance for generate guardrail checks once credit locking is removed", async () => {
    const setUiError = vi.fn();
    const generateOutput = vi.fn();
    const refreshBalance = vi.fn(async () => 6);
    const params = createParams({
      balanceCredits: 4,
      refreshBalance,
      setUiError: asDispatch<string | null>(setUiError),
      generateOutput,
    });
    const { result } = renderHook(() => useAiStudioGenerationController(params));

    await act(async () => {
      await result.current.handleGenerate("prompt", { costOverrideCredits: 5 });
    });

    expect(refreshBalance).not.toHaveBeenCalled();
    expect(setUiError).not.toHaveBeenCalledWith("You do not have enough credits for this run.");
    expect(generateOutput).toHaveBeenCalledTimes(1);
  });

  it("does not reapply optimistic hold subtraction when refresh falls back to local balance", async () => {
    const setUiError = vi.fn();
    const generateOutput = vi.fn();
    const refreshBalance = vi.fn(async () => null);
    const params = createParams({
      balanceCredits: 6,
      refreshBalance,
      setUiError: asDispatch<string | null>(setUiError),
      generateOutput,
    });
    const { result } = renderHook(() => useAiStudioGenerationController(params));

    await act(async () => {
      await result.current.handleGenerate("prompt", { costOverrideCredits: 5 });
    });

    expect(refreshBalance).not.toHaveBeenCalled();
    expect(setUiError).not.toHaveBeenCalledWith("You do not have enough credits for this run.");
    expect(generateOutput).toHaveBeenCalledTimes(1);
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
    expect(regenerateOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedToolOverride: "video",
        modelIdOverride: "fal-ai/bytedance/seedream/v4.5/text-to-image",
        submissionPromptOverride: "submission",
        displayPromptOverride: "display",
        referenceInputsOverride: ["https://example.com/ref.png"],
        displayedBilledCredits: 7,
        characterContextOverride: {
          applied: true,
          characterId: "char-1",
          characterName: "A",
          characterProfileImageUrl: null,
        },
      })
    );
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

  it("preserves duplicate derived edit references during regenerate preflight", async () => {
    const regenerateOutput = vi.fn();
    const resolveCharacterModeSubmissionOverrides = vi.fn(() => null);
    const params = createParams({
      selectedTool: "edit",
      model: "fal-ai/bytedance/seedream/v5/lite/edit",
      regenerateOutput,
      resolveCharacterModeSubmissionOverrides,
      resolveReferenceInputsForTool: vi.fn(() => ({
        referenceImageUrl: "https://example.com/shared.png",
        extraImageUrls: [
          "https://example.com/shared.png",
          null,
          "https://example.com/shared.png",
        ] as [string | null, string | null, string | null],
      })),
    });
    const { result } = renderHook(() => useAiStudioGenerationController(params));

    await act(async () => {
      await result.current.handleImageRegenerateWithDebit();
    });

    expect(resolveCharacterModeSubmissionOverrides).toHaveBeenCalledWith(
      "default prompt",
      "edit",
      null,
      [
        "https://example.com/shared.png",
        "https://example.com/shared.png",
        "https://example.com/shared.png",
      ]
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
      referenceInputsOverride: [],
      internalMediaRefsOverride: [
        createInternalMediaRef({ storagePath: "user/chars/char-ref.png" }),
      ],
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
        referenceInputsOverride: [],
        internalMediaRefsOverride: [
          {
            version: 1,
            kind: "storage_object",
            bucket: "media_library",
            storagePath: "user/chars/char-ref.png",
          },
        ],
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

  it("uses resolved model-override cost for remove background regenerates when explicit cost override is absent", async () => {
    const regenerateOutput = vi.fn();
    const resolveCostCreditsForModel = vi.fn((modelId: string) =>
      modelId === BRIA_BACKGROUND_REMOVE_MODEL_ID ? 4 : null
    );
    const params = createParams({
      selectedTool: "edit",
      model: "fal-ai/nano-banana-pro/edit",
      currentCostCredits: 15,
      balanceCredits: 4,
      isGenerateDisabled: true,
      isCreditGuardrail: true,
      generationGuardrail: "You do not have enough credits for this run.",
      refreshBalance: vi.fn(async () => 4),
      regenerateOutput,
      resolveCharacterModeSubmissionOverrides: vi.fn(() => null),
      resolveCostCreditsForModel,
    });
    const { result } = renderHook(() => useAiStudioGenerationController(params));

    await act(async () => {
      await result.current.handleImageRegenerateWithDebit({
        modelIdOverride: BRIA_BACKGROUND_REMOVE_MODEL_ID,
        referenceInputsOverride: ["blob:layer-remove-background"],
        referenceInputsMode: "replace",
      });
    });

    expect(resolveCostCreditsForModel).toHaveBeenCalledWith(BRIA_BACKGROUND_REMOVE_MODEL_ID);
    expect(regenerateOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        modelIdOverride: BRIA_BACKGROUND_REMOVE_MODEL_ID,
        displayedBilledCredits: 4,
        referenceInputsOverride: ["blob:layer-remove-background"],
        referenceInputsMode: "replace",
      })
    );
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
    expect(setUiError).toHaveBeenCalledWith(CHARACTER_MODE_MISSING_REFERENCES_ERROR);
    expect(trackCharacterModeEvent).toHaveBeenCalledWith(
      "character_mode_submit_blocked_no_references",
      expect.objectContaining({
        fallback_code: "no_references",
        character_reference_count: 0,
      })
    );
  });

  it("blocks create character-mode generate when the selected bundle cannot be loaded", async () => {
    const setUiError = vi.fn();
    const generateOutput = vi.fn();
    const trackCharacterModeEvent = vi.fn();
    const trackCharacterModeFallback = vi.fn();
    const resolveCharacterModeSubmissionOverrides = vi.fn(() => ({
      submissionPromptOverride: "user prompt",
      displayPromptOverride: "user prompt",
      referenceInputsOverride: [],
      notice: null,
      fallbackCode: "bundle_unavailable",
      characterReferenceCount: 0,
      hasCharacterDescription: false,
    }));
    const params = createParams({
      setUiError: asDispatch<string | null>(setUiError),
      generateOutput,
      trackCharacterModeEvent,
      trackCharacterModeFallback,
      resolveCharacterModeSubmissionOverrides,
    });
    const { result } = renderHook(() => useAiStudioGenerationController(params));

    await act(async () => {
      await result.current.handleGenerate("user prompt");
    });

    expect(generateOutput).not.toHaveBeenCalled();
    expect(trackCharacterModeFallback).toHaveBeenCalledWith(
      expect.objectContaining({ fallbackCode: "bundle_unavailable" }),
      "create"
    );
    expect(setUiError).toHaveBeenCalledWith(
      "Selected character context could not be loaded. Please reselect the character and retry."
    );
    expect(trackCharacterModeEvent).toHaveBeenCalledWith(
      "character_mode_submit_blocked_fallback",
      expect.objectContaining({
        fallback_code: "bundle_unavailable",
        character_reference_count: 0,
      })
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

    expect(regenerateOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedToolOverride: "edit",
        modelIdOverride: "fal-ai/bytedance/seedream/v4.5/text-to-image",
        submissionPromptOverride: "character + prompt",
        displayPromptOverride: "user prompt",
        referenceInputsOverride: [],
        displayedBilledCredits: 3,
      })
    );
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
    expect(setUiError).toHaveBeenCalledWith(CHARACTER_MODE_MISSING_REFERENCES_ERROR);
    expect(trackCharacterModeEvent).toHaveBeenCalledWith(
      "character_mode_submit_blocked_no_references",
      expect.objectContaining({
        fallback_code: "no_character_selected",
        character_reference_count: 0,
      })
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
      model: "fal-ai/nano-banana-2/edit",
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

  it("passes the refreshed character bundle into create override resolution before submit", async () => {
    const refreshedBundle = { characterId: "char-1", referenceCount: 1 };
    const refreshCharacterModeInjectionBundleForSubmission = vi.fn(async () => refreshedBundle);
    const resolveCharacterModeSubmissionOverrides = vi.fn(() => ({
      submissionPromptOverride: "character + prompt",
      displayPromptOverride: "user prompt",
      referenceInputsOverride: [],
      internalMediaRefsOverride: [
        createInternalMediaRef({ storagePath: "user/chars/fresh-char-ref.png" }),
      ],
      notice: null,
      fallbackCode: null,
      characterReferenceCount: 1,
      hasCharacterDescription: true,
    }));
    const generateOutput = vi.fn();
    const params = createParams({
      isCharacterModeEnabled: true,
      refreshCharacterModeInjectionBundleForSubmission,
      resolveCharacterModeSubmissionOverrides,
      generateOutput,
    });
    const { result } = renderHook(() => useAiStudioGenerationController(params));

    await act(async () => {
      await result.current.handleGenerate("user prompt");
    });

    expect(refreshCharacterModeInjectionBundleForSubmission).toHaveBeenCalledWith("create");
    expect(resolveCharacterModeSubmissionOverrides).toHaveBeenCalledWith(
      "user prompt",
      "create",
      refreshedBundle,
      []
    );
    expect(generateOutput).toHaveBeenCalledWith(
      "user prompt",
      expect.objectContaining({
        referenceInputsOverride: [],
        internalMediaRefsOverride: [
          {
            version: 1,
            kind: "storage_object",
            bucket: "media_library",
            storagePath: "user/chars/fresh-char-ref.png",
          },
        ],
      })
    );
  });
});
