/**
 * AI Studio generation controller hook.
 * Owns submission/regeneration orchestration while preserving page behavior.
 */
import { useCallback, type Dispatch, type SetStateAction } from "react";
import { resolveCreateCharacterModeSubmitModel } from "../logic/createCharacterModeModelMapping";
import { GENERATION_GUARDRAIL_FALLBACK_ERROR } from "../logic/generationStartPolicy";
import { trackAiStudioGenerateClicked } from "../logic/generationUsageTelemetry";
import { buildImageReferenceInputs } from "../logic/referenceInputs";
import type { ExpertEditRegenerateOptions } from "../components/edit/expertEditSubmissionContract";
import type {
  AiStudioGenerateOutputOptions,
  AiStudioGenerateSubmissionOverrides,
} from "./contracts/generationSubmissionContracts";
import {
  type CharacterModeFallbackSummary,
  type CharacterModeSubmissionOverrides,
} from "./generationCharacterModePreflight";
import { runGenerationCharacterPreparation } from "./generationCharacterPreparation";
import { runGenerationCreditGuardrail } from "./generationCreditGuardrail";
import { resolveSubmissionModeForModelId } from "./taskSubmission/outputBootstrap";
import type { StudioMode, StudioOutput, StudioOutputSubmissionMode, ToolId } from "../types";

type GenerateOptions = {
  modeOverride?: StudioMode;
  toolOverride?: ToolId | null;
  costOverrideCredits?: number | null;
  suppressStyle?: boolean;
  suppressCharacter?: boolean;
  ignoreGenerationGuardrail?: boolean;
};

type GenerateResult = {
  accepted: boolean;
  optimisticOutputId: string | null;
};

type RegenerateWithDebitOptions = ExpertEditRegenerateOptions &
  Pick<
    AiStudioGenerateSubmissionOverrides,
    "referenceInputsOverride" | "styleContextOverride" | "suppressStyle"
  >;

const PREFLIGHT_TIMEOUT_ERROR = "Preparation timed out before generation started. Please retry.";
const PREFLIGHT_TIMEOUT_MS = 10_000;
const isCreateTool = (tool: ToolId | null): boolean => tool === "create" || tool === "text";

type UseAiStudioGenerationControllerParams<TBundle, TFallbackCode extends string> = {
  mode: StudioMode;
  selectedTool: ToolId | null;
  model: string | null;
  setModel: (value: string | null) => void;
  projectId?: string | null;
  isCharacterModeEnabled: boolean;
  resolveIsCharacterModeEnabledForTool?: (tool: ToolId | null) => boolean;
  resolveSelectedCharacterIdForTool?: (tool: ToolId | null) => string | null;
  selectedStyleContext?: StudioOutput["styleContext"] | null;
  currentCostCredits: number | null;
  resolveCostCreditsForModel?: (modelId: string) => number | null;
  isGenerateDisabled: boolean;
  isCreditGuardrail: boolean;
  generationGuardrail: string | null;
  balanceCredits: number | null;
  setUiError: Dispatch<SetStateAction<string | null>>;
  setUiNotice: Dispatch<SetStateAction<string | null>>;
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
    extraImageUrls: readonly (string | null)[];
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
    submissionModeOverride?: StudioOutputSubmissionMode;
  }) => string | null;
  removeOptimisticGenerationPlaceholder?: (outputId: string) => void;
  generateOutput: (promptOverride?: string | null, options?: AiStudioGenerateOutputOptions) => void;
  regenerateOutput: (options?: AiStudioGenerateSubmissionOverrides) => void;
  activeOutputId?: string | null;
};

/**
 * Returns stable generation action handlers and click-lock state for AI Studio orchestration.
 */
export const useAiStudioGenerationController = <TBundle, TFallbackCode extends string>({
  mode,
  selectedTool,
  model,
  setModel,
  projectId = null,
  isCharacterModeEnabled,
  resolveIsCharacterModeEnabledForTool,
  resolveSelectedCharacterIdForTool,
  selectedStyleContext = null,
  currentCostCredits,
  resolveCostCreditsForModel,
  isGenerateDisabled,
  isCreditGuardrail,
  generationGuardrail,
  balanceCredits,
  setUiError,
  setUiNotice,
  setOptimisticDebitEntries,
  refreshBalance,
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
  const resolveGuardrailBlockMessage = useCallback(
    () => generationGuardrail ?? GENERATION_GUARDRAIL_FALLBACK_ERROR,
    [generationGuardrail]
  );

  const ensureFreshCreditsForRun = useCallback(
    async (requiredCredits: number | null | undefined): Promise<boolean> => {
      if (requiredCredits == null) return true;
      const latestBalance = await refreshBalance({ silent: true });
      const resolvedBalance = latestBalance ?? balanceCredits;
      if (resolvedBalance == null) return true;
      return Math.max(0, resolvedBalance) >= requiredCredits;
    },
    [balanceCredits, refreshBalance]
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
      return buildImageReferenceInputs(referenceImageUrl, extraImageUrls, {
        preserveDuplicateExtras: true,
      });
    },
    [resolveReferenceInputsForTool]
  );

  const handleGenerate = useCallback(
    async (promptOverride?: string | null, options?: GenerateOptions): Promise<GenerateResult> => {
      const effectiveTool = options?.toolOverride ?? selectedTool;
      const effectiveMode = options?.modeOverride ?? mode;
      const isCharacterModeEnabledForTool = options?.suppressCharacter
        ? false
        : resolveIsCharacterModeEnabledForTool
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
      trackAiStudioGenerateClicked({
        trigger: "generate",
        tool: effectiveTool,
        mode: effectiveMode,
        modelId: effectiveModelId,
        selectedModelId: model,
        projectIdPresent: Boolean(projectId),
        isCharacterMode: isCharacterModeEnabledForTool,
        selectedCharacterId: resolveSelectedCharacterIdForTool?.(effectiveTool) ?? null,
        hasStyle: Boolean(!options?.suppressStyle && selectedStyleContext?.applied),
        styleId: !options?.suppressStyle ? (selectedStyleContext?.styleId ?? null) : null,
        referenceCount: resolveUserReferenceInputsForTool(effectiveTool).length,
      });

      const requiredCredits = options?.costOverrideCredits ?? currentCostCredits;
      const canProceedWithCredits = await runGenerationCreditGuardrail({
        requiredCredits,
        upfrontRunCredits: options?.costOverrideCredits,
        availableBalanceCredits: balanceCredits,
        isGenerateDisabled: options?.ignoreGenerationGuardrail ? false : isGenerateDisabled,
        isCreditGuardrail,
        alwaysCheckCreditGuardrailWhenEnabled: false,
        ensureFreshCreditsForRun,
        resolveGuardrailBlockMessage,
        handleInsufficientCredits: () => {
          setUiError("You do not have enough credits for this run.");
        },
        handleGuardrailBlock: (message) => {
          setUiError(message);
        },
      });
      if (!canProceedWithCredits) {
        return { accepted: false, optimisticOutputId: null };
      }

      const defaultPromptForTool = resolveDefaultPromptForTool(effectiveTool);
      const promptToUse =
        typeof promptOverride === "string" ? promptOverride : defaultPromptForTool;
      const optimisticOutputId = insertOptimisticGenerationPlaceholder?.({
        prompt: promptToUse,
        modeOverride: effectiveMode,
        selectedToolOverride: effectiveTool,
        submissionModeOverride: resolveSubmissionModeForModelId(effectiveModelId),
      });
      if (insertOptimisticGenerationPlaceholder && !optimisticOutputId) {
        return { accepted: false, optimisticOutputId: null };
      }

      if (options?.suppressCharacter) {
        enqueueOptimisticDebit(requiredCredits, optimisticOutputId ?? null);
        generateOutput(promptToUse, {
          modeOverride: effectiveMode,
          selectedToolOverride: effectiveTool,
          modelIdOverride: effectiveModelId,
          displayedBilledCredits: requiredCredits,
          suppressStyle: options.suppressStyle,
          suppressCharacter: true,
          ignoreGenerationGuardrail: options.ignoreGenerationGuardrail,
          ...(optimisticOutputId ? { outputIdOverride: optimisticOutputId } : {}),
        });
        return {
          accepted: true,
          optimisticOutputId: optimisticOutputId ?? null,
        };
      }

      const preparationResult = await runGenerationCharacterPreparation({
        trigger: "generate",
        tool: effectiveTool,
        mode: effectiveMode,
        effectiveModelId,
        promptForGuardrails: promptToUse,
        promptForCharacterComposition: promptToUse,
        isCharacterModeEnabledForTool,
        userReferenceInputs: resolveUserReferenceInputsForTool(effectiveTool),
        allowCreateFallbackBlock: true,
        timeoutMs: PREFLIGHT_TIMEOUT_MS,
        timeoutMessage: PREFLIGHT_TIMEOUT_ERROR,
        refreshCharacterModeInjectionBundleForSubmission,
        resolveCharacterModeSubmissionOverrides,
        trackCharacterModeFallback,
        trackCharacterModeEvent,
        setUiError,
        onFailureCleanup: () => {
          if (optimisticOutputId) {
            removeOptimisticGenerationPlaceholder?.(optimisticOutputId);
          }
        },
      });
      if (!preparationResult.ok) {
        return { accepted: false, optimisticOutputId: null };
      }
      const characterModeOverrides = preparationResult.overrides;
      enqueueOptimisticDebit(requiredCredits, optimisticOutputId ?? null);
      generateOutput(promptToUse, {
        modeOverride: effectiveMode,
        selectedToolOverride: effectiveTool,
        modelIdOverride: effectiveModelId,
        displayedBilledCredits: requiredCredits,
        submissionPromptOverride: characterModeOverrides?.submissionPromptOverride,
        displayPromptOverride: characterModeOverrides?.displayPromptOverride,
        referenceInputsOverride: characterModeOverrides?.referenceInputsOverride,
        ...(characterModeOverrides?.internalMediaRefsOverride
          ? { internalMediaRefsOverride: characterModeOverrides.internalMediaRefsOverride }
          : {}),
        suppressStyle: options?.suppressStyle,
        suppressCharacter: options?.suppressCharacter,
        ignoreGenerationGuardrail: options?.ignoreGenerationGuardrail,
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
      balanceCredits,
      enqueueOptimisticDebit,
      ensureFreshCreditsForRun,
      generateOutput,
      isCreditGuardrail,
      isCharacterModeEnabled,
      isGenerateDisabled,
      insertOptimisticGenerationPlaceholder,
      mode,
      model,
      projectId,
      removeOptimisticGenerationPlaceholder,
      refreshCharacterModeInjectionBundleForSubmission,
      resolveGuardrailBlockMessage,
      resolveEffectiveSubmitModelId,
      resolveCharacterModeSubmissionOverrides,
      resolveDefaultPromptForTool,
      resolveSelectedCharacterIdForTool,
      resolveUserReferenceInputsForTool,
      resolveIsCharacterModeEnabledForTool,
      selectedTool,
      selectedStyleContext,
      setModel,
      setUiError,
      setUiNotice,
      trackCharacterModeFallback,
      trackCharacterModeEvent,
    ]
  );

  const runRegenerateWithDebit = useCallback(
    async (tool: ToolId | null, options?: RegenerateWithDebitOptions) => {
      const removeExternalOptimisticPlaceholder = () => {
        if (!options?.outputIdOverride) return;
        removeOptimisticGenerationPlaceholder?.(options.outputIdOverride);
      };
      const effectiveSubmitModelId =
        options?.inpaintOverride?.modelId ??
        options?.modelIdOverride ??
        resolveEffectiveSubmitModelId(tool);
      const isCharacterModeEnabledForTool = resolveIsCharacterModeEnabledForTool
        ? resolveIsCharacterModeEnabledForTool(tool)
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
      trackAiStudioGenerateClicked({
        trigger: "regenerate",
        tool,
        mode,
        modelId: effectiveSubmitModelId,
        selectedModelId: model,
        outputId: options?.outputIdOverride ?? activeOutputId ?? null,
        projectIdPresent: Boolean(projectId),
        isCharacterMode: isCharacterModeEnabledForTool,
        selectedCharacterId: resolveSelectedCharacterIdForTool?.(tool) ?? null,
        hasStyle: Boolean(options?.styleContextOverride?.applied ?? selectedStyleContext?.applied),
        styleId: options?.styleContextOverride?.styleId ?? selectedStyleContext?.styleId ?? null,
        referenceCount: (
          options?.referenceInputsOverride ?? resolveUserReferenceInputsForTool(tool)
        ).length,
      });
      const canProceedWithCredits = await runGenerationCreditGuardrail({
        requiredCredits,
        upfrontRunCredits: resolvedRunCostCredits,
        availableBalanceCredits: balanceCredits,
        isGenerateDisabled,
        isCreditGuardrail,
        alwaysCheckCreditGuardrailWhenEnabled: true,
        ensureFreshCreditsForRun,
        resolveGuardrailBlockMessage,
        handleInsufficientCredits: () => {
          removeExternalOptimisticPlaceholder();
          setUiError("You do not have enough credits for this run.");
        },
        handleGuardrailBlock: (message) => {
          removeExternalOptimisticPlaceholder();
          setUiError(message);
        },
      });
      if (!canProceedWithCredits) {
        return;
      }

      const promptToUse = resolveDefaultPromptForTool(tool);
      const promptForGuardrails =
        typeof options?.displayPromptOverride === "string"
          ? options.displayPromptOverride
          : promptToUse;
      const promptForCharacterComposition =
        typeof options?.submissionPromptOverride === "string"
          ? options.submissionPromptOverride
          : promptForGuardrails;
      const preparationResult = await runGenerationCharacterPreparation({
        trigger: "regenerate",
        tool,
        mode,
        effectiveModelId: effectiveSubmitModelId,
        promptForGuardrails,
        promptForCharacterComposition,
        isCharacterModeEnabledForTool,
        userReferenceInputs:
          options?.referenceInputsOverride ?? resolveUserReferenceInputsForTool(tool),
        allowCreateFallbackBlock: false,
        timeoutMs: PREFLIGHT_TIMEOUT_MS,
        timeoutMessage: PREFLIGHT_TIMEOUT_ERROR,
        refreshCharacterModeInjectionBundleForSubmission,
        resolveCharacterModeSubmissionOverrides,
        trackCharacterModeFallback,
        trackCharacterModeEvent,
        setUiError,
        onFailureCleanup: removeExternalOptimisticPlaceholder,
        checkCreateTextMode: false,
      });
      if (!preparationResult.ok) {
        return;
      }
      const characterModeOverrides = preparationResult.overrides;
      const effectiveModelId = effectiveSubmitModelId;
      const wasSubmitModelCoerced =
        effectiveModelId != null && model != null && effectiveModelId !== model;
      const shouldPersistSubmitModelCoercion = wasSubmitModelCoerced && !hasSubmitModelOverride;
      if (shouldPersistSubmitModelCoercion) {
        setModel(effectiveModelId);
        trackCharacterModeEvent?.("character_mode_submit_invariant_coerced", {
          trigger: "regenerate",
          tool,
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
        selectedToolOverride: tool,
        modelIdOverride: effectiveModelId,
        outputIdOverride: options?.outputIdOverride,
        displayedBilledCredits: requiredCredits,
        submissionPromptOverride: resolvedSubmissionPromptOverride,
        displayPromptOverride: resolvedDisplayPromptOverride,
        referenceInputsOverride:
          characterModeOverrides?.referenceInputsOverride ?? options?.referenceInputsOverride,
        ...(characterModeOverrides?.internalMediaRefsOverride
          ? { internalMediaRefsOverride: characterModeOverrides.internalMediaRefsOverride }
          : {}),
        inpaintOverride: options?.inpaintOverride,
        hideOutputFromReferenceGrid: options?.hideOutputFromReferenceGrid,
        suppressStyle: options?.suppressStyle,
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
      balanceCredits,
      enqueueOptimisticDebit,
      ensureFreshCreditsForRun,
      isCreditGuardrail,
      isGenerateDisabled,
      mode,
      model,
      isCharacterModeEnabled,
      projectId,
      resolveIsCharacterModeEnabledForTool,
      refreshCharacterModeInjectionBundleForSubmission,
      regenerateOutput,
      resolveGuardrailBlockMessage,
      resolveEffectiveSubmitModelId,
      resolveCharacterModeSubmissionOverrides,
      resolveDefaultPromptForTool,
      resolveCostCreditsForModel,
      resolveSelectedCharacterIdForTool,
      resolveUserReferenceInputsForTool,
      removeOptimisticGenerationPlaceholder,
      selectedStyleContext,
      setModel,
      setUiError,
      setUiNotice,
      trackCharacterModeFallback,
      trackCharacterModeEvent,
    ]
  );

  const handleRegenerateWithDebit = useCallback(async () => {
    await runRegenerateWithDebit("video");
  }, [runRegenerateWithDebit]);

  const handleImageRegenerateWithDebit = useCallback(
    async (options?: RegenerateWithDebitOptions) => {
      await runRegenerateWithDebit("edit", options);
    },
    [runRegenerateWithDebit]
  );

  return {
    handleGenerate,
    handleRegenerateWithDebit,
    handleImageRegenerateWithDebit,
  };
};
