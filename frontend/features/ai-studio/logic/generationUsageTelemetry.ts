/**
 * Emits stable AI Studio generation-usage telemetry for admin analytics.
 */
import { reportAppError } from "../../../lib/appErrorReporter";
import type { StudioMode, ToolId } from "../types";

export const AI_STUDIO_GENERATE_CLICKED_TELEMETRY_SOURCE = "telemetry.ai_studio.generate_clicked";
export const AI_STUDIO_GENERATE_CLICKED_TELEMETRY_FAMILY = "generation_usage";

type GenerationTelemetryTrigger = "generate" | "regenerate";

type TrackAiStudioGenerateClickedInput = {
  trigger: GenerationTelemetryTrigger;
  tool: ToolId | null;
  mode: StudioMode;
  modelId: string | null;
  selectedModelId?: string | null;
  outputId?: string | null;
  projectIdPresent?: boolean;
  isCharacterMode?: boolean;
  selectedCharacterId?: string | null;
  hasStyle?: boolean;
  styleId?: string | null;
  referenceCount?: number | null;
};

const normalizeTelemetryText = (
  value: string | null | undefined,
  maxLength = 120
): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed.slice(0, maxLength) : null;
};

/**
 * Emits one telemetry event for an explicit AI Studio generate click.
 */
export const trackAiStudioGenerateClicked = ({
  trigger,
  tool,
  mode,
  modelId,
  selectedModelId = null,
  outputId = null,
  projectIdPresent = false,
  isCharacterMode = false,
  selectedCharacterId = null,
  hasStyle = false,
  styleId = null,
  referenceCount = null,
}: TrackAiStudioGenerateClickedInput): void => {
  const normalizedReferenceCount = Number.isFinite(Number(referenceCount))
    ? Math.max(0, Math.trunc(Number(referenceCount)))
    : 0;

  void reportAppError({
    source: AI_STUDIO_GENERATE_CLICKED_TELEMETRY_SOURCE,
    scope: "app",
    severity: "low",
    message: `generate_clicked.${trigger}`,
    metadata: {
      telemetry_family: AI_STUDIO_GENERATE_CLICKED_TELEMETRY_FAMILY,
      telemetry_version: 1,
      event_name: "generate_clicked",
      trigger,
      tool: normalizeTelemetryText(tool, 40),
      selected_tool: normalizeTelemetryText(tool, 40),
      mode: normalizeTelemetryText(mode, 40),
      model_id: normalizeTelemetryText(modelId, 160),
      selected_model_id: normalizeTelemetryText(selectedModelId, 160),
      output_id: normalizeTelemetryText(outputId, 120),
      project_id_present: Boolean(projectIdPresent),
      is_character_mode: Boolean(isCharacterMode),
      selected_character_id: normalizeTelemetryText(selectedCharacterId, 120),
      has_style: Boolean(hasStyle),
      style_id: normalizeTelemetryText(styleId, 120),
      reference_count: normalizedReferenceCount,
    },
  });
};
