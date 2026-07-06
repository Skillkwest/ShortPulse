export type CreateAgentModeRuntimeState = {
  isPulseCreateMode: boolean;
  activePulsePresetId: string | null;
  pulseSessionInstanceId: string | null;
  hasActivePulseSession: boolean;
};

const RETIRED_CREATE_PULSE_PRESET_IDS = new Set([
  "custom_1",
  "custom_2",
  "custom_3",
  "prompt_modifier",
  "legacy_prompt_modifier",
  "single_shot",
  "ad_hook",
  "product_hero",
  "ugc_style",
  "before_after",
  "lifestyle_scene",
]);

export const normalizeCreateAgentPulsePresetId = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized || RETIRED_CREATE_PULSE_PRESET_IDS.has(normalized)) return null;
  return normalized;
};

export const normalizeCreateAgentPulseSessionInstanceId = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

export const resolveCreateAgentModeRuntimeState = ({
  expertCreateMode,
  activePulsePresetId,
  pulseSessionInstanceId,
}: {
  expertCreateMode: "standard" | "pulse";
  activePulsePresetId: unknown;
  pulseSessionInstanceId: unknown;
}): CreateAgentModeRuntimeState => {
  const isPulseCreateMode = expertCreateMode === "pulse";
  const resolvedActivePulsePresetId = isPulseCreateMode
    ? normalizeCreateAgentPulsePresetId(activePulsePresetId)
    : null;
  const resolvedPulseSessionInstanceId =
    resolvedActivePulsePresetId !== null
      ? normalizeCreateAgentPulseSessionInstanceId(pulseSessionInstanceId)
      : null;
  return {
    isPulseCreateMode,
    activePulsePresetId: resolvedActivePulsePresetId,
    pulseSessionInstanceId: resolvedPulseSessionInstanceId,
    hasActivePulseSession:
      resolvedActivePulsePresetId !== null && resolvedPulseSessionInstanceId !== null,
  };
};
