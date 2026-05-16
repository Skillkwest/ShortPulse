import type { StudioOutput, ToolId } from "../types";

export type CharacterModeFallbackSummary<TFallbackCode extends string> = {
  fallbackCode: TFallbackCode | null;
  characterReferenceCount: number;
  hasCharacterDescription: boolean;
} | null;

export type CharacterModeSubmissionOverrides<TFallbackCode extends string> = {
  submissionPromptOverride: string;
  displayPromptOverride: string;
  referenceInputsOverride: string[];
  characterContextOverride?: StudioOutput["characterContext"];
  notice: string | null;
  fallbackCode: TFallbackCode | null;
  characterReferenceCount: number;
  hasCharacterDescription: boolean;
} | null;

type RunCharacterModePreflightParams<TBundle, TFallbackCode extends string> = {
  trigger: "generate" | "regenerate";
  tool: ToolId | null;
  effectiveModelId: string | null;
  isCharacterModeEnabledForTool: boolean;
  promptToUse: string;
  userReferenceInputs: string[];
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
  trackCharacterModeEvent?: (message: string, data?: Record<string, unknown>) => void;
};

type CharacterModePreflightResult<TFallbackCode extends string> =
  | {
      ok: true;
      overrides: CharacterModeSubmissionOverrides<TFallbackCode>;
    }
  | {
      ok: false;
      error: unknown;
      errorMessage: string;
    };

export async function runCharacterModePreflight<TBundle, TFallbackCode extends string>({
  trigger,
  tool,
  effectiveModelId,
  isCharacterModeEnabledForTool,
  promptToUse,
  userReferenceInputs,
  timeoutMs,
  timeoutMessage,
  refreshCharacterModeInjectionBundleForSubmission,
  resolveCharacterModeSubmissionOverrides,
  trackCharacterModeEvent,
}: RunCharacterModePreflightParams<TBundle, TFallbackCode>): Promise<
  CharacterModePreflightResult<TFallbackCode>
> {
  void trigger;
  void effectiveModelId;
  void isCharacterModeEnabledForTool;
  void timeoutMs;
  void timeoutMessage;
  trackCharacterModeEvent?.("generation_preflight_bypassed", {
    trigger,
    tool,
    model_id: effectiveModelId,
    is_character_mode: isCharacterModeEnabledForTool,
  });
  void refreshCharacterModeInjectionBundleForSubmission(tool).catch((error) => {
    trackCharacterModeEvent?.("generation_preflight_refresh_failed", {
      trigger,
      tool,
      model_id: effectiveModelId,
      is_character_mode: isCharacterModeEnabledForTool,
      detail: error instanceof Error ? error.message : String(error),
    });
  });
  return {
    ok: true,
    overrides: resolveCharacterModeSubmissionOverrides(
      promptToUse,
      tool,
      null,
      userReferenceInputs
    ),
  };
}
