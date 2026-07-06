import { buildRestoredPulseSessionInstanceId } from "./pulseSessionIdentity";

export type AiStudioPulseCreateMode = "standard" | "pulse";

export type PulseWorkspaceState = {
  expertCreateMode: AiStudioPulseCreateMode;
  activePulsePresetId: string | null;
  pulseSessionInstanceId: string | null;
};

export type PulseRuntimeState = PulseWorkspaceState & {
  isPulseCreateMode: boolean;
  hasSelectedPulsePreset: boolean;
  hasStoredPulseSession: boolean;
  hasActivePulseSession: boolean;
};

const RETIRED_PULSE_PRESET_IDS = new Set([
  "custom_1",
  "custom_2",
  "custom_3",
  "legacy_prompt_modifier",
  "single_shot",
  "ad_hook",
  "product_hero",
  "ugc_style",
  "before_after",
  "lifestyle_scene",
]);

export const normalizePulsePresetId = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized || RETIRED_PULSE_PRESET_IDS.has(normalized)) return null;
  return normalized;
};

export const normalizePulseSessionInstanceId = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

export const resolvePulseRuntimeState = ({
  expertCreateMode,
  activePulsePresetId,
  pulseSessionInstanceId,
}: {
  expertCreateMode: AiStudioPulseCreateMode;
  activePulsePresetId?: unknown;
  pulseSessionInstanceId?: unknown;
}): PulseRuntimeState => {
  const isPulseCreateMode = expertCreateMode === "pulse";
  const resolvedActivePulsePresetId = normalizePulsePresetId(activePulsePresetId);
  const resolvedPulseSessionInstanceId =
    resolvedActivePulsePresetId !== null
      ? normalizePulseSessionInstanceId(pulseSessionInstanceId)
      : null;
  const hasStoredPulseSession =
    resolvedActivePulsePresetId !== null && resolvedPulseSessionInstanceId !== null;

  return {
    expertCreateMode,
    isPulseCreateMode,
    activePulsePresetId: resolvedActivePulsePresetId,
    pulseSessionInstanceId: resolvedPulseSessionInstanceId,
    hasSelectedPulsePreset: resolvedActivePulsePresetId !== null,
    hasStoredPulseSession,
    hasActivePulseSession: isPulseCreateMode && hasStoredPulseSession,
  };
};

export const resolveHydratedPulseRuntimeState = ({
  expertCreateMode,
  workspaceActivePulsePresetId,
  workspacePulseSessionInstanceId,
  sessionId,
  updatedAt,
}: {
  expertCreateMode: AiStudioPulseCreateMode;
  workspaceActivePulsePresetId?: unknown;
  workspacePulseSessionInstanceId?: unknown;
  sessionId: string;
  updatedAt: string;
}): PulseRuntimeState => {
  const normalizedWorkspacePulseState = resolvePulseRuntimeState({
    expertCreateMode,
    activePulsePresetId: workspaceActivePulsePresetId,
    pulseSessionInstanceId: workspacePulseSessionInstanceId,
  });
  const shouldPreserveWorkspacePulseRuntime =
    normalizedWorkspacePulseState.isPulseCreateMode ||
    normalizedWorkspacePulseState.pulseSessionInstanceId !== null;
  const restoredPulseSessionInstanceId =
    !shouldPreserveWorkspacePulseRuntime || !normalizedWorkspacePulseState.activePulsePresetId
      ? normalizedWorkspacePulseState.pulseSessionInstanceId
      : normalizedWorkspacePulseState.pulseSessionInstanceId ||
        buildRestoredPulseSessionInstanceId({
          sessionId,
          updatedAt,
          presetId: normalizedWorkspacePulseState.activePulsePresetId,
        });

  return resolvePulseRuntimeState({
    expertCreateMode,
    activePulsePresetId: shouldPreserveWorkspacePulseRuntime
      ? normalizedWorkspacePulseState.activePulsePresetId
      : null,
    pulseSessionInstanceId: restoredPulseSessionInstanceId,
  });
};
