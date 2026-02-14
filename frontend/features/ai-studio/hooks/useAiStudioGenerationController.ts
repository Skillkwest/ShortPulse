/**
 * AI Studio generation controller hook.
 * Owns generate click-lock and submission/regeneration orchestration while preserving page behavior.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { StudioMode, StudioOutput, ToolId } from "../types";

type CharacterModeFallbackSummary<TFallbackCode extends string> = {
  fallbackCode: TFallbackCode | null;
  characterReferenceCount: number;
  hasCharacterDescription: boolean;
} | null;

type CharacterModeSubmissionOverrides<TFallbackCode extends string> = {
  submissionPromptOverride: string;
  displayPromptOverride: string;
  referenceInputsOverride: string[];
  characterContextOverride?: StudioOutput["characterContext"];
  notice: string | null;
  fallbackCode: TFallbackCode | null;
  characterReferenceCount: number;
  hasCharacterDescription: boolean;
} | null;

type GenerateOptions = {
  modeOverride?: StudioMode;
  toolOverride?: ToolId | null;
  costOverrideCredits?: number | null;
};

type UseAiStudioGenerationControllerParams<TBundle, TFallbackCode extends string> = {
  mode: StudioMode;
  selectedTool: ToolId | null;
  prompt: string;
  agentInput: string;
  agentBusy: boolean;
  currentCostCredits: number | null;
  isGenerateDisabled: boolean;
  isCreditGuardrail: boolean;
  generationGuardrail: string | null;
  effectiveBalanceCredits: number | null;
  balanceCredits: number | null;
  optimisticDebitTotal: number;
  setUiError: Dispatch<SetStateAction<string | null>>;
  setUiNotice: Dispatch<SetStateAction<string | null>>;
  setPromptOrigin: Dispatch<SetStateAction<"manual" | "agent" | "reference">>;
  setOptimisticDebitEntries: Dispatch<
    SetStateAction<{ credits: number; outputId: string | null }[]>
  >;
  refreshBalance: (options?: {
    silent?: boolean;
    preferLedger?: boolean;
  }) => Promise<number | null>;
  handleAgentSend: (
    textOverride?: string,
    options?: {
      captureResult?: boolean;
      selectedOverride?: StudioOutput | null;
      modeHint?: "chat" | "text" | "describe" | "reference";
    }
  ) => Promise<{ prompt: string; referenceTitle?: string | null } | void>;
  addAgentPromptReference: (promptText: string, title?: string) => void;
  resolveDefaultPromptForTool: (tool: ToolId | null) => string;
  refreshCharacterModeInjectionBundleForSubmission: (
    tool: ToolId | null
  ) => Promise<TBundle | null>;
  resolveCharacterModeSubmissionOverrides: (
    userPrompt: string,
    tool: ToolId | null,
    bundleOverride?: TBundle | null
  ) => CharacterModeSubmissionOverrides<TFallbackCode>;
  trackCharacterModeFallback: (
    overrides: CharacterModeFallbackSummary<TFallbackCode>,
    tool: ToolId | null
  ) => void;
  generateOutput: (
    promptOverride?: string | null,
    options?: {
      modeOverride?: StudioMode;
      selectedToolOverride?: ToolId | null;
      submissionPromptOverride?: string | null;
      displayPromptOverride?: string | null;
      referenceInputsOverride?: string[];
      characterContextOverride?: StudioOutput["characterContext"];
    }
  ) => void;
  regenerateOutput: (options?: {
    submissionPromptOverride?: string | null;
    displayPromptOverride?: string | null;
    referenceInputsOverride?: string[];
    characterContextOverride?: StudioOutput["characterContext"];
  }) => void;
};

const GENERATE_CLICK_COOLDOWN_MS = 700;

/**
 * Returns stable generation action handlers and click-lock state for AI Studio orchestration.
 */
export const useAiStudioGenerationController = <TBundle, TFallbackCode extends string>({
  mode,
  selectedTool,
  prompt,
  agentInput,
  agentBusy,
  currentCostCredits,
  isGenerateDisabled,
  isCreditGuardrail,
  generationGuardrail,
  effectiveBalanceCredits,
  balanceCredits,
  optimisticDebitTotal,
  setUiError,
  setUiNotice,
  setPromptOrigin,
  setOptimisticDebitEntries,
  refreshBalance,
  handleAgentSend,
  addAgentPromptReference,
  resolveDefaultPromptForTool,
  refreshCharacterModeInjectionBundleForSubmission,
  resolveCharacterModeSubmissionOverrides,
  trackCharacterModeFallback,
  generateOutput,
  regenerateOutput,
}: UseAiStudioGenerationControllerParams<TBundle, TFallbackCode>) => {
  const generateClickLockUntilRef = useRef(0);
  const generateClickLockTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const [isGenerateClickLocked, setIsGenerateClickLocked] = useState(false);

  const tryAcquireGenerateClickLock = useCallback(() => {
    const now = Date.now();
    if (now < generateClickLockUntilRef.current) {
      return false;
    }

    generateClickLockUntilRef.current = now + GENERATE_CLICK_COOLDOWN_MS;
    setIsGenerateClickLocked(true);

    if (generateClickLockTimerRef.current) {
      globalThis.clearTimeout(generateClickLockTimerRef.current);
    }
    generateClickLockTimerRef.current = globalThis.setTimeout(() => {
      setIsGenerateClickLocked(false);
      generateClickLockTimerRef.current = null;
      if (Date.now() >= generateClickLockUntilRef.current) {
        generateClickLockUntilRef.current = 0;
      }
    }, GENERATE_CLICK_COOLDOWN_MS);

    return true;
  }, []);

  useEffect(() => {
    return () => {
      if (generateClickLockTimerRef.current) {
        globalThis.clearTimeout(generateClickLockTimerRef.current);
      }
    };
  }, []);

  const handleBlockedGeneration = useCallback(() => {
    if (generationGuardrail) {
      setUiError(generationGuardrail);
    }
  }, [generationGuardrail, setUiError]);

  const ensureFreshCreditsForRun = useCallback(
    async (requiredCredits: number | null | undefined): Promise<boolean> => {
      if (requiredCredits == null) return true;
      const latestBalance = await refreshBalance({ silent: true });
      const resolvedBalance = latestBalance ?? balanceCredits;
      if (resolvedBalance == null) return true;
      const adjustedBalance = Math.max(0, resolvedBalance - optimisticDebitTotal);
      return adjustedBalance >= requiredCredits;
    },
    [balanceCredits, optimisticDebitTotal, refreshBalance]
  );

  const enqueueOptimisticDebit = useCallback(
    (credits: number | null | undefined) => {
      if (credits == null || credits <= 0) return;
      setOptimisticDebitEntries((prev) => [
        ...prev,
        {
          credits,
          outputId: null,
        },
      ]);
    },
    [setOptimisticDebitEntries]
  );

  const handleGenerate = useCallback(
    async (promptOverride?: string | null, options?: GenerateOptions) => {
      if (!tryAcquireGenerateClickLock()) return;

      const effectiveMode = options?.modeOverride ?? mode;
      const effectiveTool = options?.toolOverride ?? selectedTool;
      const requiredCredits = options?.costOverrideCredits ?? currentCostCredits;

      if (
        options?.costOverrideCredits != null &&
        effectiveBalanceCredits != null &&
        effectiveBalanceCredits < options.costOverrideCredits
      ) {
        const hasFreshCredits = await ensureFreshCreditsForRun(options.costOverrideCredits);
        if (!hasFreshCredits) {
          setUiError("You do not have enough credits for this run.");
          return;
        }
      }

      if (!options && isGenerateDisabled) {
        if (isCreditGuardrail) {
          const hasFreshCredits = await ensureFreshCreditsForRun(requiredCredits);
          if (!hasFreshCredits) {
            handleBlockedGeneration();
            return;
          }
        } else {
          handleBlockedGeneration();
          return;
        }
      }

      const defaultPromptForTool = resolveDefaultPromptForTool(effectiveTool);
      const promptToUse =
        typeof promptOverride === "string" ? promptOverride : defaultPromptForTool;
      const characterModeBundleForSubmit =
        await refreshCharacterModeInjectionBundleForSubmission(effectiveTool);
      const characterModeOverrides = resolveCharacterModeSubmissionOverrides(
        promptToUse,
        effectiveTool,
        characterModeBundleForSubmit
      );
      trackCharacterModeFallback(characterModeOverrides, effectiveTool);
      enqueueOptimisticDebit(requiredCredits);
      generateOutput(promptToUse, {
        modeOverride: effectiveMode,
        selectedToolOverride: effectiveTool,
        submissionPromptOverride: characterModeOverrides?.submissionPromptOverride,
        displayPromptOverride: characterModeOverrides?.displayPromptOverride,
        referenceInputsOverride: characterModeOverrides?.referenceInputsOverride,
        ...(characterModeOverrides?.characterContextOverride
          ? { characterContextOverride: characterModeOverrides.characterContextOverride }
          : {}),
      });
      if (characterModeOverrides?.notice) {
        setUiNotice(characterModeOverrides.notice);
      }
    },
    [
      currentCostCredits,
      effectiveBalanceCredits,
      enqueueOptimisticDebit,
      ensureFreshCreditsForRun,
      generateOutput,
      handleBlockedGeneration,
      isCreditGuardrail,
      isGenerateDisabled,
      mode,
      refreshCharacterModeInjectionBundleForSubmission,
      resolveCharacterModeSubmissionOverrides,
      resolveDefaultPromptForTool,
      selectedTool,
      setUiError,
      setUiNotice,
      trackCharacterModeFallback,
      tryAcquireGenerateClickLock,
    ]
  );

  const handlePrimarySubmit = useCallback(() => {
    if ((selectedTool === "create" || selectedTool === "text") && mode === "text") {
      handleAgentSend(agentInput || prompt, { captureResult: true }).then((result) => {
        const agentRes = result as { prompt: string; referenceTitle?: string } | undefined;
        if (agentRes?.prompt) {
          addAgentPromptReference(agentRes.prompt, agentRes.referenceTitle);
          setPromptOrigin("agent");
        }
      });
      return;
    }
    void handleGenerate();
  }, [
    addAgentPromptReference,
    agentInput,
    handleAgentSend,
    handleGenerate,
    mode,
    prompt,
    selectedTool,
    setPromptOrigin,
  ]);

  const runRegenerateWithDebit = useCallback(async () => {
    if (!tryAcquireGenerateClickLock()) return;

    if (agentBusy) {
      handleBlockedGeneration();
      return;
    }
    if (isGenerateDisabled && !isCreditGuardrail) {
      handleBlockedGeneration();
      return;
    }
    if (isCreditGuardrail) {
      const hasFreshCredits = await ensureFreshCreditsForRun(currentCostCredits);
      if (!hasFreshCredits) {
        handleBlockedGeneration();
        return;
      }
    }
    const promptToUse = resolveDefaultPromptForTool(selectedTool);
    const characterModeBundleForSubmit =
      await refreshCharacterModeInjectionBundleForSubmission(selectedTool);
    const characterModeOverrides = resolveCharacterModeSubmissionOverrides(
      promptToUse,
      selectedTool,
      characterModeBundleForSubmit
    );
    trackCharacterModeFallback(characterModeOverrides, selectedTool);
    enqueueOptimisticDebit(currentCostCredits);
    regenerateOutput({
      submissionPromptOverride: characterModeOverrides?.submissionPromptOverride,
      displayPromptOverride: characterModeOverrides?.displayPromptOverride,
      referenceInputsOverride: characterModeOverrides?.referenceInputsOverride,
      ...(characterModeOverrides?.characterContextOverride
        ? { characterContextOverride: characterModeOverrides.characterContextOverride }
        : {}),
    });
    if (characterModeOverrides?.notice) {
      setUiNotice(characterModeOverrides.notice);
    }
  }, [
    agentBusy,
    currentCostCredits,
    enqueueOptimisticDebit,
    ensureFreshCreditsForRun,
    handleBlockedGeneration,
    isCreditGuardrail,
    isGenerateDisabled,
    refreshCharacterModeInjectionBundleForSubmission,
    regenerateOutput,
    resolveCharacterModeSubmissionOverrides,
    resolveDefaultPromptForTool,
    selectedTool,
    setUiNotice,
    trackCharacterModeFallback,
    tryAcquireGenerateClickLock,
  ]);

  const handleRegenerateWithDebit = useCallback(async () => {
    await runRegenerateWithDebit();
  }, [runRegenerateWithDebit]);

  const handleImageRegenerateWithDebit = useCallback(async () => {
    await runRegenerateWithDebit();
  }, [runRegenerateWithDebit]);

  return {
    isGenerateClickLocked,
    handleGenerate,
    handlePrimarySubmit,
    handleRegenerateWithDebit,
    handleImageRegenerateWithDebit,
  };
};
