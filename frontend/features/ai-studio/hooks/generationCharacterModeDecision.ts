import type { StudioMode, ToolId } from "../types";
import type {
  CharacterModeFallbackSummary,
  CharacterModeSubmissionOverrides,
} from "./generationCharacterModePreflight";

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

export function resolveCharacterModeBlockDecision<TFallbackCode extends string>({
  overrides,
}: ResolveCharacterModeBlockDecisionParams<TFallbackCode>): CharacterModeBlockDecision<TFallbackCode> {
  return {
    blocked: false as const,
    overrides,
  };
}
