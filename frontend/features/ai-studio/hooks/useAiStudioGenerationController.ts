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
import { resolveCreateCharacterModeSubmitModel } from "../logic/createCharacterModeModelMapping";
import {
  GENERATION_GUARDRAIL_FALLBACK_ERROR,
  resolveGenerationStartDecision,
} from "../logic/generationStartPolicy";
import { shouldCheckPromptAtGenerationStart } from "../logic/editPromptPolicy";
import { resolveChatOffCreatePrompt } from "../logic/promptAdjacency";
import { buildImageReferenceInputs } from "../logic/referenceInputs";
import { DeadlineExceededError, withDeadline } from "../logic/withDeadline";
import type { InpaintSubmissionOverride } from "../logic/inpaintSubmission";
import type { ReferenceInputsMode } from "./useAiStudioGenerationPromptComposer";
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

type GenerateResult = {
  accepted: boolean;
  optimisticOutputId: string | null;
};

type RegenerateWithDebitOptions = {
  referenceInputsOverride?: string[];
  referenceInputsMode?: ReferenceInputsMode;
  inpaintOverride?: InpaintSubmissionOverride | null;
  modelIdOverride?: string | null;
  costOverrideCredits?: number | null;
  hideOutputFromReferenceGrid?: boolean;
  displayPromptOverride?: string | null;
  submissionPromptOverride?: string | null;
  styleContextOverride?: StudioOutput["styleContext"];
};

const PREFLIGHT_TIMEOUT_ERROR = "Preparation timed out before generation started. Please retry.";
const PREFLIGHT_TIMEOUT_MS = 10_000;
const isCreateTool = (tool: ToolId | null): boolean => tool === "create" || tool === "text";

type UseAiStudioGenerationControllerParams<TBundle, TFallbackCode extends string> = {
  mode: StudioMode;
  selectedTool: ToolId | null;
  model: string | null;
  setModel: (value: string | null) => void;
  isCharacterModeEnabled: boolean;
  resolveIsCharacterModeEnabledForTool?: (tool: ToolId | null) => boolean;
  prompt: string;
  agentInput: string;
  agentBusy: boolean;
  chatModeEnabled: boolean;
  currentCostCredits: number | null;
  promptReferenceGenerateCostCredits?: number | null;
  resolveCostCreditsForModel?: (modelId: string) => number | null;
  isGenerateDisabled: boolean;
  isCreditGuardrail: boolean;
  generationGuardrail: string | null;
  effectiveBalanceCredits: number | null;
  balanceCredits: number | null;
  optimisticUncoveredDebitTotal: number;
  setUiError: Dispatch<SetStateAction<string | null>>;
  setUiNotice: Dispatch<SetStateAction<string | null>>;
  setPromptOrigin: Dispatch<SetStateAction<"manual" | "agent" | "reference">>;
  setOptimisticDebitEntries: Dispatch<
    SetStateAction<{ credits: number; outputId: string | null; createdAtMs?: number }[]>
  >;
  refreshBalance: (options?: {
    silent?: boolean;
    preferLedger?: boolean;
    beforeCommit?: (snapshot: {
      cents: number;
      updatedAt: string | null;
      reservedCents?: number | null;
      source?: "snapshot" | "fallback";
    }) => void;
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
    bundleOverride?: TBundle | null,
    userReferenceInputs?: string[]
  ) => CharacterModeSubmissionOverrides<TFallbackCode>;
  resolveReferenceInputsForTool: (tool: ToolId | null) => {
    referenceImageUrl: string | null;
    extraImageUrls: [string | null, string | null, string | null];
  };
  trackCharacterModeFallback: (
    overrides: CharacterModeFallbackSummary<TFallbackCode>,
    tool: ToolId | null
  ) => void;
  trackCharacterModeEvent?: (message: string, data?: Record<string, unknown>) => void;
  insertOptimisticGenerationPlaceholder?: (input: {
    prompt: string;
    modeOverride?: StudioMode;
    selectedToolOverride?: ToolId | null;
  }) => string | null;
  removeOptimisticGenerationPlaceholder?: (outputId: string) => void;
  generateOutput: (
    promptOverride?: string | null,
    options?: {
      modeOverride?: StudioMode;
      selectedToolOverride?: ToolId | null;
      submissionPromptOverride?: string | null;
      displayPromptOverride?: string | null;
      referenceInputsOverride?: string[];
      referenceInputsMode?: ReferenceInputsMode;
      characterContextOverride?: StudioOutput["characterContext"];
      styleContextOverride?: StudioOutput["styleContext"];
      outputIdOverride?: string;
      modelIdOverride?: string | null;
      inpaintOverride?: InpaintSubmissionOverride | null;
      hideOutputFromReferenceGrid?: boolean;
    }
  ) => void;
  regenerateOutput: (options?: {
    submissionPromptOverride?: string | null;
    displayPromptOverride?: string | null;
    referenceInputsOverride?: string[];
    referenceInputsMode?: ReferenceInputsMode;
    characterContextOverride?: StudioOutput["characterContext"];
    styleContextOverride?: StudioOutput["styleContext"];
    outputIdOverride?: string;
    modelIdOverride?: string | null;
    inpaintOverride?: InpaintSubmissionOverride | null;
    hideOutputFromReferenceGrid?: boolean;
  }) => void;
  activeOutputId?: string | null;
};

const GENERATE_CLICK_COOLDOWN_MS = 700;

/**
 * Returns stable generation action handlers and click-lock state for AI Studio orchestration.
 */
export const useAiStudioGenerationController = <TBundle, TFallbackCode extends string>({
  mode,
  selectedTool,
  model,
  setModel,
  isCharacterModeEnabled,
  resolveIsCharacterModeEnabledForTool,
  prompt,
  agentInput,
  chatModeEnabled,
  currentCostCredits,
  promptReferenceGenerateCostCredits = null,
  resolveCostCreditsForModel,
  isGenerateDisabled,
  isCreditGuardrail,
  generationGuardrail,
  effectiveBalanceCredits,
  balanceCredits,
  optimisticUncoveredDebitTotal,
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
  resolveReferenceInputsForTool,
  trackCharacterModeFallback,
  trackCharacterModeEvent,
  insertOptimisticGenerationPlaceholder,
  removeOptimisticGenerationPlaceholder,
  generateOutput,
  regenerateOutput,
  activeOutputId,
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

  const resolveGuardrailBlockMessage = useCallback(
    () => generationGuardrail ?? GENERATION_GUARDRAIL_FALLBACK_ERROR,
    [generationGuardrail]
  );

  const ensureFreshCreditsForRun = useCallback(
    async (requiredCredits: number | null | undefined): Promise<boolean> => {
      if (requiredCredits == null) return true;
      let refreshSource: "snapshot" | "fallback" | null = null;
      const latestBalance = await refreshBalance({
        silent: true,
        beforeCommit: (snapshot) => {
          refreshSource = snapshot.source ?? null;
        },
      });
      const resolvedBalance = latestBalance ?? balanceCredits;
      if (resolvedBalance == null) return true;
      const shouldApplyOptimisticAdjustment = refreshSource !== "snapshot";
      const adjustedBalance = shouldApplyOptimisticAdjustment
        ? Math.max(0, resolvedBalance - optimisticUncoveredDebitTotal)
        : Math.max(0, resolvedBalance);
      return adjustedBalance >= requiredCredits;
    },
    [balanceCredits, optimisticUncoveredDebitTotal, refreshBalance]
  );

  const enqueueOptimisticDebit = useCallback(
    (credits: number | null | undefined, outputId: string | null = null) => {
      if (credits == null || credits <= 0) return;
      setOptimisticDebitEntries((prev) => [
        ...prev,
        {
          credits,
          outputId,
          createdAtMs: Date.now(),
        },
      ]);
    },
    [setOptimisticDebitEntries]
  );

  const resolveEffectiveSubmitModelId = useCallback(
    (tool: ToolId | null): string | null => {
      if (!isCreateTool(tool)) return model;
      const characterModeEnabledForTool = resolveIsCharacterModeEnabledForTool
        ? resolveIsCharacterModeEnabledForTool(tool)
        : isCharacterModeEnabled;
      return resolveCreateCharacterModeSubmitModel({
        currentModelId: model,
        isCharacterModeEnabled: characterModeEnabledForTool,
      });
    },
    [isCharacterModeEnabled, model, resolveIsCharacterModeEnabledForTool]
  );
  const resolveUserReferenceInputsForTool = useCallback(
    (tool: ToolId | null): string[] => {
      if (tool !== "edit" && tool !== "image") {
        return [];
      }
      const { referenceImageUrl, extraImageUrls } = resolveReferenceInputsForTool(tool);
      return buildImageReferenceInputs(referenceImageUrl, extraImageUrls);
    },
    [resolveReferenceInputsForTool]
  );

  const handleGenerate = useCallback(
    async (promptOverride?: string | null, options?: GenerateOptions): Promise<GenerateResult> => {
      if (!tryAcquireGenerateClickLock()) {
        return { accepted: false, optimisticOutputId: null };
      }

      const effectiveMode = options?.modeOverride ?? mode;
      const effectiveTool = options?.toolOverride ?? selectedTool;
      const isCharacterModeEnabledForTool = resolveIsCharacterModeEnabledForTool
        ? resolveIsCharacterModeEnabledForTool(effectiveTool)
        : isCharacterModeEnabled;
      const effectiveModelId = resolveEffectiveSubmitModelId(effectiveTool);
      const wasSubmitModelCoerced =
        effectiveModelId != null && model != null && effectiveModelId !== model;
      if (wasSubmitModelCoerced) {
        setModel(effectiveModelId);
        trackCharacterModeEvent?.("character_mode_submit_invariant_coerced", {
          trigger: "generate",
          tool: effectiveTool,
          from_model_id: model,
          to_model_id: effectiveModelId,
        });
      }
      const requiredCredits = options?.costOverrideCredits ?? currentCostCredits;
      let checkedFreshCredits = false;

      if (
        options?.costOverrideCredits != null &&
        effectiveBalanceCredits != null &&
        effectiveBalanceCredits < options.costOverrideCredits
      ) {
        const hasFreshCredits = await ensureFreshCreditsForRun(options.costOverrideCredits);
        checkedFreshCredits = true;
        if (!hasFreshCredits) {
          setUiError("You do not have enough credits for this run.");
          return { accepted: false, optimisticOutputId: null };
        }
      }

      if (isGenerateDisabled) {
        if (isCreditGuardrail) {
          const hasFreshCredits = checkedFreshCredits
            ? true
            : await ensureFreshCreditsForRun(requiredCredits);
          if (!hasFreshCredits) {
            setUiError(resolveGuardrailBlockMessage());
            return { accepted: false, optimisticOutputId: null };
          }
        } else {
          setUiError(resolveGuardrailBlockMessage());
          return { accepted: false, optimisticOutputId: null };
        }
      }

      const defaultPromptForTool = resolveDefaultPromptForTool(effectiveTool);
      const promptToUse =
        typeof promptOverride === "string" ? promptOverride : defaultPromptForTool;
      const startDecision = resolveGenerationStartDecision({
        tool: effectiveTool,
        mode: effectiveMode,
        modelId: effectiveModelId,
        promptText: promptToUse,
        checkPrompt: shouldCheckPromptAtGenerationStart({
          tool: effectiveTool,
          modelId: effectiveModelId,
        }),
      });
      if (!startDecision.allow) {
        setUiError(startDecision.message);
        return { accepted: false, optimisticOutputId: null };
      }
      const optimisticOutputId = insertOptimisticGenerationPlaceholder?.({
        prompt: promptToUse,
        modeOverride: effectiveMode,
        selectedToolOverride: effectiveTool,
      });
      let characterModeOverrides: CharacterModeSubmissionOverrides<TFallbackCode>;
      try {
        trackCharacterModeEvent?.("generation_preflight_started", {
          trigger: "generate",
          tool: effectiveTool,
          model_id: effectiveModelId,
          is_character_mode: isCharacterModeEnabledForTool,
        });
        const characterModeBundleForSubmit = await withDeadline({
          timeoutMs: PREFLIGHT_TIMEOUT_MS,
          timeoutMessage: PREFLIGHT_TIMEOUT_ERROR,
          run: () => refreshCharacterModeInjectionBundleForSubmission(effectiveTool),
        });
        const userReferenceInputs = resolveUserReferenceInputsForTool(effectiveTool);
        characterModeOverrides = resolveCharacterModeSubmissionOverrides(
          promptToUse,
          effectiveTool,
          characterModeBundleForSubmit,
          userReferenceInputs
        );
      } catch (error) {
        if (error instanceof DeadlineExceededError) {
          trackCharacterModeEvent?.("generation_preflight_timeout", {
            trigger: "generate",
            tool: effectiveTool,
            model_id: effectiveModelId,
            is_character_mode: isCharacterModeEnabledForTool,
            duration_ms: error.timeoutMs,
            reason_code: "PREFLIGHT_TIMEOUT",
          });
        }
        if (optimisticOutputId) {
          removeOptimisticGenerationPlaceholder?.(optimisticOutputId);
        }
        setUiError(
          error instanceof DeadlineExceededError
            ? PREFLIGHT_TIMEOUT_ERROR
            : error instanceof Error
              ? error.message
              : "Unable to start generation."
        );
        return { accepted: false, optimisticOutputId: null };
      }
      const hasCharacterModeReferences =
        (characterModeOverrides?.referenceInputsOverride?.length ?? 0) > 0;
      const characterModeDecision =
        characterModeOverrides &&
        resolveGenerationStartDecision({
          tool: effectiveTool,
          mode: effectiveMode,
          modelId: effectiveModelId,
          promptText: promptToUse,
          checkCreateTextMode: false,
          checkPrompt: false,
          checkModel: false,
          checkCharacterReferences: true,
          hasCharacterModeReferences,
        });
      if (characterModeOverrides && characterModeDecision && !characterModeDecision.allow) {
        trackCharacterModeFallback(characterModeOverrides, effectiveTool);
        trackCharacterModeEvent?.("character_mode_submit_blocked_no_references", {
          tool: effectiveTool,
          fallback_code: characterModeOverrides.fallbackCode,
          has_character_description: characterModeOverrides.hasCharacterDescription,
          character_reference_count: characterModeOverrides.characterReferenceCount,
        });
        if (optimisticOutputId) {
          removeOptimisticGenerationPlaceholder?.(optimisticOutputId);
        }
        setUiError(characterModeDecision.message);
        return { accepted: false, optimisticOutputId: null };
      }
      trackCharacterModeFallback(characterModeOverrides, effectiveTool);
      enqueueOptimisticDebit(requiredCredits, optimisticOutputId ?? null);
      generateOutput(promptToUse, {
        modeOverride: effectiveMode,
        selectedToolOverride: effectiveTool,
        modelIdOverride: effectiveModelId,
        submissionPromptOverride: characterModeOverrides?.submissionPromptOverride,
        displayPromptOverride: characterModeOverrides?.displayPromptOverride,
        referenceInputsOverride: characterModeOverrides?.referenceInputsOverride,
        ...(optimisticOutputId ? { outputIdOverride: optimisticOutputId } : {}),
        ...(characterModeOverrides?.characterContextOverride
          ? { characterContextOverride: characterModeOverrides.characterContextOverride }
          : {}),
      });
      if (characterModeOverrides?.notice) {
        setUiNotice(characterModeOverrides.notice);
      }
      return {
        accepted: true,
        optimisticOutputId: optimisticOutputId ?? null,
      };
    },
    [
      currentCostCredits,
      effectiveBalanceCredits,
      enqueueOptimisticDebit,
      ensureFreshCreditsForRun,
      generateOutput,
      isCreditGuardrail,
      isCharacterModeEnabled,
      isGenerateDisabled,
      insertOptimisticGenerationPlaceholder,
      mode,
      model,
      removeOptimisticGenerationPlaceholder,
      refreshCharacterModeInjectionBundleForSubmission,
      resolveGuardrailBlockMessage,
      resolveEffectiveSubmitModelId,
      resolveCharacterModeSubmissionOverrides,
      resolveDefaultPromptForTool,
      resolveUserReferenceInputsForTool,
      resolveIsCharacterModeEnabledForTool,
      selectedTool,
      setModel,
      setUiError,
      setUiNotice,
      trackCharacterModeFallback,
      trackCharacterModeEvent,
      tryAcquireGenerateClickLock,
    ]
  );

  const handlePrimarySubmit = useCallback(() => {
    if ((selectedTool === "create" || selectedTool === "text") && mode === "text") {
      if (chatModeEnabled) {
        handleAgentSend(agentInput || prompt, { captureResult: true }).then((result) => {
          const agentRes = result as { prompt: string; referenceTitle?: string } | undefined;
          if (agentRes?.prompt) {
            addAgentPromptReference(agentRes.prompt, agentRes.referenceTitle);
            setPromptOrigin("agent");
          }
        });
      } else {
        const rawPrompt = resolveChatOffCreatePrompt({
          agentInput,
          sharedPrompt: prompt,
          allowSharedPromptFallback: true,
        });
        if (rawPrompt) {
          setPromptOrigin("manual");
        }
        void handleGenerate(rawPrompt ?? "", {
          modeOverride: "image",
          toolOverride: "create",
          costOverrideCredits: promptReferenceGenerateCostCredits ?? currentCostCredits,
        });
      }
      return;
    }
    void handleGenerate();
  }, [
    addAgentPromptReference,
    agentInput,
    chatModeEnabled,
    currentCostCredits,
    handleAgentSend,
    handleGenerate,
    mode,
    prompt,
    promptReferenceGenerateCostCredits,
    selectedTool,
    setPromptOrigin,
  ]);

  const handleChatOffInlineGenerate = useCallback(() => {
    const rawPrompt = resolveChatOffCreatePrompt({
      agentInput,
      sharedPrompt: prompt,
      allowSharedPromptFallback: true,
    });
    if (rawPrompt) setPromptOrigin("manual");
    void handleGenerate(rawPrompt ?? "", {
      modeOverride: "image",
      toolOverride: "create",
      costOverrideCredits: promptReferenceGenerateCostCredits ?? currentCostCredits,
    });
  }, [
    agentInput,
    currentCostCredits,
    handleGenerate,
    prompt,
    promptReferenceGenerateCostCredits,
    setPromptOrigin,
  ]);

  const runRegenerateWithDebit = useCallback(
    async (options?: RegenerateWithDebitOptions) => {
      if (!tryAcquireGenerateClickLock()) return;
      const effectiveSubmitModelId =
        options?.inpaintOverride?.modelId ??
        options?.modelIdOverride ??
        resolveEffectiveSubmitModelId(selectedTool);
      const isCharacterModeEnabledForTool = resolveIsCharacterModeEnabledForTool
        ? resolveIsCharacterModeEnabledForTool(selectedTool)
        : isCharacterModeEnabled;
      const hasSubmitModelOverride = Boolean(
        options?.inpaintOverride?.modelId ?? options?.modelIdOverride
      );
      const resolvedModelOverrideCredits =
        hasSubmitModelOverride && effectiveSubmitModelId
          ? (resolveCostCreditsForModel?.(effectiveSubmitModelId) ?? null)
          : null;
      const resolvedRunCostCredits = options?.costOverrideCredits ?? resolvedModelOverrideCredits;
      const requiredCredits = resolvedRunCostCredits ?? currentCostCredits;
      let checkedFreshCredits = false;

      if (
        resolvedRunCostCredits != null &&
        effectiveBalanceCredits != null &&
        effectiveBalanceCredits < resolvedRunCostCredits
      ) {
        const hasFreshCredits = await ensureFreshCreditsForRun(resolvedRunCostCredits);
        checkedFreshCredits = true;
        if (!hasFreshCredits) {
          setUiError("You do not have enough credits for this run.");
          return;
        }
      }

      if (isGenerateDisabled && !isCreditGuardrail) {
        setUiError(resolveGuardrailBlockMessage());
        return;
      }
      if (isCreditGuardrail) {
        const hasFreshCredits = checkedFreshCredits
          ? true
          : await ensureFreshCreditsForRun(requiredCredits);
        if (!hasFreshCredits) {
          setUiError(resolveGuardrailBlockMessage());
          return;
        }
      }

      const promptToUse = resolveDefaultPromptForTool(selectedTool);
      const promptForGuardrails =
        typeof options?.displayPromptOverride === "string"
          ? options.displayPromptOverride
          : promptToUse;
      const promptForCharacterComposition =
        typeof options?.submissionPromptOverride === "string"
          ? options.submissionPromptOverride
          : promptForGuardrails;
      const regenerateStartDecision = resolveGenerationStartDecision({
        tool: selectedTool,
        mode,
        modelId: effectiveSubmitModelId,
        promptText: promptForGuardrails,
        checkCreateTextMode: false,
        checkPrompt: shouldCheckPromptAtGenerationStart({
          tool: selectedTool,
          modelId: effectiveSubmitModelId,
        }),
      });
      if (!regenerateStartDecision.allow) {
        setUiError(regenerateStartDecision.message);
        return;
      }

      let characterModeOverrides: CharacterModeSubmissionOverrides<TFallbackCode>;
      try {
        trackCharacterModeEvent?.("generation_preflight_started", {
          trigger: "regenerate",
          tool: selectedTool,
          model_id: effectiveSubmitModelId,
          is_character_mode: isCharacterModeEnabledForTool,
        });
        const characterModeBundleForSubmit = await withDeadline({
          timeoutMs: PREFLIGHT_TIMEOUT_MS,
          timeoutMessage: PREFLIGHT_TIMEOUT_ERROR,
          run: () => refreshCharacterModeInjectionBundleForSubmission(selectedTool),
        });
        const userReferenceInputs =
          options?.referenceInputsOverride ?? resolveUserReferenceInputsForTool(selectedTool);
        characterModeOverrides = resolveCharacterModeSubmissionOverrides(
          promptForCharacterComposition,
          selectedTool,
          characterModeBundleForSubmit,
          userReferenceInputs
        );
      } catch (error) {
        if (error instanceof DeadlineExceededError) {
          trackCharacterModeEvent?.("generation_preflight_timeout", {
            trigger: "regenerate",
            tool: selectedTool,
            model_id: effectiveSubmitModelId,
            is_character_mode: isCharacterModeEnabledForTool,
            duration_ms: error.timeoutMs,
            reason_code: "PREFLIGHT_TIMEOUT",
          });
        }
        setUiError(
          error instanceof DeadlineExceededError
            ? PREFLIGHT_TIMEOUT_ERROR
            : error instanceof Error
              ? error.message
              : "Unable to start generation."
        );
        return;
      }

      const hasCharacterModeReferences =
        (characterModeOverrides?.referenceInputsOverride?.length ?? 0) > 0;
      const regenerateCharacterModeDecision =
        characterModeOverrides &&
        resolveGenerationStartDecision({
          tool: selectedTool,
          mode,
          modelId: effectiveSubmitModelId,
          promptText: promptForGuardrails,
          checkCreateTextMode: false,
          checkPrompt: false,
          checkModel: false,
          checkCharacterReferences: true,
          hasCharacterModeReferences,
        });
      if (
        characterModeOverrides &&
        regenerateCharacterModeDecision &&
        !regenerateCharacterModeDecision.allow
      ) {
        trackCharacterModeFallback(characterModeOverrides, selectedTool);
        trackCharacterModeEvent?.("character_mode_submit_blocked_no_references", {
          tool: selectedTool,
          fallback_code: characterModeOverrides.fallbackCode,
          has_character_description: characterModeOverrides.hasCharacterDescription,
          character_reference_count: characterModeOverrides.characterReferenceCount,
        });
        setUiError(regenerateCharacterModeDecision.message);
        return;
      }

      trackCharacterModeFallback(characterModeOverrides, selectedTool);
      const effectiveModelId = effectiveSubmitModelId;
      const wasSubmitModelCoerced =
        effectiveModelId != null && model != null && effectiveModelId !== model;
      const shouldPersistSubmitModelCoercion = wasSubmitModelCoerced && !hasSubmitModelOverride;
      if (shouldPersistSubmitModelCoercion) {
        setModel(effectiveModelId);
        trackCharacterModeEvent?.("character_mode_submit_invariant_coerced", {
          trigger: "regenerate",
          tool: selectedTool,
          from_model_id: model,
          to_model_id: effectiveModelId,
        });
      }

      enqueueOptimisticDebit(requiredCredits, activeOutputId ?? null);
      const resolvedDisplayPromptOverride =
        typeof options?.displayPromptOverride === "string"
          ? options.displayPromptOverride
          : characterModeOverrides?.displayPromptOverride;
      const resolvedSubmissionPromptOverride =
        characterModeOverrides?.submissionPromptOverride ?? options?.submissionPromptOverride;
      regenerateOutput({
        modelIdOverride: effectiveModelId,
        submissionPromptOverride: resolvedSubmissionPromptOverride,
        displayPromptOverride: resolvedDisplayPromptOverride,
        referenceInputsOverride:
          characterModeOverrides?.referenceInputsOverride ?? options?.referenceInputsOverride,
        inpaintOverride: options?.inpaintOverride,
        hideOutputFromReferenceGrid: options?.hideOutputFromReferenceGrid,
        ...(options?.referenceInputsMode
          ? { referenceInputsMode: options.referenceInputsMode }
          : {}),
        ...(options?.styleContextOverride
          ? { styleContextOverride: options.styleContextOverride }
          : {}),
        ...(characterModeOverrides?.characterContextOverride
          ? { characterContextOverride: characterModeOverrides.characterContextOverride }
          : {}),
      });
      if (characterModeOverrides?.notice) {
        setUiNotice(characterModeOverrides.notice);
      }
    },
    [
      activeOutputId,
      currentCostCredits,
      effectiveBalanceCredits,
      enqueueOptimisticDebit,
      ensureFreshCreditsForRun,
      isCreditGuardrail,
      isGenerateDisabled,
      mode,
      model,
      isCharacterModeEnabled,
      resolveIsCharacterModeEnabledForTool,
      refreshCharacterModeInjectionBundleForSubmission,
      regenerateOutput,
      resolveGuardrailBlockMessage,
      resolveEffectiveSubmitModelId,
      resolveCharacterModeSubmissionOverrides,
      resolveDefaultPromptForTool,
      resolveCostCreditsForModel,
      resolveUserReferenceInputsForTool,
      selectedTool,
      setModel,
      setUiError,
      setUiNotice,
      trackCharacterModeFallback,
      trackCharacterModeEvent,
      tryAcquireGenerateClickLock,
    ]
  );

  const handleRegenerateWithDebit = useCallback(async () => {
    await runRegenerateWithDebit();
  }, [runRegenerateWithDebit]);

  const handleImageRegenerateWithDebit = useCallback(
    async (options?: RegenerateWithDebitOptions) => {
      await runRegenerateWithDebit(options);
    },
    [runRegenerateWithDebit]
  );

  return {
    isGenerateClickLocked,
    handleGenerate,
    handlePrimarySubmit,
    handleChatOffInlineGenerate,
    handleRegenerateWithDebit,
    handleImageRegenerateWithDebit,
  };
};
