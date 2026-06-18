import {
  GENERATION_GUARDRAIL_FALLBACK_ERROR,
  resolveGenerationStartDecision,
} from "../logic/generationStartPolicy";
import { shouldCheckPromptAtGenerationStart } from "../logic/editPromptPolicy";
import type { StudioMode, ToolId, VideoReferenceMode } from "../types";
import {
  runCharacterModePreflight,
  type CharacterModeFallbackSummary,
  type CharacterModeSubmissionOverrides,
} from "./generationCharacterModePreflight";
import { resolveCharacterModeBlockDecision } from "./generationCharacterModeDecision";

type GenerationPreparationTrigger = "generate" | "regenerate";

type GenerationPreparationResult<TFallbackCode extends string> =
  | {
      ok: true;
      overrides: CharacterModeSubmissionOverrides<TFallbackCode> | null;
    }
  | {
      ok: false;
    };

type RunGenerationCharacterPreparationArgs<TBundle, TFallbackCode extends string> = {
  trigger: GenerationPreparationTrigger;
  tool: ToolId | null;
  mode: StudioMode;
  effectiveModelId: string | null;
  videoReferenceMode?: VideoReferenceMode | null;
  promptForGuardrails: string;
  promptForCharacterComposition: string;
  isCharacterModeEnabledForTool: boolean;
  userReferenceInputs: string[];
  allowCreateFallbackBlock: boolean;
  timeoutMs: number;
  timeoutMessage: string;
  refreshCharacterModeInjectionBundleForSubmission: (
    tool: ToolId | null
  ) => Promise<TBundle | null>;
  resolveCharacterModeSubmissionOverrides: (
    userPrompt: string,
    tool: ToolId | null,
    bundleOverride?: TBundle | null,
    userReferenceInputs?: string[]
  ) => CharacterModeSubmissionOverrides<TFallbackCode>;
  trackCharacterModeFallback: (
    overrides: CharacterModeFallbackSummary<TFallbackCode>,
    tool: ToolId | null
  ) => void;
  trackCharacterModeEvent?: (message: string, data?: Record<string, unknown>) => void;
  setUiError: (message: string) => void;
  onFailureCleanup?: () => void;
  checkCreateTextMode?: boolean;
  resolveBlockedMessage?: () => string;
};

/**
 * Runs shared start-decision and character-mode preparation before generation dispatch.
 */
export const runGenerationCharacterPreparation = async <TBundle, TFallbackCode extends string>({
  trigger,
  tool,
  mode,
  effectiveModelId,
  videoReferenceMode = null,
  promptForGuardrails,
  promptForCharacterComposition,
  isCharacterModeEnabledForTool,
  userReferenceInputs,
  allowCreateFallbackBlock,
  timeoutMs,
  timeoutMessage,
  refreshCharacterModeInjectionBundleForSubmission,
  resolveCharacterModeSubmissionOverrides,
  trackCharacterModeFallback,
  trackCharacterModeEvent,
  setUiError,
  onFailureCleanup,
  checkCreateTextMode,
  resolveBlockedMessage,
}: RunGenerationCharacterPreparationArgs<TBundle, TFallbackCode>): Promise<
  GenerationPreparationResult<TFallbackCode>
> => {
  const startDecision = resolveGenerationStartDecision({
    tool,
    mode,
    modelId: effectiveModelId,
    promptText: promptForGuardrails,
    ...(checkCreateTextMode === false ? { checkCreateTextMode: false } : {}),
    checkPrompt: shouldCheckPromptAtGenerationStart({
      tool,
      modelId: effectiveModelId,
      videoReferenceMode,
    }),
  });
  if (!startDecision.allow) {
    onFailureCleanup?.();
    setUiError(startDecision.message);
    return { ok: false };
  }

  const preflightResult = await runCharacterModePreflight({
    trigger,
    tool,
    effectiveModelId,
    isCharacterModeEnabledForTool,
    promptToUse: promptForCharacterComposition,
    userReferenceInputs,
    timeoutMs,
    timeoutMessage,
    refreshCharacterModeInjectionBundleForSubmission,
    resolveCharacterModeSubmissionOverrides,
    trackCharacterModeEvent,
  });
  if (!preflightResult.ok) {
    onFailureCleanup?.();
    setUiError(preflightResult.errorMessage);
    return { ok: false };
  }

  const characterModeOverrides = preflightResult.overrides;
  const characterModeBlockDecision = resolveCharacterModeBlockDecision({
    tool,
    mode,
    modelId: effectiveModelId,
    promptText: promptForGuardrails,
    overrides: characterModeOverrides,
    allowCreateFallbackBlock,
  });
  if (characterModeBlockDecision.blocked) {
    onFailureCleanup?.();
    trackCharacterModeFallback(characterModeBlockDecision.overrides, tool);
    trackCharacterModeEvent?.(characterModeBlockDecision.event, {
      tool,
      ...characterModeBlockDecision.telemetry,
    });
    setUiError(
      resolveBlockedMessage?.() ??
        characterModeBlockDecision.message ??
        GENERATION_GUARDRAIL_FALLBACK_ERROR
    );
    return { ok: false };
  }

  trackCharacterModeFallback(characterModeOverrides, tool);
  return {
    ok: true,
    overrides: characterModeOverrides,
  };
};
