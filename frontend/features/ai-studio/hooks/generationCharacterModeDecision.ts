import { resolveGenerationStartDecision } from "../logic/generationStartPolicy";
import type { StudioMode, ToolId } from "../types";
import type {
  CharacterModeFallbackSummary,
  CharacterModeSubmissionOverrides,
} from "./generationCharacterModePreflight";

const isCreateTool = (tool: ToolId | null): boolean => tool === "create" || tool === "text";
const CREATE_CHARACTER_MODE_LOADING_ERROR =
  "Character Mode context is still loading. Please wait before generating.";
const CREATE_CHARACTER_MODE_BUNDLE_UNAVAILABLE_ERROR =
  "Selected character context could not be loaded. Please reselect the character and retry.";

type ResolveCharacterModeBlockDecisionParams<TFallbackCode extends string> = {
  tool: ToolId | null;
  mode: StudioMode;
  modelId: string | null;
  promptText: string;
  overrides: CharacterModeSubmissionOverrides<TFallbackCode>;
  allowCreateFallbackBlock: boolean;
};

type CharacterModeBlockEvent =
  | "character_mode_submit_blocked_fallback"
  | "character_mode_submit_blocked_no_references";

type CharacterModeBlockTelemetry = {
  fallback_code: string | null;
  has_character_description: boolean;
  character_reference_count: number;
};

type CharacterModeBlockDecision<TFallbackCode extends string> =
  | {
      blocked: false;
      overrides: CharacterModeSubmissionOverrides<TFallbackCode>;
    }
  | {
      blocked: true;
      message: string;
      event: CharacterModeBlockEvent;
      telemetry: CharacterModeBlockTelemetry;
      overrides: CharacterModeFallbackSummary<TFallbackCode>;
    };

const resolveCreateCharacterModeFallbackBlockMessage = <TFallbackCode extends string>(
  tool: ToolId | null,
  overrides: CharacterModeSubmissionOverrides<TFallbackCode>
): string | null => {
  if (!isCreateTool(tool) || !overrides?.fallbackCode) return null;
  switch (overrides.fallbackCode) {
    case "bundle_loading":
      return CREATE_CHARACTER_MODE_LOADING_ERROR;
    case "bundle_unavailable":
      return CREATE_CHARACTER_MODE_BUNDLE_UNAVAILABLE_ERROR;
    default:
      return null;
  }
};

export function resolveCharacterModeBlockDecision<TFallbackCode extends string>({
  tool,
  mode,
  modelId,
  promptText,
  overrides,
  allowCreateFallbackBlock,
}: ResolveCharacterModeBlockDecisionParams<TFallbackCode>): CharacterModeBlockDecision<TFallbackCode> {
  if (!overrides) {
    return {
      blocked: false,
      overrides,
    };
  }

  const telemetry = {
    fallback_code: overrides.fallbackCode ?? null,
    has_character_description: overrides.hasCharacterDescription,
    character_reference_count: overrides.characterReferenceCount,
  } satisfies CharacterModeBlockTelemetry;

  if (allowCreateFallbackBlock) {
    const fallbackBlockMessage = resolveCreateCharacterModeFallbackBlockMessage(tool, overrides);
    if (fallbackBlockMessage) {
      return {
        blocked: true,
        message: fallbackBlockMessage,
        event: "character_mode_submit_blocked_fallback",
        telemetry,
        overrides,
      };
    }
  }

  const hasCharacterModeReferences = (overrides.referenceInputsOverride?.length ?? 0) > 0;
  const characterModeDecision = resolveGenerationStartDecision({
    tool,
    mode,
    modelId,
    promptText,
    checkCreateTextMode: false,
    checkPrompt: false,
    checkModel: false,
    checkCharacterReferences: true,
    hasCharacterModeReferences,
  });
  if (!characterModeDecision.allow) {
    return {
      blocked: true,
      message: characterModeDecision.message,
      event: "character_mode_submit_blocked_no_references",
      telemetry,
      overrides,
    };
  }

  return {
    blocked: false,
    overrides,
  };
}
